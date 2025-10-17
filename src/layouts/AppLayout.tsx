import { Outlet, NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { AppHeader } from "@/components/navigation/AppHeader";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

interface AppLayoutProps {
  onLogout: () => void;
}

export default function AppLayout({ onLogout }: AppLayoutProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

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
      <AppSidebar />
      <SidebarInset>
        <div className="p-4">
          <AppHeader title="Orbi" subtitle="Sua visão financeira" onLogout={handleLogout} />
          <Outlet />
        </div>
        {/* Mobile FAB for new transaction */}
        <button
          aria-label="Nova Transação"
          onClick={() => navigate("/sistema/statement?new=1")}
          className="md:hidden fixed bottom-6 right-6 h-12 w-12 rounded-lg bg-transparent border-2 border-dashed border-blue-400 text-blue-400 shadow-lg hover:bg-blue-400/10 hover:border-blue-300 hover:text-blue-300 flex items-center justify-center text-lg font-semibold transition-all duration-300"
        >
          +
        </button>
      </SidebarInset>
    </SidebarProvider>
  );
}


