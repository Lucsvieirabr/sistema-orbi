import { useState } from "react";
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
import { LegalConsentCheckbox, LegalConsentNotice, LegalLinksInline } from "@/components/legal";
import { cn } from "@/lib/utils";

/** Item do segmented control: o fundo ativo é do thumb, não do item. */
const segmentTrigger =
  "data-[state=active]:border-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none";

/**
 * Formulário de autenticação simplificado
 * Usa o hook useAuth para toda lógica de login/cadastro e redirecionamento
 */
export function AuthForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const { login, register } = useAuth();

  /**
   * Aceite legal do cadastro (LGPD art. 8º): estado próprio, SEMPRE iniciado
   * como `false`. Não há caminho no código que marque isso automaticamente —
   * só o clique do titular. O envio é bloqueado enquanto for `false`.
   */
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    
    const form = event.currentTarget;
    const email = (form.querySelector('#email') as HTMLInputElement)?.value;
    const password = (form.querySelector('#password') as HTMLInputElement)?.value;
    
    await login(email, password);
    setIsLoading(false);
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Validação do aceite antes de qualquer chamada de rede.
    if (!acceptedTerms) {
      setConsentError("Para criar sua conta, aceite os Termos de Uso e a Política de Privacidade.");
      return;
    }

    setConsentError(null);
    setIsLoading(true);
    
    const form = event.currentTarget;
    const email = (form.querySelector('#register-email') as HTMLInputElement)?.value;
    const password = (form.querySelector('#register-password') as HTMLInputElement)?.value;
    const fullName = (form.querySelector('#register-name') as HTMLInputElement)?.value;

    await register(email, password, fullName);
    setIsLoading(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card variant="elevated" className="w-full max-w-md animate-rise">
        <CardHeader className="items-center gap-1 pb-5 text-center">
          <img
            src={theme === 'dark' ? orbiLogoDark : orbiLogoLight}
            alt=""
            aria-hidden
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

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Entrando..." : "Entrar"}
                </Button>

                {/* Disclaimer sutil: informa sem pedir novo opt-in — o aceite
                    formal ocorre no cadastro. */}
                <LegalConsentNotice className="pt-1" />
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Nome Completo</Label>
                  <Input
                    id="register-name"
                    type="text"
                    placeholder="Seu nome completo"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-email">E-mail</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="register-password">Senha</Label>
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres</p>
                </div>

                <LegalConsentCheckbox
                  id="register-legal-consent"
                  checked={acceptedTerms}
                  onCheckedChange={(value) => {
                    setAcceptedTerms(value);
                    if (value) setConsentError(null);
                  }}
                  error={consentError}
                  disabled={isLoading}
                  className="pt-1"
                />

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isLoading || !acceptedTerms}
                >
                  {isLoading ? "Criando conta..." : "Criar Conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <p className="absolute bottom-4 left-0 right-0 text-center text-[0.6875rem] text-muted-foreground">
        <LegalLinksInline />
      </p>
    </div>
  );
}
