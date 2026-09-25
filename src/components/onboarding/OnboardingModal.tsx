import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CreditCard,
  FileUp,
  Loader2,
  Repeat,
  Telescope,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { insertAccount } from "@/hooks/use-accounts";
import { useFamilyGroup } from "@/hooks/use-family-group";
import { useFeature } from "@/hooks/use-feature";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useProfile } from "@/hooks/use-profile";
import { QUOTA_QUERY_KEY } from "@/hooks/use-quota";
import { useToast } from "@/hooks/use-toast";
import { diagnoseLimitError } from "@/lib/limits";
import { cn, formatCurrencyBRL, roundCurrency } from "@/lib/utils";

/**
 * Primeiro acesso — três passos, montado uma vez no `AppLayout`.
 *
 *   0  Boas-vindas     o que o Orbi organiza
 *   1  Primeira conta  nome, tipo e saldo de hoje (INSERT real em `accounts`)
 *   2  Diferenciais    Nosso espaço (Casal) e Motor preditivo
 *
 * A faixa de órbita no topo é o fio da jornada: cada passo acende um satélite
 * (a conta criada ganha a cor dela; o passo 3 acende parceiro e previsão).
 *
 * Movimento: CSS puro (`framer-motion` é bloqueado pela política de pacotes).
 * Só transform/opacity/fill; troca de passo reaproveita as entradas laterais
 * do seletor de espaço (avançar ←, voltar →). `motion-safe` em tudo que se move.
 *
 * Saída: "Pular", Esc, "Ir para o painel" ou um dos atalhos do passo 3 gravam
 * `onboarding_completed = true` — a introdução não volta. Clique fora não fecha.
 */

const STEP_COUNT = 3;

/** Cor por tipo: tons médios que leem nos dois temas e viram a faixa da conta em Contas. */
const ACCOUNT_TYPES = [
  { value: "Corrente", label: "Corrente", color: "#3F6FA8" },
  { value: "Poupança", label: "Poupança", color: "#1F8A66" },
  { value: "Carteira", label: "Carteira", color: "#C07A2C" },
] as const;

type AccountTypeValue = (typeof ACCOUNT_TYPES)[number]["value"];

const colorOf = (type: AccountTypeValue) => ACCOUNT_TYPES.find((option) => option.value === type)?.color ?? ACCOUNT_TYPES[0].color;

interface CreatedAccount {
  name: string;
  type: string;
  initial_balance: number;
  color: string;
}

