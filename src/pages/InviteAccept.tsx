import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Eye, PencilLine, Sparkles } from "lucide-react";

import orbiLogo from "@/assets/orbi-logo_dark.png";
import { EnvelopeBeacon } from "@/components/auth/EnvelopeBeacon";
import { EclipseLoader, OrbitUnion, type OrbitPerson } from "@/components/family/OrbitUnion";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { FAMILY_GROUP_QUERY_KEY, toAuthor } from "@/hooks/use-family-group";
import { QUOTA_QUERY_KEY } from "@/hooks/use-quota";
import { SUBSCRIPTION_QUERY_KEY } from "@/hooks/use-subscription";
import { useToast } from "@/hooks/use-toast";
import { setViewMode } from "@/hooks/use-view-mode";
import { supabase } from "@/integrations/supabase/client";
import type { SessionStage } from "@/lib/auth/assurance";
import { AUTH_ROUTES, loginPath, mfaChallengePath } from "@/lib/auth/redirect";
import { forgetInviteToken, INVITE_ACCEPT_PATH, takeInviteToken } from "@/lib/family-invite";
import { cn } from "@/lib/utils";

/** Tempo mínimo do eclipse: o aceite é um momento, não um piscar. */
const SYNC_MIN_MS = 1400;

type Problem =
  | "invalid"
  | "expired"
  | "email_mismatch"
  | "email_unconfirmed"
  | "already_linked"
  | "owns_group"
  | "owner_inactive"
  | "self"
  | "network";

interface InviteResult {
  status: "ready" | "accepted" | Exclude<Problem, "network">;
  inviter_name?: string | null;
  invited_email?: string | null;
}

type Phase =
  | { kind: "checking" }
  | { kind: "review"; inviter: string | null }
  | { kind: "syncing" }
  | { kind: "united"; me: OrbitPerson; partner: OrbitPerson }
  | { kind: "problem"; problem: Problem; inviter?: string | null; invitedEmail?: string | null };

/** Problemas que só se resolvem com um convite novo: o token guardado não serve mais. */
const TERMINAL: ReadonlySet<Problem> = new Set(["invalid", "expired", "already_linked", "owner_inactive", "self"]);

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function describeProblem(phase: Extract<Phase, { kind: "problem" }>): { title: string; description: string } {
  const who = phase.inviter || "quem convidou você";
  switch (phase.problem) {
    case "expired":
      return { title: "Este convite expirou", description: `Convites valem por 7 dias. Peça para ${who} reenviar pelo Orbi.` };
    case "email_mismatch":
      return {
        title: "Este convite é para outra conta",
        description: `Ele foi enviado para ${phase.invitedEmail ?? "outro e-mail"}. Entre com a conta do Orbi desse e-mail para aceitar.`,
      };
    case "email_unconfirmed":
      return {
        title: "Confirme seu e-mail primeiro",
        description: "Abra o link de confirmação que enviamos no seu cadastro e depois volte a este convite.",
      };
    case "already_linked":
      return {
        title: "Você já está em um Plano Casal",
        description: "Cada pessoa participa de um Plano Casal por vez. Para aceitar este, o vínculo atual precisa ser removido por quem criou o plano.",
      };
    case "owns_group":
      return {
        title: "Você já tem um Plano Casal",
        description: "Cancele o convite ou remova a pessoa do seu Plano Casal em Configurações e volte a este link.",
      };
    case "owner_inactive":
      return {
        title: `O Plano Casal de ${phase.inviter || "quem convidou você"} não está ativo`,
        description: "O compartilhamento volta quando a assinatura for regularizada. Peça um novo convite depois disso.",
      };
    case "self":
      return {
        title: "Este convite é seu",
        description: "Você enviou este convite. O aceite acontece na conta da pessoa convidada.",
      };
    case "network":
      return { title: "Não conseguimos abrir o convite", description: "Verifique sua conexão e tente de novo." };
    default:
      return {
        title: "Este convite não vale mais",
        description: "O link pode ter sido cancelado, trocado por um mais novo ou já usado. Peça um novo convite a quem chamou você.",
      };
  }
}

/**
 * `/invite/accept?token=` — aceite explícito do Plano Casal.
 *
 *   sem sessão   → entrar ou criar conta (o token fica guardado, volta sozinho)
 *   checking     → eclipse enquanto o banco diagnostica o link
 *   review       → quem convidou + o que muda + "Aceitar convite"
 *   syncing      → "Sincronizando universos…" (aceite + diretório do casal)
 *   united       → os dois em órbita: "Finanças unidas em uma só órbita."
 *   problem      → o que aconteceu e o próximo passo
 *
 * Autoridade: `orbi_family_invite_preview` / `orbi_family_invite_accept`
 * (conta do e-mail convidado, e-mail confirmado, dono ainda no Casal).
 */
