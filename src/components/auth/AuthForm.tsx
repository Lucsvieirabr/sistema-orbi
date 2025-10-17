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

/**
 * Formulário de autenticação simplificado
 * Usa o hook useAuth para toda lógica de login/cadastro e redirecionamento
 */
export function AuthForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const { login, register } = useAuth();

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
    setIsLoading(true);
    
    const form = event.currentTarget;
    const email = (form.querySelector('#register-email') as HTMLInputElement)?.value;
    const password = (form.querySelector('#register-password') as HTMLInputElement)?.value;
    const fullName = (form.querySelector('#register-name') as HTMLInputElement)?.value;
    
    await register(email, password, fullName);
    setIsLoading(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md bg-gradient-card shadow-lg border-0">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center">
            <img 
              src={theme === 'dark' ? orbiLogoDark : orbiLogoLight} 
              alt="Orbi" 
              className="h-20 w-20 object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Orbi
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Gerencie suas finanças de forma inteligente
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "login" | "register")}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Criar Conta</TabsTrigger>
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
                    className="transition-all duration-200 focus:shadow-primary"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    className="transition-all duration-200 focus:shadow-primary"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-primary hover:scale-105 transition-all duration-200 shadow-primary"
                  disabled={isLoading}
                >
                  {isLoading ? "Entrando..." : "Entrar"}
                </Button>
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
                    className="transition-all duration-200 focus:shadow-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-email">E-mail</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                    className="transition-all duration-200 focus:shadow-primary"
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
                    className="transition-all duration-200 focus:shadow-primary"
                  />
                  <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres</p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-primary hover:scale-105 transition-all duration-200 shadow-primary"
                  disabled={isLoading}
                >
                  {isLoading ? "Criando conta..." : "Criar Conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}