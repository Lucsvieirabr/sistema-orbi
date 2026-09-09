import { Outlet, useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/admin/components/AdminSidebar";
import { AdminHeader } from "@/admin/components/AdminHeader";
import { Loader2, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useIsCompact } from "@/hooks/use-mobile";

export default function AdminLayout() {
  const { isAdmin, isLoading } = useAdminAuth();
  const navigate = useNavigate();
  const isCompact = useIsCompact();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Mostra loading enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se não for admin, mostra página de acesso negado (sem loop)
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive-soft flex items-center justify-center">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl text-destructive">Acesso Negado</CardTitle>
            <CardDescription>
              Você não possui permissões de administrador para acessar esta área.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Esta área é restrita apenas para administradores autorizados do sistema Orbi.
            </p>
            <div className="flex flex-col gap-2">
              <Button 
                variant="default" 
                className="w-full"
                onClick={() => navigate('/sistema')}
              >
                Ir para o Sistema
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/admin')}
              >
                Voltar ao Login Admin
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SidebarProvider>
      {isCompact ? (
        <AdminSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
      ) : (
        <AdminSidebar />
      )}
      <SidebarInset className="min-w-0">
        <AdminHeader onMenuClick={() => setMobileMenuOpen(true)} menuOpen={mobileMenuOpen} />
        <div className="min-w-0 px-4 py-5 md:px-6 md:py-6 lg:px-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