export default function InviteAccept({ stage }: { stage: SessionStage }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [token] = useState(() => takeInviteToken());
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [attempt, setAttempt] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const fail = useCallback((result: InviteResult | { status: "network" }) => {
    const problem = result.status as Problem;
    if (TERMINAL.has(problem)) forgetInviteToken();
    setPhase({
      kind: "problem",
      problem,
      inviter: "inviter_name" in result ? result.inviter_name : null,
      invitedEmail: "invited_email" in result ? result.invited_email : null,
    });
  }, []);

  /** Vínculo feito: plano herdado, cota e grupo mudam; o diretório traz os dois rostos. */
  const unite = useCallback(
    async (inviter: string | null) => {
      forgetInviteToken();
      await Promise.all(
        [FAMILY_GROUP_QUERY_KEY, SUBSCRIPTION_QUERY_KEY, QUOTA_QUERY_KEY].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );

      let people = [] as ReturnType<typeof toAuthor>[];
      try {
        const { data } = await supabase.rpc("orbi_family_directory");
        people = (Array.isArray(data) ? (data as unknown as Parameters<typeof toAuthor>[0][]) : []).map(toAuthor);
      } catch {
        /* sem diretório a cena usa os nomes que já temos */
      }

      const me = people.find((person) => person.isSelf);
      const partner = people.find((person) => !person.isSelf);
      setPhase({
        kind: "united",
        me: { name: me?.name ?? "Você", avatarPath: me?.avatarPath ?? null },
        partner: { name: partner?.name ?? inviter ?? "Parceiro(a)", avatarPath: partner?.avatarPath ?? null },
      });
    },
    [queryClient],
  );

  useEffect(() => {
    if (stage !== "authenticated" || !token) return;
    let active = true;
    setPhase({ kind: "checking" });

    void (async () => {
      try {
        const { data, error } = await supabase.rpc("orbi_family_invite_preview", { p_token: token });
        if (error) throw error;
        if (!active) return;
        const result = data as unknown as InviteResult;
        if (result.status === "ready") setPhase({ kind: "review", inviter: result.inviter_name ?? null });
        else if (result.status === "accepted") await unite(result.inviter_name ?? null);
        else fail(result);
      } catch {
        if (active) fail({ status: "network" });
      }
    })();

    return () => {
      active = false;
    };
  }, [stage, token, attempt, unite, fail]);

  // Cada troca de estado leva o foco ao título: leitor de tela anuncia o novo passo.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [phase.kind]);

  const accept = async () => {
    if (phase.kind !== "review" || !token) return;
    const { inviter } = phase;
    setPhase({ kind: "syncing" });

    try {
      const [{ data, error }] = await Promise.all([
        supabase.rpc("orbi_family_invite_accept", { p_token: token }),
        wait(SYNC_MIN_MS),
      ]);
      if (error) throw error;
      const result = data as unknown as InviteResult;
      if (result.status === "accepted") await unite(result.inviter_name ?? inviter);
      else fail(result);
    } catch {
      setPhase({ kind: "review", inviter });
      toast({
        title: "Não foi possível aceitar agora",
        description: "Verifique sua conexão e tente de novo.",
        variant: "destructive",
      });
    }
  };

  const decline = () => {
    forgetInviteToken();
    navigate(AUTH_ROUTES.app, { replace: true });
  };

  const openDashboard = () => {
    setViewMode("couple");
    navigate(AUTH_ROUTES.app, { replace: true });
  };

  const switchAccount = async () => {
    await supabase.auth.signOut();
    navigate(loginPath(INVITE_ACCEPT_PATH), { replace: true });
  };

  if (stage === "mfa_required") return <Navigate to={mfaChallengePath()} replace />;

  const view = !token ? (
    <ProblemView
      phase={{ kind: "problem", problem: "invalid" }}
      headingRef={headingRef}
      actions={<PrimaryLink to={stage === "authenticated" ? AUTH_ROUTES.app : "/"}>Ir para o Orbi</PrimaryLink>}
    />
  ) : stage === "anonymous" ? (
    <Centered>
      <EnvelopeBeacon tone="waiting" />
      <Heading headingRef={headingRef}>Você recebeu um convite para o Plano Casal</Heading>
      <Lead>Entre ou crie sua conta com o e-mail que recebeu o convite para ver quem chamou você e decidir.</Lead>
      <Actions>
        <Button asChild size="lg" className="w-full rounded-full">
          <Link to={loginPath(INVITE_ACCEPT_PATH)} replace>
            Entrar para ver o convite
          </Link>
        </Button>
        <Button asChild variant="subtle" className="w-full">
          <Link to={`${AUTH_ROUTES.login}?modo=cadastro&next=${encodeURIComponent(INVITE_ACCEPT_PATH)}`} replace>
            Ainda não tenho conta
          </Link>
        </Button>
      </Actions>
    </Centered>
  ) : phase.kind === "checking" || phase.kind === "syncing" ? (
    <Centered>
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-8">
        <EclipseLoader />
        <Heading headingRef={headingRef} className="text-lg font-medium tracking-[-0.01em] text-muted-foreground md:text-lg">
          {phase.kind === "syncing" ? "Sincronizando universos…" : "Abrindo o convite…"}
        </Heading>
      </div>
    </Centered>
  ) : phase.kind === "review" ? (
    <ReviewView inviter={phase.inviter} headingRef={headingRef} onAccept={() => void accept()} onDecline={decline} />
  ) : phase.kind === "united" ? (
    <UnitedView me={phase.me} partner={phase.partner} headingRef={headingRef} onContinue={openDashboard} />
  ) : (
    <ProblemView
      phase={phase}
      headingRef={headingRef}
      actions={
        phase.problem === "email_mismatch" ? (
          <>
            <PrimaryButton onClick={() => void switchAccount()}>Entrar com outra conta</PrimaryButton>
            <Button variant="subtle" className="w-full" onClick={decline}>
              Agora não
            </Button>
          </>
        ) : phase.problem === "network" ? (
          <PrimaryButton onClick={() => setAttempt((n) => n + 1)}>Tentar de novo</PrimaryButton>
        ) : phase.problem === "owns_group" || phase.problem === "self" ? (
          <PrimaryLink to="/sistema/settings">Abrir Configurações</PrimaryLink>
        ) : (
          <PrimaryLink to={AUTH_ROUTES.app}>Ir para o Orbi</PrimaryLink>
        )
      }
    />
  );

  return (
    <main className="dark orbit-stage relative isolate flex min-h-[100svh] flex-col items-center overflow-hidden px-4 text-foreground">
      <header className="flex w-full max-w-5xl items-center py-4 md:py-6">
        <Link to="/" className="flex items-center gap-2.5 rounded-md" aria-label="Orbi — página inicial">
          <span className="orbit-mark" style={{ "--mark-w": "1.75rem" } as React.CSSProperties} aria-hidden>
            <img src={orbiLogo} alt="" width={500} height={500} decoding="async" draggable={false} />
          </span>
          <span className="font-display text-lg font-semibold tracking-[-0.02em]" translate="no" aria-hidden>
            Orbi
          </span>
        </Link>
      </header>
      <div className="flex w-full flex-1 flex-col items-center justify-center pb-16 pt-4">{view}</div>
    </main>
  );
}

