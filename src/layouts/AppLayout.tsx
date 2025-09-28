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
          onClick={() => navigate("/sistema/transactions?new=1")}
          className="md:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-primary)] flex items-center justify-center text-2xl"
        >
          +
        </button>
      </SidebarInset>
    </SidebarProvider>
  );
}


