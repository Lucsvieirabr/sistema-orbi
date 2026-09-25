/**
 * Convite do Plano Casal — o link do e-mail (`/invite/accept?token=`).
 *
 * A tela lê o token UMA vez, limpa a URL (fora do histórico, do Referer e de
 * print de tela) e o guarda aqui até a decisão. Quem abre o link sem sessão
 * passa por login, cadastro ou confirmação de e-mail e volta para o convite
 * sem o token trafegar em `?next=`.
 *
 * localStorage (e não sessionStorage): o link de confirmação do cadastro abre
 * em outra aba. O token sozinho não vincula nada — o aceite exige a conta do
 * e-mail convidado (RPC `orbi_family_invite_accept`).
 */
export const INVITE_ACCEPT_PATH = "/invite/accept";

const STORAGE_KEY = "orbi:family-invite";
/** Mesma validade do convite no banco. */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export const isInviteToken = (value: unknown): value is string =>
  typeof value === "string" && TOKEN_PATTERN.test(value);

function rememberInviteToken(token: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, at: Date.now() }));
  } catch {
    /* storage bloqueado: o link do e-mail continua valendo */
  }
}

function readInviteToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { token, at } = JSON.parse(raw) ?? {};
    if (isInviteToken(token) && typeof at === "number" && Date.now() - at < TTL_MS) return token;
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
  return null;
}

export function forgetInviteToken() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/** Convite aguardando decisão = próximo destino depois de login/cadastro. */
export function pendingInvitePath(): string | null {
  return readInviteToken() ? INVITE_ACCEPT_PATH : null;
}

/** Token do link (guardado e retirado da URL) ou o que ficou guardado. */
export function takeInviteToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("token")) return readInviteToken();

  const token = params.get("token");
  window.history.replaceState(window.history.state, "", window.location.pathname);
  if (!isInviteToken(token)) return null;
  rememberInviteToken(token);
  return token;
}
