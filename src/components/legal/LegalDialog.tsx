import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatLegalDate, type LegalDocument } from "@/lib/legal";

import { LegalDocumentView } from "./LegalDocumentView";

export interface LegalDialogProps {
  document: LegalDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Leitura do documento sem sair do formulário — abrir em aba nova no meio de
 * um cadastro custa o estado digitado. A aba nova continua disponível pelo
 * botão do rodapé, para quem quiser imprimir ou guardar o link.
 */
export function LegalDialog({ document: doc, open, onOpenChange }: LegalDialogProps) {
  if (!doc) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85svh] max-h-[48rem] w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[42rem]">
        <DialogHeader className="shrink-0 border-b border-border-subtle px-5 py-4 text-left md:px-6">
          <DialogTitle className="text-base md:text-lg">{doc.title}</DialogTitle>
          <DialogDescription className="text-xs tabular">
            Versão {doc.version} · Vigente desde {formatLegalDate(doc.updatedAt)}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]]:overscroll-contain">
          <div className="px-5 py-5 md:px-6">
            <LegalDocumentView document={doc} hideHeader />
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0 border-t border-border-subtle px-5 py-3 max-sm:static max-sm:m-0 max-sm:px-5 max-sm:py-3 md:px-6">
          <Button variant="outline" size="sm" asChild>
            <a href={doc.path} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir em nova aba
            </a>
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
