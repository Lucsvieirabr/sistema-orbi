import { Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Info } from "lucide-react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/navigation/AppSidebar";
import { AppHeader } from "@/components/navigation/AppHeader";
import { BottomNav } from "@/components/navigation/BottomNav";
import { MfaSecurityReminder } from "@/components/auth/MfaSecurityReminder";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useIsCompact } from "@/hooks/use-mobile";
import { useSpace } from "@/hooks/use-space";
import { cn } from "@/lib/utils";

/** Módulos que não leem o espaço (sem `p_scope`/viewMode): conteúdo igual em Meu e Nosso. */
const SPACE_AGNOSTIC_ROUTES = [
  "/sistema/ledgers",
  "/sistema/inflation",
  "/sistema/categories",
  "/sistema/people",
  "/sistema/notes",
  "/sistema/my-ai",
];

interface AppLayoutProps {
  onLogout: () => void;
}

/**
 * Shell autenticado.
 *
 * Navegação adaptativa, com um único ponto de corte (`lg` = 1024px):
 *   - `lg+`  → sidebar navy fixa à esquerda.
 *   - `<lg`  → sidebar vira drawer (hambúrguer no header) + barra inferior
 *              com os quatro destinos de maior tráfego.
 *
 * O corte é o mesmo no JS (`useIsCompact`) e no CSS (`lg:`), o que evita a
 * faixa de tablet sem navegação alguma.
 *
 * ── ROLAGEM ────────────────────────────────────────────────────────────────
 * Quem rola é `#conteudo`, NÃO o documento. O shell inteiro é travado em
 * `h-svh overflow-hidden` e cada faixa declara seu papel:
 *
 *   SidebarProvider   h-svh overflow-hidden   ← limite: o body nunca rola
 *   ├─ AppSidebar     h-svh shrink-0 sticky   ← nunca sai da tela
 *   └─ SidebarInset   h-svh min-h-0 overflow-hidden
 *      ├─ AppHeader   shrink-0                ← sempre visível
 *      └─ #conteudo   flex-1 min-h-0 overflow-y-auto   ← o único scroller
 *
 * `min-h-0` em toda a cadeia é obrigatório: sem ele um filho flex tem
 * `min-height:auto` e cresce até o tamanho do conteúdo, empurrando o container
 * para além da viewport — era exatamente por isso que telas longas (termos de
 * uso, extrato mensal) apareciam cortadas e a sidebar rolava junto.
 */
export default function AppLayout({ onLogout }: AppLayoutProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const isCompact = useIsCompact();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Chave pela PREFERÊNCIA (síncrona, localStorage): o palco não remonta
  // quando o vínculo do Casal termina de carregar, só quando o usuário troca.
  const { mode, isWeSpace } = useSpace();
  const { pathname } = useLocation();
  const spaceAgnostic =
    isWeSpace && SPACE_AGNOSTIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

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
    <SidebarProvider className="h-svh overflow-hidden">
      {isCompact ? <AppSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} /> : <AppSidebar />}

      {/* `min-w-0` é o que impede o filho flex de esticar a página para os
          lados quando uma tabela ou um valor longo aparece.
          `h-svh min-h-0 overflow-hidden` é o que impede a coluna de esticar
          para BAIXO — o par vertical do mesmo problema. */}
      <SidebarInset className="h-svh min-h-0 min-w-0 overflow-hidden">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
        >
          Pular para o conteúdo
        </a>

        <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
          <AppHeader
            title="Orbi"
            subtitle="Sua visão financeira"
            onLogout={handleLogout}
            onMenuClick={() => setMobileMenuOpen(true)}
            menuOpen={mobileMenuOpen}
          />

          <MfaSecurityReminder />

          {/* Whitespace é o elemento de design: gutters largos no desktop,
              econômicos no telefone. */}
          {/* `SidebarInset` já é o <main> do documento — aqui vai um alvo de
              foco para o skip-link, não um segundo landmark. */}
          <div
            id="conteudo"
            tabIndex={-1}
            className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 outline-none md:px-6 md:py-8 lg:px-8 lg:py-10"
          >
            {/* Troca de espaço remonta o palco: o conteúdo assenta vindo do
                lado escolhido (eu ← | → nós). `key` garante a animação uma
                vez por troca, nunca em re-render comum. */}
            <div
              key={mode}
              data-space={mode === "couple" ? "we" : "me"}
              className={cn(
                "mx-auto w-full min-w-0 max-w-[88rem]",
                mode === "couple" ? "motion-safe:animate-space-in-we" : "motion-safe:animate-space-in-me",
              )}
            >
              {spaceAgnostic && (
                <p className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Este módulo não muda com o espaço: o conteúdo é o mesmo em Meu e Nosso espaço.
                </p>
              )}
              <Outlet />
            </div>

            {/* Espaçador DENTRO do scroller: o fim do conteúdo nunca para
                embaixo da barra inferior + recorte do aparelho. Fora dele,
                roubaria altura útil da viewport em toda tela. */}
            <div aria-hidden className="h-bottom-nav-offset shrink-0 lg:hidden" />
          </div>
        </div>

        <BottomNav onMenuClick={() => setMobileMenuOpen(true)} menuOpen={mobileMenuOpen} />

        {/* Primeiro acesso: aparece sobre qualquer tela do /sistema até ser concluído ou pulado. */}
        <OnboardingModal />
      </SidebarInset>
    </SidebarProvider>
  );
}
