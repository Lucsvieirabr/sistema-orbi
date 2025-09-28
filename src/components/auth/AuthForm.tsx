import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import orbiLogoDark from "@/assets/orbi-logo_dark.png";
import orbiLogoLight from "@/assets/orbi-logo_white.png";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AuthFormProps {
  onAuthSuccess: () => void;
}

export function AuthForm({ onAuthSuccess }: AuthFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useTheme();

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    const form = event.currentTarget;
    const email = (form.querySelector('#email') as HTMLInputElement)?.value;
    const password = (form.querySelector('#password') as HTMLInputElement)?.value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);
    if (error) {
      toast({ title: "Falha no login", description: error.message });
      return;
    }
    toast({ title: "Login realizado com sucesso!", description: "Redirecionando para o dashboard..." });
    onAuthSuccess();
  };

  // Registration removed: users are provisioned in Supabase by admins

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
        </CardContent>
      </Card>
    </div>
  );
}