import { Outlet, NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { AppHeader } from "@/components/navigation/AppHeader";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  onLogout: () => void;
}

export default function AppLayout({ onLogout }: AppLayoutProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Detectar retorno de pagamento bem-sucedido
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      toast({
        title: "🎉 Pagamento Confirmado!",
        description: "Seu pagamento foi processado com sucesso. Sua assinatura será ativada em breve.",
        duration: 8000,
      });
      
      // Limpar parâmetro da URL
      searchParams.delete('payment');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, toast]);

  const handleLogout = () => {
    onLogout();
    navigate("/login");
  };

  return (
    <SidebarProvider>
      {/* Desktop Sidebar - hidden on mobile */}
      {!isMobile && <AppSidebar />}
      
      {/* Mobile Sidebar - in Sheet */}
      {isMobile && (
        <AppSidebar 
          open={mobileMenuOpen} 
          onOpenChange={setMobileMenuOpen}
        />
      )}
      
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          <AppHeader 
            title="Orbi" 
            subtitle="Sua visão financeira" 
            onLogout={handleLogout}
            onMenuClick={() => setMobileMenuOpen(true)}
            showMenuButton={isMobile}
          />
          <main className="flex-1 p-4">
            <Outlet />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}


