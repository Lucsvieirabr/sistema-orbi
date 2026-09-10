import { cn } from "@/lib/utils";
import { formatLegalDate, type LegalBlock, type LegalDocument } from "@/lib/legal";

/**
 * Renderiza um documento legal a partir do dado estruturado.
 * Mesma tipografia em página pública, página interna e modal — o texto é um
 * só e não pode divergir entre superfícies.
 */
function Block({ block }: { block: LegalBlock }) {
  if (block.type === "list") {
    return (
      <ul className="mt-3 space-y-2 pl-4">
        {block.items.map((item, index) => (
          <li
            key={index}
            className="relative pl-3 text-sm leading-relaxed text-pretty text-muted-foreground before:absolute before:left-0 before:top-[0.6em] before:h-1 before:w-1 before:rounded-full before:bg-border"
          >
            {item}
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === "callout") {
    return (
      <p className="mt-3 rounded-lg border border-border-subtle bg-surface-sunken px-4 py-3 text-sm font-medium leading-relaxed text-pretty text-foreground">
        {block.text}
      </p>
    );
  }

  return <p className="mt-3 text-sm leading-relaxed text-pretty text-muted-foreground">{block.text}</p>;
}

export interface LegalDocumentViewProps {
  document: LegalDocument;
  /** Oculta o cabeçalho quando a superfície já exibe título e versão. */
  hideHeader?: boolean;
  /** Índice navegável — útil na página, ruído no modal. */
  showIndex?: boolean;
  className?: string;
}

export function LegalDocumentView({
  document: doc,
  hideHeader = false,
  showIndex = false,
  className,
}: LegalDocumentViewProps) {
  return (
    <article className={cn("min-w-0", className)}>
      {!hideHeader && (
        <header className="border-b border-border-subtle pb-5">
          <p className="label-eyebrow">{doc.eyebrow}</p>
          <h1 className="mt-1.5 font-display text-xl font-semibold tracking-[-0.02em] text-foreground md:text-2xl">
            {doc.title}
          </h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground">{doc.summary}</p>
          <p className="mt-3 text-xs tabular text-muted-foreground">
            Versão {doc.version} · Vigente desde {formatLegalDate(doc.updatedAt)}
          </p>
        </header>
      )}

      {showIndex && (
        <nav aria-label={`Índice — ${doc.title}`} className="mt-6 rounded-xl border border-border-subtle p-4">
          <p className="label-eyebrow">Nesta página</p>
          <ol className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            {doc.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block truncate rounded-sm py-0.5 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="mt-6 space-y-8">
        {doc.sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <h2 className="font-display text-base font-semibold tracking-[-0.015em] text-foreground">
              {section.title}
            </h2>
            {section.blocks.map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </section>
        ))}
      </div>

      <p className="mt-10 border-t border-border-subtle pt-5 text-xs text-muted-foreground">
        {doc.title} — versão {doc.version}, vigente desde {formatLegalDate(doc.updatedAt)}.
      </p>
    </article>
  );
}
