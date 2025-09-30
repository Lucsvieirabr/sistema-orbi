import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { AppHeader } from "@/components/navigation/AppHeader";

interface AppLayoutProps {
  onLogout: () => void;
}

export default function AppLayout({ onLogout }: AppLayoutProps) {
  const navigate = useNavigate();

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


