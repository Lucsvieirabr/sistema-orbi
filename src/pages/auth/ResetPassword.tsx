import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CircleCheck, Link2Off, Loader2 } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordField, PasswordMatchHint, PasswordStrengthHint } from "@/components/auth/PasswordField";
import { TotpCodeInput } from "@/components/auth/TotpCodeInput";
import { Button } from "@/components/ui/button";
import { resolvePostAuthRoute } from "@/hooks/use-auth";
import { SUBSCRIPTION_QUERY_KEY } from "@/hooks/use-subscription";
import { AuthFlowError, describeAuthError, isInvalidLinkError } from "@/lib/auth/auth-errors";
import { AUTH_ROUTES } from "@/lib/auth/redirect";
import { evaluatePassword } from "@/lib/password-strength";
import { getAssurance, TOTP_CODE_LENGTH, verifyLoginCode } from "@/services/auth/mfa";
import {
  awaitRecoveryCodeExchange,
  getRecoverySession,
  readRecoveryLink,
  updatePassword,
  verifyRecoveryToken,
} from "@/services/auth/password-recovery";

type Phase = "checking" | "form" | "mfa" | "invalid" | "done";

/** Erros que significam "este link/sessão de recuperação acabou" → tela de link inválido. */
const DEAD_SESSION_CODES = new Set(["session_not_found", "session_expired", "refresh_token_not_found"]);

const MISSING_LINK = "Abra esta página pelo link que enviamos para o seu e-mail.";

/** Tira `token_hash`/`code` da barra de endereço: fora do histórico, do Referer e de print de tela. */
function scrubUrl() {
  window.history.replaceState(window.history.state, "", window.location.pathname);
}

