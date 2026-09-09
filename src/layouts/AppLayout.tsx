import { Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
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

  useEffect(() => {
    if (searchParams.get("payment") !== "success") return;

    toast({
      title: "Pagamento confirmado",
      description: "Sua assinatura é ativada em instantes.",
      duration: 8000,
    });

    searchParams.delete("payment");
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams, toast]);

  const handleLogout = () => {
    onLogout();
    navigate("/login");
  };

  return (
    <SidebarProvider>
      {!isMobile && <AppSidebar />}
      {isMobile && <AppSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />}

      <SidebarInset>
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
        >
          Pular para o conteúdo
        </a>

        <div className="flex min-h-svh flex-col bg-background">
          <AppHeader
            title="Orbi"
            subtitle="Sua visão financeira"
            onLogout={handleLogout}
            onMenuClick={() => setMobileMenuOpen(true)}
            showMenuButton={isMobile}
          />

          {/* Whitespace é o elemento de design: gutters largos, medida máxima controlada. */}
          <main id="conteudo" className="flex-1 px-4 py-6 lg:px-8 lg:py-10">
            <div className="mx-auto w-full max-w-[88rem]">
              <Outlet />
            </div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
