import { FileText, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLegalDate, LEGAL_DOCUMENT_LIST } from "@/lib/legal";

/**
 * Acesso permanente aos documentos legais dentro do sistema — exigência de
 * transparência da LGPD (art. 9º): o titular precisa conseguir reler, a
 * qualquer momento, o texto que aceitou.
 */
export function LegalDocumentsCard() {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
          Documentos legais
        </CardTitle>
        <CardDescription>
          Termos de Uso e Política de Privacidade vigentes, com a versão que está em vigor na sua conta.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="divide-y divide-border-subtle border-t border-border-subtle">
          {LEGAL_DOCUMENT_LIST.map((doc) => (
            <li key={doc.slug}>
              <button
                type="button"
                onClick={() => navigate(doc.appPath)}
                className="flex w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{doc.title}</span>
                  <span className="mt-0.5 block text-xs tabular text-muted-foreground">
                    Versão {doc.version} · desde {formatLegalDate(doc.updatedAt)}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
