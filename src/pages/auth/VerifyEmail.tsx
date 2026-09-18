import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, LogIn, Send } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { EnvelopeBeacon } from "@/components/auth/EnvelopeBeacon";
import { TurnstileField } from "@/components/auth/TurnstileField";
import { Button } from "@/components/ui/button";
import { resolvePostAuthRoute } from "@/hooks/use-auth";
import { useResendConfirmation } from "@/hooks/use-resend-confirmation";
import { SUBSCRIPTION_QUERY_KEY } from "@/hooks/use-subscription";
import { useTurnstile } from "@/hooks/use-turnstile";
import { supabase } from "@/integrations/supabase/client";
import { describeAuthError } from "@/lib/auth/auth-errors";
import { AUTH_ROUTES } from "@/lib/auth/redirect";
import {
  awaitConfirmedSession,
  forgetPendingEmail,
  readConfirmationLink,
  readPendingEmail,
  rememberPendingEmail,
  scrubConfirmationUrl,
  verifyConfirmationToken,
} from "@/services/auth/email-confirmation";

type Phase = "waiting" | "confirming" | "confirmed" | "invalid";

/**
 * `/verificar-email` — a etapa que faltava entre o cadastro e o login.
 *
 * Antes, quem criava a conta era jogado direto para os planos (ou para o
 * login) sem saber que existia um e-mail para abrir. A tela agora tem um
 * estado só dela, e ela é também o destino do link do e-mail:
 *
 *   waiting     cadastro recém-feito, aguardando o clique no link
 *   confirming  a pessoa voltou pelo link; trocando o código por sessão
 *   confirmed   conta ativa — segue para a escolha do plano
 *   invalid     link expirado, já usado, ou aberto em outro navegador (PKCE)
 *
 * Um `?code=` na URL é consumido pelo `detectSessionInUrl` do supabase-js; um
 * `token_hash` é trocado aqui. Nos dois casos a URL é limpa antes de qualquer
 * render — token não entra em histórico, Referer nem print de tela.
 */
