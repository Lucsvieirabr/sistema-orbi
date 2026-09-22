import { getCachedAuthUser } from "@/hooks/use-current-user";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { PasswordField, PasswordMatchHint, PasswordStrengthHint } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { describeAuthError } from "@/lib/auth/auth-errors";
import { evaluatePassword } from "@/lib/password-strength";

/**
 * Seção "Segurança" de Configurações: troca de senha via Supabase Auth.
 *
 * - `updateUser({ password })` roda sobre a sessão atual (JWT do próprio
 *   usuário); nada passa por Edge Function nem toca tabela.
 * - Depois da troca, as outras sessões são encerradas (`scope: 'others'`):
 *   quem troca senha costuma estar reagindo a um acesso indevido.
 * - Erros de campo só aparecem depois do primeiro blur ou tentativa de envio.
 */
export function PasswordSettings() {
  const { toast } = useToast();
  const formId = useId();
  const passwordId = `${formId}-new-password`;
  const confirmId = `${formId}-confirm-password`;

  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState({ password: false, confirm: false });
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getCachedAuthUser().then(({ data }) => {
      if (active) setEmail(data.user?.email ?? "");
    });
    return () => {
      active = false;
    };
  }, []);

  const evaluation = useMemo(() => evaluatePassword(password, email), [password, email]);

  const confirmError =
    confirm.length === 0 ? "Repita a nova senha." : confirm !== password ? "As senhas não coincidem." : null;

  const showPasswordError = (touched.password || submitted) && !evaluation.isValid;
  const showConfirmError = (touched.confirm || submitted) && confirmError !== null;
  const confirmMatches = confirm.length > 0 && confirm === password;

  const reset = () => {
    setPassword("");
    setConfirm("");
    setTouched({ password: false, confirm: false });
    setSubmitted(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    setSubmitted(true);

    if (!evaluation.isValid) {
      passwordRef.current?.focus();
      return;
    }
    if (confirmError) {
      confirmRef.current?.focus();
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // Não crítico: a senha já mudou. Se falhar, só não prometemos no toast.
      const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });

      reset();
      toast({
        title: "Senha alterada",
        description: signOutError
          ? "Use a nova senha no próximo acesso."
          : "Use a nova senha no próximo acesso. Os outros dispositivos foram desconectados.",
      });
    } catch (error) {
      toast({ title: "Senha não alterada", description: describeAuthError(error, "password_update"), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Senha</CardTitle>
        <CardDescription>
          Use uma senha que você não repete em nenhum outro serviço. Ao trocar, os outros dispositivos conectados
          saem da conta.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate aria-label="Alterar senha">
        {/* Âncora para gerenciadores de senha associarem a nova senha à conta. */}
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={email}
          readOnly
          hidden
          aria-hidden
          tabIndex={-1}
        />

        <CardContent className="grid gap-5 pt-0 md:max-w-md">
          <PasswordField
            ref={passwordRef}
            id={passwordId}
            name="new-password"
            label="Nova senha"
            autoComplete="new-password"
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => password && setTouched((t) => ({ ...t, password: true }))}
            disabled={isSaving}
            error={showPasswordError ? evaluation.error : null}
            hint={<PasswordStrengthHint evaluation={evaluation} />}
          />

          <PasswordField
            ref={confirmRef}
            id={confirmId}
            name="confirm-password"
            label="Confirmar nova senha"
            autoComplete="new-password"
            maxLength={128}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onBlur={() => confirm && setTouched((t) => ({ ...t, confirm: true }))}
            disabled={isSaving}
            error={showConfirmError ? confirmError : null}
            hint={<PasswordMatchHint matches={confirmMatches} />}
          />
        </CardContent>

        <CardFooter>
          <Button type="submit" disabled={isSaving} className="sm:min-w-[9.5rem]">
            {isSaving && <Loader2 className="animate-spin" aria-hidden />}
            {isSaving ? "Alterando…" : "Alterar senha"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