/**
 * Passo 2 da recuperação (`/redefinir-senha`), destino do link do e-mail.
 *
 * checking → form → (mfa, se a conta tiver TOTP) → done
 *                ↘ invalid (link expirado, já usado ou aberto em outro navegador)
 *
 * Com `token_hash` o token só é consumido no envio da nova senha; com `?code=`
 * a sessão já chega pronta (troca PKCE automática do supabase-js).
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const formId = useId();
  const passwordId = `${formId}-password`;
  const confirmId = `${formId}-confirm`;
  const codeId = `${formId}-code`;

  const [link] = useState(() => readRecoveryLink(window.location));
  const tokenHashRef = useRef<string | null>(link.kind === "token_hash" ? link.tokenHash : null);
  const hasSessionRef = useRef(false);
  const pendingPasswordRef = useRef("");
  const busyRef = useRef(false);

  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("checking");
  const [invalidReason, setInvalidReason] = useState(MISSING_LINK);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState({ password: false, confirm: false });
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [othersSignedOut, setOthersSignedOut] = useState(true);

  const markInvalid = (error: unknown) => {
    setInvalidReason(describeAuthError(error, "reset_link"));
    setPhase("invalid");
  };

  useEffect(() => {
    let active = true;

    (async () => {
      if (link.kind === "error") {
        scrubUrl();
        markInvalid({ code: link.code });
        return;
      }

      if (link.kind === "token_hash") {
        scrubUrl();
        setPhase("form");
        return;
      }

      if (link.kind === "code") {
        try {
          await awaitRecoveryCodeExchange();
        } catch (error) {
          scrubUrl();
          if (active) markInvalid(error);
          return;
        }
        scrubUrl();
      }

      const session = await getRecoverySession();
      if (!active) return;
      if (!session.active) {
        setInvalidReason(MISSING_LINK);
        setPhase("invalid");
        return;
      }

      hasSessionRef.current = true;
      setEmail(session.email);
      setPhase("form");
    })();

    return () => {
      active = false;
    };
  }, [link]);

  // Foco no primeiro campo de cada etapa.
  useEffect(() => {
    if (phase === "form") passwordRef.current?.focus();
    if (phase === "mfa") codeRef.current?.focus();
  }, [phase]);

  const evaluation = useMemo(() => evaluatePassword(password, email), [password, email]);
  const confirmError =
    confirm.length === 0 ? "Repita a nova senha." : confirm !== password ? "As senhas não coincidem." : null;
  const showPasswordError = (touched.password || submitted) && !evaluation.isValid;
  const showConfirmError = (touched.confirm || submitted) && confirmError !== null;

  const handleFlowError = (error: unknown) => {
    const code = (error as AuthFlowError)?.code;

    if (isInvalidLinkError({ code }) || DEAD_SESSION_CODES.has(code)) {
      pendingPasswordRef.current = "";
      markInvalid(error);
      return;
    }

    if (code === "insufficient_aal") {
      pendingPasswordRef.current = password;
      setPhase("mfa");
      return;
    }

    pendingPasswordRef.current = "";
    setPhase("form");
    setServerError(describeAuthError(error, "password_update"));
    window.setTimeout(() => passwordRef.current?.focus(), 0);
  };

  const commitPassword = async (nextPassword: string) => {
    const revoked = await updatePassword(nextPassword);
    pendingPasswordRef.current = "";
    setPassword("");
    setConfirm("");
    setOthersSignedOut(revoked);
    setPhase("done");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busyRef.current) return;
    setSubmitted(true);
    setServerError(null);

    if (!evaluation.isValid) {
      passwordRef.current?.focus();
      return;
    }
    if (confirmError) {
      confirmRef.current?.focus();
      return;
    }

    busyRef.current = true;
    setIsWorking(true);
    try {
      if (!hasSessionRef.current) {
        const tokenHash = tokenHashRef.current;
        if (!tokenHash) throw new AuthFlowError("otp_expired", MISSING_LINK);
        const session = await verifyRecoveryToken(tokenHash);
        tokenHashRef.current = null;
        hasSessionRef.current = true;
        if (session.email) setEmail(session.email);
      }

      const assurance = await getAssurance();
      if (assurance.needsChallenge) {
        pendingPasswordRef.current = password;
        setCode("");
        setCodeError(null);
        setPhase("mfa");
        return;
      }

      await commitPassword(password);
    } catch (error) {
      handleFlowError(error);
    } finally {
      busyRef.current = false;
      setIsWorking(false);
    }
  };

  const submitCode = async (value: string) => {
    if (busyRef.current || value.length !== TOTP_CODE_LENGTH) return;
    busyRef.current = true;
    setIsWorking(true);
    setCodeError(null);

    try {
      try {
        await verifyLoginCode(value);
      } catch (error) {
        setCodeError(describeAuthError(error, "mfa"));
        setCode("");
        window.setTimeout(() => codeRef.current?.focus(), 0);
        return;
      }

      await commitPassword(pendingPasswordRef.current);
    } catch (error) {
      handleFlowError(error);
    } finally {
      busyRef.current = false;
      setIsWorking(false);
    }
  };

  const continueToApp = async () => {
    setIsLeaving(true);
    queryClient.removeQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    const route = await resolvePostAuthRoute();
    navigate(route, { replace: true });
  };

  const backToLogin = (
    <Button asChild variant="subtle" size="sm">
      <Link to={AUTH_ROUTES.login} replace>
        <ArrowLeft aria-hidden />
        Voltar para o login
      </Link>
    </Button>
  );

  if (phase === "checking") {
    return (
      <AuthShell title="Validando o link" description="Só um instante.">
        <div className="flex justify-center py-6" role="status" aria-live="polite">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
          <span className="sr-only">Validando o link de redefinição</span>
        </div>
      </AuthShell>
    );
  }

  if (phase === "invalid") {
    return (
      <AuthShell title="Este link não vale mais" description={invalidReason} aside={backToLogin}>
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg bg-surface-sunken p-3.5 text-sm text-muted-foreground">
            <Link2Off className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="leading-relaxed">
              Por segurança, cada link funciona uma única vez e expira em 1 hora. Peça outro e use o e-mail mais
              recente.
            </p>
          </div>
          <Button asChild className="w-full">
            <Link to={AUTH_ROUTES.forgotPassword} replace>
              Pedir um novo link
            </Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (phase === "done") {
    return (
      <AuthShell
        title="Senha redefinida"
        description={
          othersSignedOut
            ? "Você já está conectado. Os outros dispositivos saíram da conta e vão pedir a nova senha."
            : "Você já está conectado. Use a nova senha nos próximos acessos."
        }
      >
        <div className="space-y-5">
          <div className="flex justify-center" aria-hidden>
            <span className="grid h-12 w-12 place-items-center rounded-full bg-success-soft text-success">
              <CircleCheck className="h-6 w-6" />
            </span>
          </div>
          <Button type="button" className="w-full" onClick={() => void continueToApp()} disabled={isLeaving}>
            {isLeaving && <Loader2 className="animate-spin" aria-hidden />}
            {isLeaving ? "Abrindo…" : "Continuar para o Orbi"}
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (phase === "mfa") {
    return (
      <AuthShell
        title="Confirme que é você"
        description="Sua conta usa verificação em duas etapas. Digite o código do aplicativo autenticador para salvar a nova senha."
        aside={backToLogin}
      >
        <form
          className="space-y-4"
          noValidate
          aria-label="Código de verificação"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCode(code);
          }}
        >
          <TotpCodeInput
            ref={codeRef}
            id={codeId}
            value={code}
            onChange={(value) => {
              setCode(value);
              if (codeError) setCodeError(null);
            }}
            onComplete={(value) => void submitCode(value)}
            disabled={isWorking}
            error={codeError}
            autoFocus
          />
          <Button type="submit" className="w-full" disabled={isWorking || code.length !== TOTP_CODE_LENGTH}>
            {isWorking && <Loader2 className="animate-spin" aria-hidden />}
            {isWorking ? "Salvando…" : "Confirmar e salvar senha"}
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Crie uma nova senha"
      description="Use uma senha que você não repete em nenhum outro serviço."
      aside={backToLogin}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5" aria-label="Nova senha">
        {/* Âncora para o gerenciador de senhas associar a nova senha à conta. */}
        {email && (
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
        )}

        <PasswordField
          ref={passwordRef}
          id={passwordId}
          name="new-password"
          label="Nova senha"
          autoComplete="new-password"
          maxLength={128}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (serverError) setServerError(null);
          }}
          onBlur={() => password && setTouched((t) => ({ ...t, password: true }))}
          disabled={isWorking}
          error={serverError ?? (showPasswordError ? evaluation.error : null)}
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
          disabled={isWorking}
          error={showConfirmError ? confirmError : null}
          hint={<PasswordMatchHint matches={confirm.length > 0 && confirm === password} />}
        />

        <Button type="submit" className="w-full" disabled={isWorking}>
          {isWorking && <Loader2 className="animate-spin" aria-hidden />}
          {isWorking ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </form>
    </AuthShell>
  );
}
