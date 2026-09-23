import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import orbiLogoDark from "@/assets/orbi-logo_dark.png";
import orbiLogoLight from "@/assets/orbi-logo_white.png";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { LegalConsentCheckbox, LegalConsentNotice } from "@/components/legal";
import { cn } from "@/lib/utils";
import { AUTH_ROUTES } from "@/lib/auth/redirect";
import { TurnstileField } from "@/components/auth/TurnstileField";
import { PasswordField, PasswordMatchHint, PasswordStrengthHint } from "@/components/auth/PasswordField";
import { EmailNotConfirmedDialog } from "@/components/auth/EmailNotConfirmedDialog";
import { useTurnstile } from "@/hooks/use-turnstile";
import { evaluatePassword } from "@/lib/password-strength";
import {
  LOGIN_DEFAULTS,
  loginSchema,
  normalizeEmail,
  REGISTER_DEFAULTS,
  registerSchema,
  type LoginValues,
  type RegisterValues,
} from "@/lib/validation/auth-forms";

/** Data/hora do build em horário de Brasília (ex.: 23/09/2026, 08:03). */
const BUILD_DATE_LABEL = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
}).format(new Date(__BUILD_TIME__));

/** Item do segmented control: o fundo ativo é do thumb, não do item. */
const segmentTrigger =
  "data-[state=active]:border-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none";

/**
 * Erro de campo. Entra em 250ms com o ícone — o olho encontra o problema
 * pelo movimento, não por varrer o formulário procurando texto vermelho.
 */
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-1.5 text-xs font-medium text-destructive motion-safe:animate-fade-in"
    >
      <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="leading-relaxed">{message}</span>
    </p>
  );
}

/**
 * Login e cadastro.
 *
 * Validação em Zod + React Hook Form (`@/lib/validation/auth-forms`), com
 * `mode: "onTouched"`: nada acusa erro enquanto a pessoa ainda digita pela
 * primeira vez, e a partir do primeiro blur o campo passa a corrigir sozinho.
 *
 * O cadastro tem confirmação de senha (`.refine` no schema), medidor de força
 * e o aceite legal explícito. O login intercepta `email_not_confirmed` e abre
 * um diálogo com reenvio em vez de um toast sem saída.
 */
