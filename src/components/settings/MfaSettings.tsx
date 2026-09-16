import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, Loader2, ShieldCheck, ShieldOff } from "lucide-react";

import { TotpCodeInput } from "@/components/auth/TotpCodeInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { describeAuthError } from "@/lib/auth/auth-errors";
import {
  cancelTotpEnrollment,
  confirmTotpEnrollment,
  disableTotp,
  getMfaStatus,
  startTotpEnrollment,
  TOTP_CODE_LENGTH,
  type MfaStatus,
  type TotpEnrollment,
} from "@/services/auth/mfa";

type View = "loading" | "load_error" | "off" | "enrolling" | "on" | "disabling";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

/** "JBSWY3DPEHPK3PXP" → "JBSW Y3DP EHPK 3PXP": digitável sem se perder. */
const groupSecret = (secret: string) => secret.replace(/=+$/, "").replace(/(.{4})/g, "$1 ").trim();

/**
 * Configurações → Segurança → Verificação em duas etapas (TOTP).
 *
 * off → enrolling (QR + chave + 1º código) → on → disabling (código novo) → off
 *
 * Toda chamada ao Supabase vive em `src/services/auth/mfa.ts`. O segredo só
 * existe em memória enquanto a tela de configuração está aberta — nunca em
 * log, storage ou query key.
 */