/* ── Estados ─────────────────────────────────────────────────────────────── */

type HeadingRef = React.RefObject<HTMLHeadingElement>;

function ReviewView({
  inviter,
  headingRef,
  onAccept,
  onDecline,
}: {
  inviter: string | null;
  headingRef: HeadingRef;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const who = inviter ? <span translate="no">{inviter}</span> : null;

  return (
    <Centered>
      <div className="relative grid h-32 w-32 place-items-center animate-rise" aria-hidden>
        <span className="absolute inset-0 rounded-full border border-dashed border-foreground/10 motion-safe:animate-orbit-ring [animation-duration:60s]" />
        <span className="absolute inset-3 rounded-full bg-chart-6/10 blur-xl" />
        <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_2px_hsl(var(--primary)/0.7)]" />
        <span className="relative rounded-full border border-foreground/15 bg-foreground/[0.06] p-[3px] shadow-[0_0_28px_-2px_hsl(var(--chart-6)/0.5)]">
          <UserAvatar name={inviter} tone="partner" className="h-20 w-20 text-xl" />
        </span>
      </div>

      <div className="space-y-3 animate-rise [animation-delay:80ms]">
        <p className="label-eyebrow text-chart-6">Convite · Plano Casal</p>
        <Heading headingRef={headingRef} className="text-[1.5rem] leading-[1.15] md:text-[1.875rem]">
          {who ? <>{who} convidou você</> : "Você recebeu um convite"} para compartilhar o universo financeiro no Orbi
        </Heading>
      </div>

      <ul className="w-full space-y-3 text-left text-sm text-muted-foreground animate-rise [animation-delay:160ms]">
        <Fact icon={Eye}>Vocês dois passam a ver contas, cartões e lançamentos no Nosso espaço.</Fact>
        <Fact icon={PencilLine}>Os dois ajustam lançamentos um do outro; contas e cartões seguem com quem criou.</Fact>
        <Fact icon={Sparkles}>
          Você usa o plano de {who ?? "quem convidou você"} enquanto o Plano Casal estiver ativo.
        </Fact>
      </ul>

      <Actions className="animate-rise [animation-delay:240ms]">
        <PrimaryButton onClick={onAccept}>Aceitar convite</PrimaryButton>
        <Button variant="subtle" className="w-full" onClick={onDecline}>
          Agora não
        </Button>
      </Actions>
    </Centered>
  );
}