export function AuthForm() {
  const { theme } = useTheme();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"login" | "register">(() =>
    searchParams.get("modo") === "cadastro" ? "register" : "login",
  );
  const { login, register: registerAccount } = useAuth();
  const navigate = useNavigate();

  // Um widget por aba: o Radix desmonta a aba inativa, então cada formulário tem seu próprio token.
  const loginCaptcha = useTurnstile();
  const registerCaptcha = useTurnstile();

  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: LOGIN_DEFAULTS,
    mode: "onTouched",
  });

  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: REGISTER_DEFAULTS,
    mode: "onTouched",
  });

  const watchedPassword = registerForm.watch("password");
  const watchedConfirm = registerForm.watch("confirmPassword");
  const watchedEmail = registerForm.watch("email");
  const evaluation = useMemo(() => evaluatePassword(watchedPassword, watchedEmail), [watchedPassword, watchedEmail]);

  /** Leva o e-mail já digitado para a tela de recuperação (via state, nunca na URL). */
  const goToForgotPassword = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    const email = loginForm.getValues("email").trim();
    navigate(AUTH_ROUTES.forgotPassword, { state: email ? { email } : undefined });
  };

  const onLogin = async (values: LoginValues) => {
    if (loginCaptcha.blocking) return;
    const email = normalizeEmail(values.email);

    try {
      await login(email, values.password, loginCaptcha.captchaToken, {
        onEmailNotConfirmed: (target) => setUnconfirmedEmail(target),
      });
    } finally {
      // Token Turnstile é de uso único: queimado com sucesso ou erro.
      loginCaptcha.reset();
    }
  };

  const onRegister = async (values: RegisterValues) => {
    if (registerCaptcha.blocking) return;

    try {
      await registerAccount(
        normalizeEmail(values.email),
        values.password,
        values.fullName.trim(),
        registerCaptcha.captchaToken,
      );
    } finally {
      registerCaptcha.reset();
    }
  };

  const loginBusy = loginForm.formState.isSubmitting;
  const registerBusy = registerForm.formState.isSubmitting;
  const { errors: loginErrors } = loginForm.formState;
  const { errors: registerErrors } = registerForm.formState;

  return (
    <div className="relative min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-safe pt-safe">
        {/* Mobile: no fluxo, alinhado à borda do card. md+: fixo no canto
            superior direito da VIEWPORT (fora da coluna max-w-md), sem mexer
            na centralização do card. */}
        <header
          className="flex h-14 shrink-0 items-center justify-end md:absolute md:right-8 md:top-6 md:z-10 md:h-auto"
          aria-label="Preferências de aparência"
        >
          <ThemeToggle />
        </header>

        <EmailNotConfirmedDialog
          open={unconfirmedEmail !== null}
          onOpenChange={(open) => !open && setUnconfirmedEmail(null)}
          email={unconfirmedEmail ?? ""}
          captchaToken={loginCaptcha.captchaToken}
        />

        <main className="flex flex-1 items-center justify-center pb-4">
          <Card variant="elevated" className="w-full animate-rise">
        <CardHeader className="items-center gap-1 pb-5 text-center">
          <h1 className="sr-only">Entrar ou criar conta no Orbi</h1>
          <img
            src={theme === 'dark' ? orbiLogoDark : orbiLogoLight}
            alt="Logotipo do Orbi"
            width={64}
            height={64}
            decoding="async"
            className="h-16 w-16 object-contain"
          />
          <CardTitle className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
            Orbi
          </CardTitle>
          <CardDescription className="max-w-[24ch] text-balance">
            Gerencie suas finanças de forma inteligente
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "login" | "register")}>
            {/* Segmented control com thumb deslizante. Uma única superfície de
                card (o thumb) desliza entre as duas colunas em vez de cada item
                pintar e apagar o próprio fundo. Geometria: o thumb ocupa
                exatamente uma coluna — left 4px + (50% do padding-box − 4px) —
                e `translate-x-full` o leva para a segunda. Gutter uniforme de
                4px nos quatro lados, raio concêntrico ao trilho. */}
            <TabsList className="relative isolate mb-4 grid w-full grid-cols-2 gap-0">
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-y-1 left-1 -z-10 w-[calc(50%-0.25rem)] rounded-lg border border-border bg-card shadow-sm",
                  "transition-transform duration-300 ease-swift will-change-transform motion-reduce:transition-none",
                  activeTab === "register" ? "translate-x-full" : "translate-x-0",
                )}
              />
              <TabsTrigger value="login" className={segmentTrigger}>
                Entrar
              </TabsTrigger>
              <TabsTrigger value="register" className={segmentTrigger}>
                Criar Conta
              </TabsTrigger>
            </TabsList>

            {/* ------------------------------------------------------------- */}
            {/* Entrar                                                         */}
            {/* ------------------------------------------------------------- */}
            <TabsContent value="login" className="motion-safe:animate-fade-in">
              <form onSubmit={loginForm.handleSubmit(onLogin)} noValidate className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={254}
                    placeholder="seu@email.com"
                    aria-invalid={loginErrors.email ? true : undefined}
                    aria-describedby={loginErrors.email ? "email-error" : undefined}
                    disabled={loginBusy}
                    {...loginForm.register("email")}
                  />
                  <FieldError id="email-error" message={loginErrors.email?.message} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <Label htmlFor="password">Senha</Label>
                    <Link
                      to={AUTH_ROUTES.forgotPassword}
                      onClick={goToForgotPassword}
                      className="-my-2 rounded-sm py-2 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors duration-150 ease-swift hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Esqueci minha senha
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    aria-invalid={loginErrors.password ? true : undefined}
                    aria-describedby={loginErrors.password ? "password-error" : undefined}
                    disabled={loginBusy}
                    {...loginForm.register("password")}
                  />
                  <FieldError id="password-error" message={loginErrors.password?.message} />
                </div>

                <TurnstileField {...loginCaptcha.fieldProps} action="login" />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginBusy || loginCaptcha.blocking}
                >
                  {loginBusy && <Loader2 className="animate-spin" aria-hidden />}
                  {loginBusy ? "Entrando..." : loginCaptcha.blocking ? "Verificando conexão…" : "Entrar"}
                </Button>

                {/* Disclaimer sutil: informa sem pedir novo opt-in — o aceite
                    formal ocorre no cadastro. */}
                <LegalConsentNotice className="pt-1" />
              </form>
            </TabsContent>

            {/* ------------------------------------------------------------- */}
            {/* Criar conta                                                    */}
            {/* ------------------------------------------------------------- */}
            <TabsContent value="register" className="motion-safe:animate-fade-in">
              <form onSubmit={registerForm.handleSubmit(onRegister)} noValidate className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Nome Completo</Label>
                  <Input
                    id="register-name"
                    type="text"
                    autoComplete="name"
                    maxLength={80}
                    placeholder="Seu nome completo"
                    aria-invalid={registerErrors.fullName ? true : undefined}
                    aria-describedby={registerErrors.fullName ? "register-name-error" : undefined}
                    disabled={registerBusy}
                    {...registerForm.register("fullName")}
                  />
                  <FieldError id="register-name-error" message={registerErrors.fullName?.message} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-email">E-mail</Label>
                  <Input
                    id="register-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={254}
                    placeholder="seu@email.com"
                    aria-invalid={registerErrors.email ? true : undefined}
                    aria-describedby={registerErrors.email ? "register-email-error" : undefined}
                    disabled={registerBusy}
                    {...registerForm.register("email")}
                  />
                  <FieldError id="register-email-error" message={registerErrors.email?.message} />
                </div>

                <PasswordField
                  id="register-password"
                  label="Senha"
                  autoComplete="new-password"
                  maxLength={128}
                  placeholder="••••••••"
                  disabled={registerBusy}
                  error={registerErrors.password?.message ?? null}
                  hint={<PasswordStrengthHint evaluation={evaluation} />}
                  {...registerForm.register("password")}
                />

                {/* Repita a senha: o erro de divergência vem do `.refine` do
                    schema; o acerto vira confirmação verde imediata. */}
                <PasswordField
                  id="register-confirm-password"
                  label="Repita a senha"
                  autoComplete="new-password"
                  maxLength={128}
                  placeholder="••••••••"
                  disabled={registerBusy}
                  error={registerErrors.confirmPassword?.message ?? null}
                  hint={
                    <PasswordMatchHint
                      matches={watchedConfirm.length > 0 && watchedConfirm === watchedPassword}
                    />
                  }
                  {...registerForm.register("confirmPassword")}
                />

                <Controller
                  control={registerForm.control}
                  name="acceptedTerms"
                  render={({ field }) => (
                    <LegalConsentCheckbox
                      id="register-legal-consent"
                      checked={field.value}
                      onCheckedChange={(value) => {
                        field.onChange(value);
                        if (value) registerForm.clearErrors("acceptedTerms");
                      }}
                      error={registerErrors.acceptedTerms?.message ?? null}
                      disabled={registerBusy}
                      className="pt-1"
                    />
                  )}
                />

                <TurnstileField {...registerCaptcha.fieldProps} action="signup" />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerBusy || registerCaptcha.blocking}
                >
                  {registerBusy && <Loader2 className="animate-spin" aria-hidden />}
                  {registerBusy
                    ? "Criando conta..."
                    : registerCaptcha.blocking
                      ? "Verificando conexão…"
                      : "Criar Conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
          </Card>
        </main>

        {/* Mobile: no fluxo, abaixo do card (não sobrepõe o formulário longo de
            cadastro). md+: fixo no canto inferior direito da viewport, espelhando
            o toggle de tema no canto superior. */}
        <footer className="shrink-0 pb-3 text-right text-[0.6875rem] tabular-nums text-muted-foreground md:absolute md:bottom-4 md:right-8 md:pb-0">
          <span className="sr-only">Versão do sistema: </span>
          <span translate="no">{__BUILD_COMMIT__}</span>
          <span aria-hidden="true"> · </span>
          <time dateTime={__BUILD_TIME__}>{BUILD_DATE_LABEL}</time>
        </footer>
      </div>
    </div>
  );
}
