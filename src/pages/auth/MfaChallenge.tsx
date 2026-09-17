import { useEffect, useId, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, Smartphone } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { TotpCodeInput } from "@/components/auth/TotpCodeInput";
import { Button } from "@/components/ui/button";
import { resolvePostAuthRoute } from "@/hooks/use-auth";
import { SUBSCRIPTION_QUERY_KEY } from "@/hooks/use-subscription";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { describeAuthError } from "@/lib/auth/auth-errors";
import { AUTH_ROUTES, parseMfaDestination } from "@/lib/auth/redirect";
import { getAssurance, TOTP_CODE_LENGTH, verifyLoginCode } from "@/services/auth/mfa";

/**
 * `/login/verificacao` — segunda etapa do login.
 *
 * Chega aqui quem tem sessão aal1 e TOTP verificado (App.tsx redireciona).
 * O código promove a sessão para aal2; só então o destino é resolvido. Sem
 * sessão → login. Já em aal2 (aba duplicada, voltar do navegador) → destino.
 */
export default function MfaChallenge() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const destination = parseMfaDestination(searchParams.get("destino"));

  const codeId = useId();
  const codeRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const goToDestination = async () => {
    queryClient.removeQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });

    if (destination === "admin") {
      const { data: adminData, error: adminError } = await supabase.rpc("get_admin_user");
      const isAdmin = !adminError && adminData && (Array.isArray(adminData) ? adminData.length > 0 : true);
      if (!isAdmin) {
        await supabase.auth.signOut();
        toast({
          title: "Acesso negado",
          description: "Você não possui permissões de administrador.",
          variant: "destructive",
        });
        navigate("/admin", { replace: true });
        return;
      }
      navigate("/admin/dashboard", { replace: true });
      return;
    }

    const route = await resolvePostAuthRoute();
    await queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_QUERY_KEY });
    navigate(route, { replace: true });
  };

  useEffect(() => {
    let active = true;
    getAssurance().then((assurance) => {
      if (!active) return;
      if (!assurance.current) {
        navigate(AUTH_ROUTES.login, { replace: true });
        return;
      }
      if (!assurance.needsChallenge) {
        void goToDestination();
        return;
      }
      setReady(true);
    });
    return () => {
      active = false;
    };
    // Checagem única na montagem; o destino é resolvido uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (value: string) => {
    if (busyRef.current || value.length !== TOTP_CODE_LENGTH) return;
    busyRef.current = true;
    setIsVerifying(true);
    setError(null);

    try {
      await verifyLoginCode(value);
      toast({ title: "Login realizado com sucesso!", description: "Redirecionando..." });
      await goToDestination();
    } catch (err) {
      setError(describeAuthError(err, "mfa"));
      setCode("");
      window.setTimeout(() => codeRef.current?.focus(), 0);
    } finally {
      busyRef.current = false;
      setIsVerifying(false);
    }
  };

  const switchAccount = async () => {
    setIsLeaving(true);
    await supabase.auth.signOut();
    queryClient.clear();
    navigate(destination === "admin" ? "/admin" : AUTH_ROUTES.login, { replace: true });
  };

  if (!ready) {
    return (
      <AuthShell title="Verificação em duas etapas">
        <div className="flex justify-center py-6" role="status" aria-live="polite">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
          <span className="sr-only">Carregando</span>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Digite o código do aplicativo"
      description="Abra o aplicativo autenticador no seu celular e digite o código de 6 dígitos do Orbi."
      aside={
        <>
          <Button type="button" variant="subtle" size="sm" onClick={() => void switchAccount()} disabled={isLeaving}>
            <LogOut aria-hidden />
            Entrar com outra conta
          </Button>
          <p className="max-w-[36ch] text-balance text-center text-xs leading-relaxed text-muted-foreground">
            Perdeu acesso ao aplicativo? Escreva para{" "}
            <a
              href="mailto:suporte@meuorbi.com"
              className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
            >
              suporte@meuorbi.com
            </a>{" "}
            a partir do e-mail da conta.
          </p>
        </>
      }
    >
      <form
        className="space-y-4"
        noValidate
        aria-label="Código de verificação"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(code);
        }}
      >
        <div className="flex justify-center" aria-hidden>
          <span className="grid h-11 w-11 place-items-center rounded-full bg-surface-sunken text-muted-foreground">
            <Smartphone className="h-5 w-5" />
          </span>
        </div>

        <TotpCodeInput
          ref={codeRef}
          id={codeId}
          value={code}
          onChange={(value) => {
            setCode(value);
            if (error) setError(null);
          }}
          onComplete={(value) => void submit(value)}
          disabled={isVerifying}
          error={error}
          autoFocus
        />

        <Button type="submit" className="w-full" disabled={isVerifying || code.length !== TOTP_CODE_LENGTH}>
          {isVerifying && <Loader2 className="animate-spin" aria-hidden />}
          {isVerifying ? "Verificando…" : "Verificar"}
        </Button>
      </form>
    </AuthShell>
  );
}
