import { forwardRef, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Eye, EyeOff, Loader2, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { evaluatePassword, type PasswordScore } from "@/lib/password-strength";
import { cn } from "@/lib/utils";

/** Cor do segmento aceso por nível. Tokens semânticos, nunca paleta crua. */
const SCORE_TONE: Record<PasswordScore, string> = {
  0: "bg-border",
  1: "bg-destructive",
  2: "bg-warning",
  3: "bg-success",
  4: "bg-success",
};

const SCORE_TEXT: Record<PasswordScore, string> = {
  0: "text-muted-foreground",
  1: "text-destructive",
  2: "text-warning",
  3: "text-success",
  4: "text-success",
};

/**
 * Traduz o erro do GoTrue. `code` é estável entre versões; a mensagem não.
 */
function describeAuthError(error: { code?: string; status?: number; message?: string }): string {
  switch (error?.code) {
    case "same_password":
      return "A nova senha precisa ser diferente da atual.";
    case "weak_password":
      return "Essa senha não atende aos critérios de segurança. Use uma combinação mais longa e variada.";
    case "reauthentication_needed":
      return "Por segurança, saia e entre de novo na sua conta antes de trocar a senha.";
    case "session_not_found":
    case "session_expired":
      return "Sua sessão expirou. Entre de novo para trocar a senha.";
    case "over_request_rate_limit":
      return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
  }
  if (error?.status === 429) return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
  return error?.message || "Não foi possível alterar a senha. Tente de novo.";
}

interface PasswordFieldProps extends Omit<React.ComponentProps<typeof Input>, "type"> {
  label: string;
  error?: string | null;
  hint?: React.ReactNode;
}

const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { id, label, error, hint, className, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          type={visible ? "text" : "password"}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn("pr-12 md:pr-11", className)}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 rounded-l-none hover:bg-transparent"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          aria-controls={id}
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
      </div>
      {hint && <div id={hintId}>{hint}</div>}
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
});

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
    supabase.auth.getUser().then(({ data }) => {
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
    } catch (error: any) {
      toast({ title: "Senha não alterada", description: describeAuthError(error), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const filledSegments = evaluation.score;

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
            hint={
              <div className="space-y-2.5 pt-0.5">
                <div className="flex items-center gap-3">
                  <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden>
                    {[1, 2, 3, 4].map((segment) => (
                      <span
                        key={segment}
                        className={cn(
                          "h-1 rounded-full transition-colors duration-300 ease-swift",
                          segment <= filledSegments ? SCORE_TONE[evaluation.score] : "bg-surface-sunken",
                        )}
                      />
                    ))}
                  </div>
                  <p
                    className={cn("w-16 text-right text-xs font-medium", SCORE_TEXT[evaluation.score])}
                    aria-live="polite"
                  >
                    {evaluation.label ? (
                      <>
                        <span className="sr-only">Força da senha: </span>
                        {evaluation.label}
                      </>
                    ) : null}
                  </p>
                </div>

                <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Requisitos da senha">
                  {evaluation.rules.map((rule) => (
                    <li
                      key={rule.id}
                      className={cn(
                        "flex items-center gap-1.5 text-xs transition-colors duration-200 ease-swift",
                        rule.met ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {rule.met ? (
                        <Check className="h-3.5 w-3.5 text-success" aria-hidden />
                      ) : (
                        <Minus className="h-3.5 w-3.5" aria-hidden />
                      )}
                      {rule.label}
                      <span className="sr-only">{rule.met ? "(atendido)" : "(pendente)"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            }
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
            hint={
              confirmMatches ? (
                <p className="flex items-center gap-1.5 text-xs text-success">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  As senhas coincidem
                </p>
              ) : null
            }
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