export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const captcha = useTurnstile();
  const { resend, error: resendError, secondsLeft, isSending, hasSent, countdown } = useResendConfirmation();

  const [link] = useState(() => readConfirmationLink(window.location));
  const [phase, setPhase] = useState<Phase>(link.kind === "none" ? "waiting" : "confirming");
  const [invalidReason, setInvalidReason] = useState("Este link de confirmação não vale mais.");
  const [isLeaving, setIsLeaving] = useState(false);
  const handledRef = useRef(false);

  /** E-mail em voo: state da navegação → sessionStorage → vazio (tela genérica). */
  const email = useMemo(() => {
    const fromState = typeof location.state?.email === "string" ? location.state.email : null;
    if (fromState) {
      rememberPendingEmail(fromState);
      return fromState;
    }
    return readPendingEmail() ?? "";
  }, [location.state]);

  /** Sessão de pé = o link já cumpriu o papel. Promove a tela e engole o erro. */
  const settleAsConfirmed = useCallback(() => {
    forgetPendingEmail();
    queryClient.removeQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    setPhase("confirmed");
  }, [queryClient]);

  const salvageWithActiveSession = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return false;
    settleAsConfirmed();
    return true;
  }, [settleAsConfirmed]);

  /**
   * Consome o link UMA única vez.
   *
   * `handledRef` sobrevive ao ciclo monta/desmonta/monta do StrictMode — e, por
   * isso mesmo, o efeito NÃO pode ter cleanup de `active`: a primeira execução
   * já disparou a troca do token e a segunda sai na porta, então cancelar a
   * primeira deixaria a tela travada em "Confirmando" para sempre.
   *
   * O token de confirmação é de uso único: um segundo disparo (StrictMode,
   * scanner de e-mail, F5) devolve `otp_expired` mesmo com a conta JÁ ativa —
   * o falso "link expirado". Antes de acusar erro, checamos a sessão: existindo,
   * o desfecho é sucesso.
   */
  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    if (link.kind === "none") return;

    void (async () => {
      if (link.kind === "error") {
        scrubConfirmationUrl();
        if (await salvageWithActiveSession()) return;
        setInvalidReason(describeAuthError({ code: link.code }, "reset_link"));
        setPhase("invalid");
        return;
      }

      try {
        const session =
          link.kind === "token_hash" ? await verifyConfirmationToken(link.tokenHash) : await awaitConfirmedSession();

        scrubConfirmationUrl();

        if (!session) {
          if (await salvageWithActiveSession()) return;
          setInvalidReason(
            "Abra o link no mesmo navegador em que você criou a conta, ou entre com seu e-mail e senha.",
          );
          setPhase("invalid");
          return;
        }

        settleAsConfirmed();
      } catch (error) {
        scrubConfirmationUrl();
        if (await salvageWithActiveSession()) return;
        setInvalidReason(describeAuthError(error, "reset_link"));
        setPhase("invalid");
      }
    })();
  }, [link, salvageWithActiveSession, settleAsConfirmed]);

  /**
   * Confirmou em outra aba? Esta volta sozinha para o fluxo, sem F5.
   * (Só enquanto espera — depois de `confirmed` o botão manda.)
   */
  useEffect(() => {
    if (phase !== "waiting") return;

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) settleAsConfirmed();
    });

    return () => data.subscription.unsubscribe();
  }, [phase, settleAsConfirmed]);

  /** Conta ativa e sessão aberta: o backend decide entre planos, sistema e cobrança. */
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

  // -------------------------------------------------------------------------
  // Trocando o código por sessão
  // -------------------------------------------------------------------------
  if (phase === "confirming") {
    return (
      <AuthShell title="Confirmando sua conta" description="Só um instante.">
        <div className="flex flex-col items-center gap-4 py-2" role="status" aria-live="polite">
          <EnvelopeBeacon tone="waiting" />
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          <span className="sr-only">Validando o link de confirmação</span>
        </div>
      </AuthShell>
    );
  }

  // -------------------------------------------------------------------------
  // Conta ativa
  // -------------------------------------------------------------------------
  if (phase === "confirmed") {
    return (
      <AuthShell
        title="E-mail confirmado"
        description="Sua conta está ativa. Agora é só escolher o plano que combina com você."
      >
        <div className="flex flex-col items-center gap-5">
          <EnvelopeBeacon tone="success" />
          <Button type="button" className="w-full" onClick={() => void continueToApp()} disabled={isLeaving}>
            {isLeaving && <Loader2 className="animate-spin" aria-hidden />}
            {isLeaving ? "Abrindo…" : "Escolher meu plano"}
          </Button>
        </div>
      </AuthShell>
    );
  }

  // -------------------------------------------------------------------------
  // Link morto
  // -------------------------------------------------------------------------
  if (phase === "invalid") {
    return (
      <AuthShell title="Este link não vale mais" description={invalidReason} aside={backToLogin}>
        <div className="flex flex-col items-center gap-5">
          <EnvelopeBeacon tone="invalid" />

          <p className="text-center text-sm leading-relaxed text-muted-foreground">
            Por segurança, cada link funciona uma única vez e expira em 1 hora. Peça outro e use sempre o e-mail mais
            recente.
          </p>

          <div className="w-full space-y-3">
            <TurnstileField {...captcha.fieldProps} action="signup" />

            {resendError && (
              <p role="alert" className="text-sm text-destructive motion-safe:animate-fade-in">
                {resendError}
              </p>
            )}

            <Button
              type="button"
              className="w-full tabular-nums"
              disabled={!email || isSending || secondsLeft > 0 || captcha.blocking}
              onClick={() => void resend(email, captcha.captchaToken)}
            >
              {isSending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
              {isSending ? "Enviando…" : secondsLeft > 0 ? `Reenviar em ${countdown}` : "Enviar um novo link"}
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link to={AUTH_ROUTES.login} replace>
                <LogIn aria-hidden />
                Entrar com e-mail e senha
              </Link>
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  // -------------------------------------------------------------------------
  // Esperando o clique no link
  // -------------------------------------------------------------------------
  return (
    <AuthShell
      title="Confirme seu e-mail"
      description={
        email ? (
          <>
            Enviamos um link de confirmação para{" "}
            {/* `inline-block` + `max-w-full` + `break-all`: sem isso um e-mail
                longo (sem espaço para quebrar) empurra a largura do card e
                corta a tela no celular. */}
            <span className="inline-block max-w-full break-all align-bottom font-medium text-foreground">
              {email}
            </span>
            . Verifique sua caixa de entrada para ativar sua conta e retornar ao login.
          </>
        ) : (
          "Enviamos um link de confirmação para o seu e-mail. Verifique sua caixa de entrada para ativar sua conta e retornar ao login."
        )
      }
      aside={backToLogin}
    >
      <div className="flex flex-col items-center gap-6">
        <EnvelopeBeacon tone={hasSent ? "success" : "waiting"} />

        {/* Os três passos, na ordem em que acontecem. Sem isso a tela é só
            uma frase e um botão — e a pessoa não sabe o que esperar. */}
        <ol className="w-full space-y-0">
          {[
            "Abra o e-mail que acabamos de enviar.",
            "Toque em “Confirmar e-mail”.",
            "Volte aqui e entre com sua senha.",
          ].map((step, index) => (
            <li
              key={step}
              className="flex items-start gap-3 border-b border-border-subtle py-2.5 last:border-b-0 motion-safe:animate-rise"
              style={{ animationDelay: `${120 + index * 70}ms` }}
            >
              <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-sunken text-[0.6875rem] font-semibold tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <span className="text-sm leading-relaxed text-pretty text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>

        <div className="w-full space-y-3">
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            O link vale por 1 hora. Não chegou? Olhe a caixa de spam ou a aba de promoções.
          </p>

          <TurnstileField {...captcha.fieldProps} action="signup" />

          {resendError && (
            <p role="alert" className="text-sm text-destructive motion-safe:animate-fade-in">
              {resendError}
            </p>
          )}

          {hasSent && !resendError && (
            <p className="text-center text-sm text-success motion-safe:animate-fade-in" aria-live="polite">
              Novo link enviado.
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full tabular-nums"
            disabled={!email || isSending || secondsLeft > 0 || captcha.blocking}
            onClick={() => void resend(email, captcha.captchaToken)}
          >
            {isSending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            {isSending
              ? "Enviando…"
              : secondsLeft > 0
                ? `Reenviar em ${countdown}`
                : "Reenviar e-mail de confirmação"}
          </Button>

          <Button asChild variant="ghost" className="w-full">
            <Link to={AUTH_ROUTES.login} replace>
              <LogIn aria-hidden />
              Já confirmei — quero entrar
            </Link>
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
