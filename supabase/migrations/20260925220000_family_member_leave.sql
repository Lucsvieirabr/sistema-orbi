-- ============================================================================
-- PLANO CASAL — PARCEIRO PODE SAIR + INSERT DE GRUPO SEM COLUNAS FORJADAS
-- ============================================================================
-- Achados da auditoria do fluxo de vínculo:
--
--  [A] Só o dono desfazia o vínculo (`family_members_delete`). O parceiro que
--      aceitou o convite não tinha como sair: o dono seguia lendo contas,
--      cartões e lançamentos dele (e editando, via `family_update_transactions`)
--      enquanto pagasse o Casal. Consentimento precisa ser revogável pelo
--      titular (LGPD art. 8º §5º). Agora o parceiro apaga a PRÓPRIA linha
--      ativa. Convite pendente tem user_id NULL: segue só com o dono.
--      Efeito = remoção pelo dono: herança de plano (`orbi_effective_plan_owner`),
--      leitura (`orbi_family_user_ids`) e edição cruzada derivam da linha ativa.
--
--  [B] `GRANT INSERT ON family_groups` valia para a tabela inteira: o cliente
--      escolhia `id` e `created_at`. Com `created_at` no passado, um membro
--      fazia a casca própria virar o "grupo mais antigo" em
--      `orbi_family_group_of`/`orbi_my_family_group_id` e o vínculo ficava
--      assimétrico (ele deixava de ver o dono; o dono continuava vendo ele).
--      Agora só `owner_id` é gravável; o resto vem do DEFAULT.
--
--  [C] `orbi_family_invite_accept`: o dono cancelando o convite entre a
--      revalidação e o UPDATE (DELETE não pega o advisory lock) fazia a RPC
--      responder `accepted` e gravar auditoria sem vincular ninguém — e ainda
--      apagava a casca de grupo do convidado. Agora só conclui se a linha
--      foi de fato ativada.
-- ============================================================================

BEGIN;

-- ============================================================================
-- [A] SAIR DO GRUPO
-- ============================================================================
DROP POLICY IF EXISTS "family_members_leave" ON public.family_group_members;
CREATE POLICY "family_members_leave" ON public.family_group_members
  FOR DELETE TO authenticated
  USING (status = 'active' AND user_id = auth.uid());

-- ============================================================================
-- [B] INSERT DE GRUPO — só o dono, sem id/created_at do cliente
-- ============================================================================
REVOKE INSERT ON public.family_groups FROM anon, authenticated;
GRANT INSERT (owner_id) ON public.family_groups TO authenticated;

-- ============================================================================
-- [C] ACEITE — igual a 20260925180000, conferindo o UPDATE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.orbi_family_invite_accept(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_check  jsonb;
  v_owner  uuid;
  v_member uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;

  v_check := public.orbi_family_invite_resolve(p_token, v_uid);
  IF v_check ->> 'status' <> 'ready' THEN
    RETURN v_check - 'member_id' - 'owner_id';
  END IF;

  v_owner := (v_check ->> 'owner_id')::uuid;

  PERFORM public.orbi_quota_lock(v_owner, 'family_members');
  PERFORM public.orbi_quota_lock(v_uid, 'family_join');

  v_check := public.orbi_family_invite_resolve(p_token, v_uid);
  IF v_check ->> 'status' <> 'ready' THEN
    RETURN v_check - 'member_id' - 'owner_id';
  END IF;

  v_member := (v_check ->> 'member_id')::uuid;

  UPDATE public.family_group_members
     SET status            = 'active',
         user_id           = v_uid,
         accepted_at       = now(),
         invite_expires_at = NULL
   WHERE id = v_member
     AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  -- Casca vazia de Plano Casal próprio: sairia como "grupo mais antigo" em
  -- orbi_family_group_of e esconderia o vínculo novo.
  DELETE FROM public.family_groups g
   WHERE g.owner_id = v_uid
     AND NOT EXISTS (SELECT 1 FROM public.family_group_members x WHERE x.family_group_id = g.id);

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (v_uid, 'family_invite_accepted', 'family_group_members', v_member,
          jsonb_build_object('owner_id', v_owner));

  RETURN jsonb_build_object('status', 'accepted', 'inviter_name', v_check ->> 'inviter_name');
END;
$$;

REVOKE ALL ON FUNCTION public.orbi_family_invite_accept(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orbi_family_invite_accept(text) TO authenticated;

COMMENT ON POLICY "family_members_leave" ON public.family_group_members IS
  'Plano Casal: o parceiro vinculado desfaz o próprio vínculo (revoga a leitura cruzada e a herança de plano).';

COMMIT;

NOTIFY pgrst, 'reload schema';
