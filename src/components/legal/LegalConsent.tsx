import { useCallback, useState, type ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { PRIVACY_POLICY, TERMS_OF_USE, type LegalDocument } from "@/lib/legal";

import { LegalDialog } from "./LegalDialog";

/** Botão-link inline: abre o documento em modal sem descartar o formulário. */
function LegalInlineLink({
  document: doc,
  onOpen,
}: {
  document: LegalDocument;
  onOpen: (doc: LegalDocument) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(doc)}
      className="rounded-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {doc.shortTitle}
    </button>
  );
}

function useLegalDialog() {
  const [activeDoc, setActiveDoc] = useState<LegalDocument | null>(null);
  const open = useCallback((doc: LegalDocument) => setActiveDoc(doc), []);
  const dialog = (
    <LegalDialog
      document={activeDoc}
      open={activeDoc !== null}
      onOpenChange={(isOpen) => !isOpen && setActiveDoc(null)}
    />
  );
  return { open, dialog };
}

export interface LegalConsentCheckboxProps {
  /** Único estado de verdade do aceite. NUNCA inicializar como `true`. */
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Mensagem exibida quando o envio foi tentado sem aceite. */
  error?: string | null;
  id?: string;
  /** Texto do aceite — o padrão serve cadastro; a contratação sobrescreve. */
  label?: ReactNode;
  className?: string;
  disabled?: boolean;
}

/**
 * Caixa de aceite explícito (opt-in) exigida pela LGPD, art. 8º:
 * desmarcada por padrão, ação afirmativa do titular, com os dois documentos
 * acessíveis por links separados e clicáveis antes do aceite.
 */
export function LegalConsentCheckbox({
  checked,
  onCheckedChange,
  error,
  id = "legal-consent",
  label,
  className,
  disabled,
}: LegalConsentCheckboxProps) {
  const { open, dialog } = useLegalDialog();
  const errorId = `${id}-error`;

  return (
    <div className={cn("w-full space-y-2", className)}>
      {/* `items-start` alinha a caixa pela primeira linha do texto; `shrink-0`
          impede que o quadrado seja esmagado quando o texto quebra; `min-w-0
          flex-1` faz o texto FLUIR ao lado em coluna própria em vez de
          transbordar por baixo da caixa. */}
      <div className="flex items-start gap-2">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          disabled={disabled}
          required
          aria-required="true"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn("mt-0.5 shrink-0", error && "border-destructive")}
        />
        <label
          htmlFor={id}
          className="min-w-0 flex-1 cursor-pointer text-2xs leading-4 text-muted-foreground"
        >
          {label ?? (
            <span className="inline-flex flex-wrap gap-x-1">
              <span className="whitespace-nowrap">
                Li e concordo com os <LegalInlineLink document={TERMS_OF_USE} onOpen={open} />
              </span>
              <span className="whitespace-nowrap">
                e a <LegalInlineLink document={PRIVACY_POLICY} onOpen={open} />.
              </span>
            </span>
          )}
        </label>
      </div>

      {/* Recuo = largura da caixa (1rem) + gap (0.5rem): o erro nasce sob o
          texto, não sob o checkbox. */}
      {error && (
        <p id={errorId} role="alert" className="pl-6 text-xs font-medium text-destructive">
          {error}
        </p>
      )}

      {dialog}
    </div>
  );
}

/**
 * Aviso discreto para telas em que o aceite já ocorreu no cadastro (login):
 * informa e dá acesso aos documentos, sem pedir novo opt-in.
 */
export function LegalConsentNotice({ className }: { className?: string }) {
  const { open, dialog } = useLegalDialog();

  return (
    <p className={cn("text-center text-[0.6875rem] leading-relaxed text-muted-foreground", className)}>
      Ao continuar, você concorda com nossos <LegalInlineLink document={TERMS_OF_USE} onOpen={open} /> e com a{" "}
      <LegalInlineLink document={PRIVACY_POLICY} onOpen={open} />.
      {dialog}
    </p>
  );
}

/** Par de links dos documentos, para rodapés de páginas públicas. */
export function LegalLinksInline({ className }: { className?: string }) {
  const { open, dialog } = useLegalDialog();

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <LegalInlineLink document={TERMS_OF_USE} onOpen={open} />
      <span aria-hidden className="text-border">·</span>
      <LegalInlineLink document={PRIVACY_POLICY} onOpen={open} />
      {dialog}
    </span>
  );
}
