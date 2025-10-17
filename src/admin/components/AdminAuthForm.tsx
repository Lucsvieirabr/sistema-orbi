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
import { Shield, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Formulário de login para administradores
 * Verifica permissões de admin antes de permitir acesso
 */
export function AdminAuthForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useTheme();
  const navigate = useNavigate();

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    
    const form = event.currentTarget;
    const email = (form.querySelector('#email') as HTMLInputElement)?.value;
    const password = (form.querySelector('#password') as HTMLInputElement)?.value;
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      toast({ title: "Falha no login", description: error.message, variant: "destructive" });
      setIsLoading(false);
      return;
    }

    // Verificar se o usuário é admin
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: adminData } = await supabase.rpc('get_admin_user');
      const isAdmin = adminData && (Array.isArray(adminData) ? adminData.length > 0 : true);

      if (!isAdmin) {
        await supabase.auth.signOut();
        toast({ 
          title: "Acesso negado", 
          description: "Você não possui permissões de administrador.", 
          variant: "destructive" 
        });
        setIsLoading(false);
        return;
      }
    }

    toast({ title: "Login realizado com sucesso!", description: "Bem-vindo ao painel administrativo" });
    setIsLoading(false);
    
    // Navegar para o dashboard admin
    navigate('/admin/dashboard', { replace: true });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-red-950/20 via-background to-red-950/10 p-4">
      {/* Botão voltar */}
      <div className="absolute left-4 top-4">
        <Button variant="outline" onClick={() => navigate('/login')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Login
        </Button>
      </div>

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md bg-gradient-card shadow-2xl border-red-900/20">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <img 
                src={theme === 'dark' ? orbiLogoDark : orbiLogoLight} 
                alt="Orbi" 
                className="h-20 w-20 object-contain"
              />
              <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-red-500 flex items-center justify-center ring-2 ring-background">
                <Shield className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent">
            Orbi Admin
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Painel Administrativo - Acesso Restrito
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail do Administrador</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@orbi.com"
                required
                className="transition-all duration-200 focus:shadow-primary border-red-900/20 focus:border-red-500"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                className="transition-all duration-200 focus:shadow-primary border-red-900/20 focus:border-red-500"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 hover:scale-105 transition-all duration-200 shadow-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Verificando...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Acessar Painel Admin
                </div>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-red-900/20">
            <p className="text-xs text-center text-muted-foreground">
              <Shield className="h-3 w-3 inline mr-1" />
              Acesso restrito a administradores autorizados
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