export function OnboardingModal() {
  const { needsOnboarding, complete } = useOnboarding();
  const { toast } = useToast();

  const finish = useCallback(async () => {
    try {
      await complete();
    } catch {
      toast({
        title: "Não foi possível salvar",
        description: "A introdução pode aparecer de novo no próximo acesso.",
        variant: "destructive",
      });
    }
  }, [complete, toast]);

  return (
    <Dialog
      open={needsOnboarding}
      onOpenChange={(open) => {
        if (!open) void finish();
      }}
    >
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          // Foco inicial vai para o título do passo (efeito do fluxo), não para "Pular".
          onOpenAutoFocus={(event) => event.preventDefault()}
          // Introdução não some por um clique acidental fora dela.
          onInteractOutside={(event) => event.preventDefault()}
          className={cn(
            "fixed left-[50%] top-[50%] z-50 flex translate-x-[-50%] translate-y-[-50%] flex-col",
            "w-[calc(100vw-1.5rem)] max-w-[30rem] max-h-[calc(100svh-2rem)] overflow-hidden",
            "rounded-xl border bg-background shadow-lg outline-none",
            "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <OnboardingFlow onFinish={finish} />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

function OnboardingFlow({ onFinish }: { onFinish: () => Promise<void> }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { profile } = useProfile();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"next" | "back" | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountTypeValue>("Corrente");
  const [balance, setBalance] = useState(0);
  const [nameError, setNameError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedAccount | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // A cada passo o foco vai para o título (leitor de tela anuncia o passo).
  // No formulário, com mouse, direto no nome — no celular o teclado abrindo
  // empurraria o layout.
  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (step === 1 && finePointer && nameRef.current) nameRef.current.focus();
    else headingRef.current?.focus();
  }, [step]);

  const go = (to: number) => {
    setDirection(to > step ? "next" : "back");
    setStep(to);
  };

  const firstName = (profile?.displayName || profile?.fullName || "").trim().split(/\s+/)[0];

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (created) return go(2);

    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Dê um nome à conta.");
      nameRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      const account = await insertAccount({
        name: trimmed,
        type,
        initial_balance: roundCurrency(balance),
        color: colorOf(type),
      });
      setCreated({
        name: account.name,
        type: account.type,
        initial_balance: account.initial_balance,
        color: account.color ?? colorOf(type),
      });
      toast({ title: "Conta criada", duration: 2500 });
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["balances"] }),
        queryClient.invalidateQueries({ queryKey: ["projected-balances"] }),
        queryClient.invalidateQueries({ queryKey: QUOTA_QUERY_KEY }),
      ]);
    } catch (error) {
      const diagnosis = diagnoseLimitError(error);
      toast({
        title: "Não foi possível criar a conta",
        description: diagnosis.kind === "unknown" ? "Confira os dados e tente de novo." : diagnosis.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const goToDashboard = () => {
    void onFinish();
    navigate("/sistema");
  };

  const accountColor = created?.color ?? colorOf(type);

  return (
    <>
      {/* Faixa da órbita: progresso + saída. */}
      <div className="relative h-28 shrink-0 overflow-hidden border-b border-border-subtle bg-surface-sunken sm:h-40">
        <OrbitScene step={step} accountColor={accountColor} accountLit={Boolean(created) || name.trim() !== ""} />

        <div className="absolute left-4 top-4 flex items-center gap-2.5 sm:left-5">
          <ol className="flex items-center gap-1" aria-hidden>
            {Array.from({ length: STEP_COUNT }, (_, index) => (
              <li
                key={index}
                className={cn(
                  "h-1 w-5 rounded-full transition-colors duration-300 ease-swift",
                  index <= step ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </ol>
          <p className="text-2xs tabular text-muted-foreground">
            <span className="sr-only">Passo </span>
            {step + 1} de {STEP_COUNT}
          </p>
        </div>

        {step < STEP_COUNT - 1 && (
          <Button
            variant="subtle"
            size="sm"
            onClick={() => void onFinish()}
            className="absolute right-2 top-1.5 sm:right-3 sm:top-2"
          >
            Pular<span className="sr-only"> introdução</span>
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-5 sm:px-6 sm:pt-6">
        {/* `key` remonta o passo: a entrada lateral roda uma vez por troca.
            Reaproveita as keyframes do seletor de espaço (±10px + blur 3px). */}
        <div
          key={step}
          className={cn(
            "sm:min-h-[23rem]",
            direction === "next" && "motion-safe:animate-space-in-we",
            direction === "back" && "motion-safe:animate-space-in-me",
          )}
        >
          {step === 0 && (
            <>
              <StepHeader
                headingRef={headingRef}
                eyebrow={firstName ? `Olá, ${firstName}` : "Boas-vindas ao Orbi"}
                title="Seu dinheiro inteiro, em uma só órbita"
                description="Contas, cartões e planos no mesmo painel, com o saldo de hoje e o de amanhã. Em menos de um minuto, o seu deixa de estar vazio."
              />
              <ul className="mt-6 space-y-3.5 border-t border-border-subtle pt-5">
                <Highlight icon={Repeat}>Extrato do mês com parcelas, recorrências e rateios no lugar certo</Highlight>
                <Highlight icon={CreditCard}>Fatura do cartão pelo ciclo real de fechamento, não pelo calendário</Highlight>
                <Highlight icon={FileUp}>Extrato em PDF, OFX ou CSV importado e categorizado para você</Highlight>
              </ul>
            </>
          )}

          {step === 1 && (
            <>
              <StepHeader
                headingRef={headingRef}
                eyebrow="Primeira conta"
                title="Onde seu dinheiro está hoje?"
                description="Cadastre a conta que você mais usa com o saldo atual. Daqui em diante, o Orbi acompanha cada entrada e saída."
              />

              {created ? (
                <div className="mt-6 motion-safe:animate-rise">
                  <div className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-card py-3.5 pl-5 pr-4">
                    <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: created.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{created.name}</p>
                      <p className="label-eyebrow mt-0.5">{created.type}</p>
                    </div>
                    <p className={cn("figure-md shrink-0", created.initial_balance < 0 && "text-destructive")}>
                      {formatCurrencyBRL(created.initial_balance)}
                    </p>
                  </div>
                  <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    Pronto. Cor, nome e saldo podem ser ajustados depois em Contas.
                  </p>
                </div>
              ) : (
                <form id="onboarding-account" noValidate onSubmit={handleCreate} className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="onboarding-account-name">Nome da conta</Label>
                    <Input
                      ref={nameRef}
                      id="onboarding-account-name"
                      name="account-name"
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        setNameError(undefined);
                      }}
                      placeholder="Nubank, Itaú, Carteira…"
                      maxLength={120}
                      autoComplete="off"
                      spellCheck={false}
                      aria-invalid={Boolean(nameError)}
                      aria-describedby={nameError ? "onboarding-account-name-error" : undefined}
                    />
                    {nameError && (
                      <p id="onboarding-account-name-error" className="text-xs text-destructive" role="alert">
                        {nameError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p id="onboarding-account-type" className="text-sm font-medium leading-none">
                      Tipo
                    </p>
                    <ToggleGroup
                      type="single"
                      value={type}
                      onValueChange={(value) => value && setType(value as AccountTypeValue)}
                      aria-labelledby="onboarding-account-type"
                      className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-surface-sunken p-1"
                    >
                      {ACCOUNT_TYPES.map((option) => (
                        <ToggleGroupItem key={option.value} value={option.value} size="sm" className="w-full px-2">
                          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: option.color }} />
                          {option.label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="onboarding-account-balance">Saldo de hoje</Label>
                    <NumericInput
                      id="onboarding-account-balance"
                      currency
                      allowNegative
                      value={balance}
                      onChange={(value) => setBalance(value ?? 0)}
                      placeholder="0,00"
                      aria-describedby="onboarding-account-balance-hint"
                    />
                    <p id="onboarding-account-balance-hint" className="text-xs text-muted-foreground">
                      No cheque especial? Informe o valor negativo.
                    </p>
                  </div>
                </form>
              )}
            </>
          )}

          {step === 2 && <DifferentialsStep headingRef={headingRef} onFinish={onFinish} />}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border-subtle px-5 py-4 sm:justify-end sm:px-6 [&>*]:flex-1 sm:[&>*]:flex-none">
        {step === 0 && (
          <Button onClick={() => go(1)}>
            Começar
            <ArrowRight aria-hidden />
          </Button>
        )}

        {step === 1 &&
          (created ? (
            <Button onClick={() => go(2)}>
              Continuar
              <ArrowRight aria-hidden />
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => go(2)} disabled={saving}>
                Criar depois
              </Button>
              <Button type="submit" form="onboarding-account" disabled={saving}>
                {saving && <Loader2 className="animate-spin" aria-hidden />}
                Criar conta
              </Button>
            </>
          ))}

        {step === 2 && (
          <>
            <Button variant="ghost" onClick={() => go(1)}>
              <ArrowLeft aria-hidden />
              Voltar
            </Button>
            <Button onClick={goToDashboard}>Ir para o painel</Button>
          </>
        )}
      </div>
    </>
  );
}

function StepHeader({
  headingRef,
  eyebrow,
  title,
  description,
}: {
  headingRef: RefObject<HTMLHeadingElement>;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header>
      <p className="label-eyebrow">{eyebrow}</p>
      <DialogTitle
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 pr-0 text-xl tracking-[-0.02em] text-balance outline-none md:text-2xl"
      >
        {title}
      </DialogTitle>
      <DialogDescription className="mt-2 leading-relaxed text-pretty">{description}</DialogDescription>
    </header>
  );
}

function Highlight({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm text-foreground">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="text-pretty">{children}</span>
    </li>
  );
}

function DifferentialsStep({
  headingRef,
  onFinish,
}: {
  headingRef: RefObject<HTMLHeadingElement>;
  onFinish: () => Promise<void>;
}) {
  const casal = useFeature("familia_compartilhada");
  const forecast = useFeature("motor_preditivo");
  const { isLinked } = useFamilyGroup();

  // Sem a feature, o convite leva ao upgrade (padrão do sistema); a projeção
  // já tem a tela de prévia do próprio `PremiumRoute`.
  const casalTo = isLinked || casal.hasFeature ? "/sistema/settings" : "/pricing?change=1";
  const casalTag = isLinked ? "Ativo" : casal.hasFeature || casal.isLoading ? null : "Plano Casal";
  const forecastTag = forecast.hasFeature || forecast.isLoading ? null : "Pro e Casal";

  return (
    <>
      <StepHeader
        headingRef={headingRef}
        eyebrow="Além do extrato"
        title="Planeje a dois e veja o saldo de amanhã"
        description="Dois recursos para quando o básico estiver rodando."
      />
      <div className="mt-6 space-y-3">
        <FeatureLink to={casalTo} icon={Users} title="Nosso espaço" tag={casalTag} onSelect={onFinish}>
          {isLinked
            ? "Você já divide o Orbi com alguém. Troque entre Meu e Nosso espaço no topo da tela."
            : "Convide quem divide as contas com você. Cada um no seu login, o mesmo painel para os dois e o autor em cada lançamento."}
        </FeatureLink>
        <FeatureLink to="/sistema/forecast" icon={Telescope} title="Motor preditivo" tag={forecastTag} onSelect={onFinish}>
          Seu saldo projetado dia a dia, com faturas, parcelas e contas fixas já descontadas. Você sabe antes o dia em que o
          dinheiro aperta.
        </FeatureLink>
      </div>
    </>
  );
}

function FeatureLink({
  to,
  icon: Icon,
  title,
  tag,
  onSelect,
  children,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  tag: string | null;
  onSelect: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={() => void onSelect()}
      className={cn(
        "group flex items-start gap-3 rounded-xl border border-border bg-card p-4",
        "transition-[border-color,background-color,transform] duration-200 ease-swift",
        "hover:border-ring/45 hover:bg-accent/40 motion-safe:active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors duration-200 group-hover:text-foreground"
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-foreground">
          {title}
          {tag && (
            <span className="rounded-full border border-border px-1.5 py-px text-2xs font-medium text-muted-foreground">
              {tag}
            </span>
          )}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground text-pretty">{children}</span>
      </span>
      <ChevronRight
        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-swift group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

/* ── Órbita ──────────────────────────────────────────────────────────────── */

const CENTER = { x: 160, y: 80 };
/** Rotação em torno do centro do viewBox: `view-box` evita o bug de origem do Safari em SVG. */
const SPIN_ORIGIN = { transformBox: "view-box", transformOrigin: `${CENTER.x}px ${CENTER.y}px` } as const;
const SELF_ORIGIN = { transformBox: "fill-box", transformOrigin: "center" } as const;
const PRIMARY = "hsl(var(--primary))";

function pointOn(radius: number, degrees: number) {
  const rad = (degrees * Math.PI) / 180;
  return { cx: CENTER.x + radius * Math.cos(rad), cy: CENTER.y + radius * Math.sin(rad) };
}

function OrbitScene({ step, accountColor, accountLit }: { step: number; accountColor: string; accountLit: boolean }) {
  const onDifferentials = step >= 2;

  return (
    <svg
      viewBox="0 0 320 160"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 h-full w-full"
      aria-hidden
      focusable="false"
    >
      {/* Anel interno: a conta. */}
      <g className="motion-safe:animate-orbit-ring" style={{ ...SPIN_ORIGIN, animationDuration: "70s" }}>
        <circle cx={CENTER.x} cy={CENTER.y} r={30} className="fill-none stroke-border" strokeWidth={1} />
        <Satellite {...pointOn(30, -40)} lit={step >= 1 && accountLit} color={accountColor} />
      </g>

      {/* Anel médio, tracejado e em sentido contrário: o parceiro. */}
      <g
        className="motion-safe:animate-orbit-ring [animation-direction:reverse]"
        style={{ ...SPIN_ORIGIN, animationDuration: "110s" }}
      >
        <circle cx={CENTER.x} cy={CENTER.y} r={52} className="fill-none stroke-border" strokeWidth={1} strokeDasharray="2 5" />
        <Satellite {...pointOn(52, 200)} lit={onDifferentials} color={PRIMARY} />
        <circle {...pointOn(52, 60)} r={1.5} className="fill-muted-foreground/40" />
      </g>

      {/* Anel externo: a previsão. */}
      <g className="motion-safe:animate-orbit-ring" style={{ ...SPIN_ORIGIN, animationDuration: "160s" }}>
        <circle cx={CENTER.x} cy={CENTER.y} r={74} className="fill-none stroke-border-subtle" strokeWidth={1} />
        <Satellite {...pointOn(74, 20)} lit={onDifferentials} color={PRIMARY} />
        <circle {...pointOn(74, 250)} r={1.5} className="fill-muted-foreground/40" />
      </g>

      {/* Você, no centro. */}
      <circle cx={CENTER.x} cy={CENTER.y} r={13} className="fill-primary/10" />
      <circle
        cx={CENTER.x}
        cy={CENTER.y}
        r={13}
        className="fill-none stroke-primary/40 motion-safe:animate-halo"
        strokeWidth={1}
        style={SELF_ORIGIN}
      />
      <circle cx={CENTER.x} cy={CENTER.y} r={5.5} className="fill-primary" />
    </svg>
  );
}

/** Apagado = ponto neutro menor; aceso = cor própria + halo, assentando em 500ms. */
function Satellite({ cx, cy, lit, color }: { cx: number; cy: number; lit: boolean; color: string }) {
  return (
    <g
      style={SELF_ORIGIN}
      className={cn(
        "transition-[transform,opacity] duration-500 ease-entrance",
        lit ? "scale-100 opacity-100" : "scale-[0.6] opacity-70",
      )}
    >
      <circle
        cx={cx}
        cy={cy}
        r={9}
        style={{ fill: color }}
        className={cn("transition-opacity duration-500", lit ? "opacity-20" : "opacity-0")}
      />
      <circle
        cx={cx}
        cy={cy}
        r={4}
        style={lit ? { fill: color } : undefined}
        className={cn("transition-[fill] duration-500", !lit && "fill-muted-foreground/60")}
      />
    </g>
  );
}
