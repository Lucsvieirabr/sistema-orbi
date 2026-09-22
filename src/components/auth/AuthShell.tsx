import orbiLogoDark from "@/assets/orbi-logo_dark.png";
import orbiLogoLight from "@/assets/orbi-logo_white.png";
import { LegalLinksInline } from "@/components/legal";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

interface AuthShellProps {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Ações secundárias abaixo do card (ex.: "Voltar para o login"). */
  aside?: React.ReactNode;
  className?: string;
}

/**
 * Moldura das telas de autenticação fora do login: mesma superfície do
 * `AuthForm` (card elevado, logo, alternância de tema, links legais) para que
 * recuperar senha e digitar o código pareçam o mesmo lugar.
 */
export function AuthShell({ title, description, children, aside, className }: AuthShellProps) {
  const { theme } = useTheme();

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 pb-16 pt-20">
      <div className="absolute right-4 top-4 md:right-8 md:top-6">
        <ThemeToggle />
      </div>

      {/* `overflow-hidden` + `min-w-0` nos filhos: um e-mail longo sem espaços
          (o caso que estourava a tela) quebra dentro do card em vez de esticar
          a largura do grid do CardHeader. */}
      <Card variant="elevated" className={cn("w-full max-w-md overflow-hidden animate-rise", className)}>
        <CardHeader className="items-center gap-1.5 px-5 pb-5 text-center sm:px-6">
          <img
            src={theme === "dark" ? orbiLogoDark : orbiLogoLight}
            alt="Orbi"
            width={48}
            height={48}
            decoding="async"
            className="mb-2 h-12 w-12 object-contain"
          />
          <h1 className="min-w-0 max-w-full text-balance text-xl font-semibold tracking-[-0.02em] text-foreground">
            {title}
          </h1>
          {description && (
            <CardDescription className="min-w-0 max-w-full text-pretty leading-relaxed [overflow-wrap:anywhere] sm:max-w-[34ch]">
              {description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="px-5 sm:px-6">{children}</CardContent>
      </Card>

      {aside && <div className="mt-5 flex flex-col items-center gap-1 text-sm">{aside}</div>}

      <p className="absolute bottom-4 left-0 right-0 text-center text-[0.6875rem] text-muted-foreground">
        <LegalLinksInline />
      </p>
    </main>
  );
}