export function MfaSettings() {
  const { toast } = useToast();
  const baseId = useId();
  const codeRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  const [view, setView] = useState<View>("loading");
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setView("loading");
    setActionError(null);
    try {
      const next = await getMfaStatus();
      setStatus(next);
      setView(next.enabled ? "on" : "off");
    } catch (error) {
      setActionError(describeAuthError(error, "mfa"));
      setView("load_error");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Inscrição abandonada (saiu da aba/página) não deixa fator pendurado.
  const enrollmentRef = useRef<TotpEnrollment | null>(null);
  enrollmentRef.current = enrollment;
  useEffect(
    () => () => {
      if (enrollmentRef.current) void cancelTotpEnrollment(enrollmentRef.current.factorId);
    },
    [],
  );

  useEffect(() => {
    if (view === "enrolling" || view === "disabling") codeRef.current?.focus();
  }, [view]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const resetCode = () => {
    setCode("");
    setCodeError(null);
  };

  const run = async (task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setIsWorking(true);
    try {
      await task();
    } finally {
      busyRef.current = false;
      setIsWorking(false);
    }
  };

  const startEnrollment = () =>
    run(async () => {
      setActionError(null);
      try {
        const next = await startTotpEnrollment();
        resetCode();
        setEnrollment(next);
        setView("enrolling");
      } catch (error) {
        setActionError(describeAuthError(error, "mfa"));
      }
    });

  const cancelEnrollment = () =>
    run(async () => {
      if (enrollment) await cancelTotpEnrollment(enrollment.factorId);
      setEnrollment(null);
      resetCode();
      setView("off");
    });

  const confirmEnrollment = (value: string) =>
    run(async () => {
      if (!enrollment || value.length !== TOTP_CODE_LENGTH) return;
      setCodeError(null);
      try {
        await confirmTotpEnrollment(enrollment.factorId, value);
        setEnrollment(null);
        resetCode();
        toast({
          title: "Verificação em duas etapas ativada",
          description: "No próximo login, o Orbi vai pedir o código do aplicativo.",
        });
        await load();
      } catch (error) {
        setCodeError(describeAuthError(error, "mfa"));
        setCode("");
        window.setTimeout(() => codeRef.current?.focus(), 0);
      }
    });

  const confirmDisable = (value: string) =>
    run(async () => {
      if (!status?.factor || value.length !== TOTP_CODE_LENGTH) return;
      setCodeError(null);
      try {
        await disableTotp(status.factor.id, value);
        resetCode();
        toast({
          title: "Verificação em duas etapas desativada",
          description: "Sua conta volta a pedir só e-mail e senha.",
        });
        await load();
      } catch (error) {
        setCodeError(describeAuthError(error, "mfa"));
        setCode("");
        window.setTimeout(() => codeRef.current?.focus(), 0);
      }
    });

  const copySecret = async () => {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret.replace(/=+$/, ""));
      setCopied(true);
    } catch {
      toast({ title: "Não foi possível copiar", description: "Selecione a chave e copie manualmente." });
    }
  };

  const enabledSince = status?.factor?.created_at ? dateFormatter.format(new Date(status.factor.created_at)) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <CardTitle>Verificação em duas etapas</CardTitle>
          {(view === "on" || view === "disabling") && <Badge variant="success">Ativa</Badge>}
          {view === "off" && <Badge variant="default">Desativada</Badge>}
        </div>
        <CardDescription className="max-w-[60ch]">
          Além da senha, o login pede um código de 6 dígitos gerado no seu celular. Quem descobrir sua senha continua
          sem acesso à conta.
        </CardDescription>
      </CardHeader>

      {view === "loading" && (
        <CardContent className="space-y-3 pt-0" aria-busy="true">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-10 w-56" />
        </CardContent>
      )}

      {view === "load_error" && (
        <CardContent className="space-y-4 pt-0">
          <Alert variant="destructive">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Tentar de novo
          </Button>
        </CardContent>
      )}

      {view === "off" && (
        <>
          {actionError && (
            <CardContent className="pt-0">
              <Alert variant="destructive">
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            </CardContent>
          )}
          <CardFooter>
            <Button type="button" onClick={() => void startEnrollment()} disabled={isWorking}>
              {isWorking ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />}
              {isWorking ? "Preparando…" : "Ativar verificação"}
            </Button>
          </CardFooter>
        </>
      )}

      {view === "enrolling" && enrollment && (
        <form
          noValidate
          aria-label="Ativar verificação em duas etapas"
          onSubmit={(event) => {
            event.preventDefault();
            void confirmEnrollment(code);
          }}
        >
          <CardContent className="pt-0">
            <div className="grid gap-6 rounded-xl border border-border p-4 sm:grid-cols-[auto,1fr] sm:p-5">
              {/* QR em fundo branco fixo: leitores de câmera falham com QR invertido no tema escuro. */}
              <div className="mx-auto self-start rounded-lg bg-white p-3 shadow-sm ring-1 ring-black/5 sm:mx-0">
                <img
                  src={enrollment.qrCode}
                  alt="QR code para cadastrar o Orbi no aplicativo autenticador"
                  width={168}
                  height={168}
                  className="h-[168px] w-[168px]"
                  draggable={false}
                />
              </div>

              <ol className="space-y-5 text-sm">
                <li className="space-y-1">
                  <p className="font-medium text-foreground">Abra um aplicativo autenticador</p>
                  <p className="text-muted-foreground">Google Authenticator, Microsoft Authenticator, 1Password ou Authy.</p>
                </li>
                <li className="space-y-2">
                  <p className="font-medium text-foreground">Escaneie o QR code</p>
                  <p className="text-muted-foreground">Sem câmera? Digite esta chave no aplicativo:</p>
                  <div className="flex items-center gap-1 rounded-md bg-surface-sunken py-1 pl-3 pr-1">
                    <code
                      id={`${baseId}-secret`}
                      className="min-w-0 flex-1 select-all break-all font-mono text-[0.8125rem] tracking-wide text-foreground"
                    >
                      {groupSecret(enrollment.secret)}
                    </code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void copySecret()}
                      aria-label={copied ? "Chave copiada" : "Copiar chave"}
                    >
                      {copied ? <Check className="text-success" aria-hidden /> : <Copy aria-hidden />}
                    </Button>
                  </div>
                </li>
                <li className="space-y-3">
                  <p className="font-medium text-foreground">Digite o código que aparece no aplicativo</p>
                  <div>
                    <TotpCodeInput
                      ref={codeRef}
                      id={`${baseId}-enroll-code`}
                      value={code}
                      onChange={(value) => {
                        setCode(value);
                        if (codeError) setCodeError(null);
                      }}
                      onComplete={(value) => void confirmEnrollment(value)}
                      disabled={isWorking}
                      error={codeError}
                      align="start"
                    />
                  </div>
                </li>
              </ol>
            </div>
          </CardContent>
          <CardFooter className="flex-wrap gap-2">
            <Button type="submit" disabled={isWorking || code.length !== TOTP_CODE_LENGTH}>
              {isWorking && <Loader2 className="animate-spin" aria-hidden />}
              {isWorking ? "Verificando…" : "Ativar"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => void cancelEnrollment()} disabled={isWorking}>
              Cancelar
            </Button>
          </CardFooter>
        </form>
      )}

      {view === "on" && (
        <>
          <CardContent className="pt-0">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
              {enabledSince ? `Aplicativo autenticador cadastrado em ${enabledSince}.` : "Aplicativo autenticador cadastrado."}
            </p>
          </CardContent>
          <CardFooter>
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                resetCode();
                setView("disabling");
              }}
            >
              <ShieldOff aria-hidden />
              Desativar
            </Button>
          </CardFooter>
        </>
      )}

      {view === "disabling" && (
        <form
          noValidate
          aria-label="Desativar verificação em duas etapas"
          onSubmit={(event) => {
            event.preventDefault();
            void confirmDisable(code);
          }}
        >
          <CardContent className="space-y-4 pt-0">
            <Alert variant="warning">
              <AlertDescription>
                Sem a verificação, basta a senha para entrar na sua conta. Para confirmar, digite o código atual do
                aplicativo.
              </AlertDescription>
            </Alert>
            <div>
              <TotpCodeInput
                ref={codeRef}
                id={`${baseId}-disable-code`}
                value={code}
                onChange={(value) => {
                  setCode(value);
                  if (codeError) setCodeError(null);
                }}
                onComplete={(value) => void confirmDisable(value)}
                disabled={isWorking}
                error={codeError}
                align="start"
              />
            </div>
          </CardContent>
          <CardFooter className="flex-wrap gap-2">
            <Button type="submit" variant="destructive" disabled={isWorking || code.length !== TOTP_CODE_LENGTH}>
              {isWorking && <Loader2 className="animate-spin" aria-hidden />}
              {isWorking ? "Desativando…" : "Desativar verificação"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetCode();
                setView("on");
              }}
              disabled={isWorking}
            >
              Cancelar
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
