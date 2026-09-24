/**
 * Me-Space × We-Space — leitura única do "espaço" ativo para toda a UI.
 *
 * O estado global continua em `use-view-mode` (store externo +
 * useSyncExternalStore: sem Provider, sem Zustand, persiste em localStorage).
 * Aqui só se cruza com o vínculo real do Plano Casal: preferência "couple"
 * sem parceiro vinculado (convite pendente, downgrade do dono) = Meu Espaço.
 */
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useFamilyGroup, type FamilyAuthor } from "@/hooks/use-family-group";
import { setViewMode, useViewMode, type ViewMode } from "@/hooks/use-view-mode";

const SPACE_INDEPENDENT_KEYS = new Set(["family-group", "subscription-status", "auth"]);

export interface SpaceState {
  /** Preferência gravada (pode ser "couple" mesmo sem vínculo). */
  mode: ViewMode;
  /** Nosso Espaço de fato ativo: preferência Casal + parceiro vinculado. */
  isWeSpace: boolean;
  /** Existe parceiro vinculado (o seletor só aparece com isso). */
  isLinked: boolean;
  me: FamilyAuthor | null;
  partner: FamilyAuthor | null;
  authorOf: (userId?: string | null) => FamilyAuthor | null;
  setSpace: (next: ViewMode) => void;
}

export function useSpace(): SpaceState {
  const mode = useViewMode();
  const { isLinked, directory, authorOf } = useFamilyGroup();
  const queryClient = useQueryClient();

  const setSpace = useCallback(
    (next: ViewMode) => {
      if (next === mode) return;
      setViewMode(next);
      // As query-keys de dados financeiros já carregam o viewMode; o resto
      // (RPCs com p_scope, contadores) é relido só se estiver montado.
      // Vínculo, plano e usuário não dependem do espaço: ficam fora.
      void queryClient.invalidateQueries({
        refetchType: "active",
        predicate: (query) => !SPACE_INDEPENDENT_KEYS.has(query.queryKey[0] as string),
      });
    },
    [mode, queryClient],
  );

  return {
    mode,
    isWeSpace: mode === "couple" && isLinked,
    isLinked,
    me: directory.find((person) => person.isSelf) ?? null,
    partner: directory.find((person) => !person.isSelf) ?? null,
    authorOf,
    setSpace,
  };
}