function UnitedView({
  me,
  partner,
  headingRef,
  onContinue,
}: {
  me: OrbitPerson;
  partner: OrbitPerson;
  headingRef: HeadingRef;
  onContinue: () => void;
}) {
  return (
    <Centered className="max-w-xl gap-10 md:gap-12">
      <OrbitUnion me={me} partner={partner} />

      <div className="flex flex-col items-center gap-4">
        <p
          className="flex items-center gap-3 font-display text-base font-medium tracking-[-0.01em] text-foreground/80 animate-rise [animation-delay:1100ms]"
          translate="no"
        >
          <NameDot tone="self" />
          {me.name}
          <span className="text-muted-foreground" aria-hidden>
            &
          </span>
          <span className="sr-only">e</span>
          <NameDot tone="partner" />
          {partner.name}
        </p>
        <Heading
          headingRef={headingRef}
          className="max-w-[18ch] text-[2rem] leading-[1.06] tracking-[-0.035em] animate-rise [animation-delay:1200ms] md:text-[2.75rem]"
        >
          Finanças unidas em uma só órbita.
        </Heading>
        <Lead className="animate-rise [animation-delay:1300ms]">
          A partir de agora, o Nosso espaço mostra as contas, cartões e lançamentos de vocês dois.
        </Lead>
      </div>

      <Button
        size="lg"
        variant="outline"
        onClick={onContinue}
        className="group h-12 rounded-full border-foreground/15 bg-foreground/[0.04] px-6 animate-rise [animation-delay:1450ms] hover:border-foreground/30 hover:bg-foreground/[0.08] md:h-12"
      >
        Acessar nosso Dashboard
        <ArrowRight
          className="transition-transform duration-200 ease-swift motion-safe:group-hover:translate-x-0.5"
          aria-hidden
        />
      </Button>
    </Centered>
  );
}

function ProblemView({
  phase,
  headingRef,
  actions,
}: {
  phase: Extract<Phase, { kind: "problem" }>;
  headingRef: HeadingRef;
  actions: React.ReactNode;
}) {
  const { title, description } = describeProblem(phase);
  return (
    <Centered>
      <EnvelopeBeacon tone="invalid" />
      <Heading headingRef={headingRef}>{title}</Heading>
      <Lead className="[overflow-wrap:anywhere]">{description}</Lead>
      <Actions>{actions}</Actions>
    </Centered>
  );
}

/* ── Peças ───────────────────────────────────────────────────────────────── */

function Centered({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex w-full max-w-md flex-col items-center gap-6 text-center", className)}>{children}</section>
  );
}

function Heading({
  children,
  headingRef,
  className,
}: {
  children: React.ReactNode;
  headingRef: HeadingRef;
  className?: string;
}) {
  return (
    <h1 ref={headingRef} tabIndex={-1} className={cn("text-balance outline-none md:text-[2rem]", className)}>
      {children}
    </h1>
  );
}

function Lead({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("max-w-[40ch] text-pretty text-base text-muted-foreground", className)}>{children}</p>;
}

function Actions({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex w-full max-w-xs flex-col items-stretch gap-2 pt-2", className)}>{children}</div>;
}

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <Button size="lg" className="w-full rounded-full" onClick={onClick}>
      {children}
    </Button>
  );
}

function PrimaryLink({ children, to }: { children: React.ReactNode; to: string }) {
  return (
    <Button asChild size="lg" className="w-full rounded-full">
      <Link to={to} replace>
        {children}
      </Link>
    </Button>
  );
}

function Fact({ icon: Icon, children }: { icon: typeof Eye; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-foreground/60" strokeWidth={1.75} aria-hidden />
      <span className="text-pretty">{children}</span>
    </li>
  );
}

function NameDot({ tone }: { tone: "self" | "partner" }) {
  return (
    <span
      className={cn(
        "h-2 w-2 rounded-full",
        tone === "self"
          ? "bg-primary shadow-[0_0_10px_1px_hsl(var(--primary)/0.7)]"
          : "bg-chart-6 shadow-[0_0_10px_1px_hsl(var(--chart-6)/0.7)]",
      )}
      aria-hidden
    />
  );
}
