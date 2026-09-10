import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { LegalDocumentView } from "@/components/legal";
import { Button } from "@/components/ui/button";
import { PageBody } from "@/components/ui/page";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTheme } from "@/hooks/use-theme";
import orbiLogoDark from "@/assets/orbi-logo_dark.png";
import orbiLogoLight from "@/assets/orbi-logo_white.png";
import { LEGAL_DOCUMENT_LIST, type LegalDocument } from "@/lib/legal";

export interface LegalPageProps {
  document: LegalDocument;
  /**
   * `public`  — rota aberta, com cabeçalho próprio (lida sem login).
   * `app`     — dentro do `AppLayout`, herda o shell autenticado.
   */
  variant?: "public" | "app";
}

/** Navegação entre os dois documentos, presente nas duas variantes. */
function SiblingLinks({ current, variant }: { current: LegalDocument; variant: "public" | "app" }) {
  const navigate = useNavigate();
  const others = LEGAL_DOCUMENT_LIST.filter((doc) => doc.slug !== current.slug);

  if (others.length === 0) return null;

  return (
    <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-6">
      <span className="label-eyebrow mr-1">Leia também</span>
      {others.map((doc) => (
        <Button
          key={doc.slug}
          variant="outline"
          size="sm"
          onClick={() => navigate(variant === "app" ? doc.appPath : doc.path)}
        >
          {doc.shortTitle}
        </Button>
      ))}
    </div>
  );
}

export function LegalPage({ document: doc, variant = "public" }: LegalPageProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();

  if (variant === "app") {
    return (
      <PageBody>
        <LegalDocumentView document={doc} showIndex />
        <SiblingLinks current={doc} variant="app" />
      </PageBody>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border-subtle bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-header max-w-[56rem] items-center justify-between px-4 md:px-6 lg:h-header-lg lg:px-8">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img src={theme === "dark" ? orbiLogoDark : orbiLogoLight} alt="" aria-hidden className="h-7 w-7" />
            <span className="font-display text-base font-semibold tracking-tight">Orbi</span>
          </button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[56rem] px-4 pb-20 pt-8 md:px-6 md:pt-12 lg:px-8">
        <LegalDocumentView document={doc} showIndex />
        <SiblingLinks current={doc} variant="public" />
      </main>
    </div>
  );
}
