export type ConfirmationLink =
  | { kind: "code"; code: string }
  | { kind: "token_hash"; tokenHash: string }
  | { kind: "error"; code: string }
  | { kind: "none" };

type ConfirmationLocation = Pick<Location, "search" | "hash">;

/**
 * Identifica o que o retorno do e-mail trouxe.
 *
 * PKCE entrega `?code=`; templates customizados entregam `?token_hash=&type=`;
 * link expirado ou já usado volta com `error`/`error_code` (query ou fragmento).
 */
export function readConfirmationLink(location: ConfirmationLocation): ConfirmationLink {
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.startsWith("#") ? location.hash.slice(1) : location.hash);

  const errorCode = query.get("error_code") ?? query.get("error") ?? hash.get("error_code") ?? hash.get("error");
  if (errorCode) return { kind: "error", code: errorCode };

  const tokenHash = query.get("token_hash") ?? hash.get("token_hash");
  if (tokenHash) return { kind: "token_hash", tokenHash };

  const code = query.get("code") ?? hash.get("code");
  if (code) return { kind: "code", code };

  return { kind: "none" };
}

/**
 * O GoTrue só acrescenta o `code` depois de consumir com sucesso o token do
 * e-mail. A troca PKCE seguinte serve para abrir a sessão e pode falhar em
 * outro navegador sem desfazer a confirmação que já aconteceu no servidor.
 */
export function callbackAlreadyConfirmedEmail(link: ConfirmationLink): boolean {
  return link.kind === "code";
}
