import { useState } from "react";
import { Bug, ImageIcon } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBugReports, type BugReport } from "@/hooks/use-bug-reports";
import { safeImageSrc } from "@/lib/safe-url";
import { cn } from "@/lib/utils";
import { formatDate, formatInt, formatRelative } from "@/admin/lib/admin-ui";

/**
 * Kanban de relatos. O admin só move estágios: relato é conteúdo do usuário e
 * não é apagado pelo painel (LGPD) — o que não procede vai para "Rejeitado".
 */
const STAGES = [
  { value: "novo",               label: "Novo",               dot: "bg-info",              variant: "info" },
  { value: "em-analise",         label: "Em análise",         dot: "bg-warning",           variant: "warning" },
  { value: "em-desenvolvimento", label: "Em desenvolvimento", dot: "bg-chart-6",           variant: "secondary" },
  { value: "resolvido",          label: "Resolvido",          dot: "bg-success",           variant: "success" },
  { value: "rejeitado",          label: "Rejeitado",          dot: "bg-muted-foreground",  variant: "outline" },
] as const;

type Stage = (typeof STAGES)[number]["value"];
const stageOf = (v: string) => STAGES.find((s) => s.value === v) ?? STAGES[0];

function StageBadge({ status }: { status: string }) {
  const s = stageOf(status);
  return (
    <Badge variant={s.variant} className="gap-1.5">
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </Badge>
  );
}

export default function BugReportsManagement() {
  const { bugReports, isLoading, updateBugReportStatus } = useBugReports(true);
  const [selected, setSelected] = useState<BugReport | null>(null);
  const [dragged, setDragged] = useState<BugReport | null>(null);
  const [over, setOver] = useState<Stage | null>(null);

  const move = async (report: BugReport, status: string) => {
    if (report.status === status) return;
    try {
      await updateBugReportStatus(report.id, status);
      setSelected((cur) => (cur?.id === report.id ? { ...cur, status } : cur));
    } catch {
      /* o hook já mostra o toast */
    }
  };

  const open = bugReports.filter((r) => r.status !== "resolvido" && r.status !== "rejeitado").length;

  return (
    <div className="min-w-0 space-y-5 md:space-y-7">
      <PageHeader
        eyebrow="Administração"
        icon={Bug}
        title="Defeitos & sugestões"
        description={`${formatInt(open)} em aberto de ${formatInt(bugReports.length)} relatos. Arraste um cartão ou abra-o para mudar o estágio.`}
      />

      {!isLoading && bugReports.length === 0 ? (
        <EmptyState icon={Bug} title="Nenhum relato ainda" description="Quando alguém reportar um defeito ou sugestão, ele aparece aqui." />
      ) : (
        <div className="scroll-x -mx-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
          <div className="grid min-w-[60rem] grid-cols-5 gap-3 lg:min-w-0 lg:gap-4">
            {STAGES.map((stage) => {
              const items = bugReports.filter((r) => r.status === stage.value);
              const isOver = over === stage.value && dragged?.status !== stage.value;
              return (
                <section
                  key={stage.value}
                  aria-label={stage.label}
                  onDragOver={(e) => { e.preventDefault(); setOver(stage.value); }}
                  onDragLeave={() => setOver((o) => (o === stage.value ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragged) move(dragged, stage.value);
                    setDragged(null);
                    setOver(null);
                  }}
                  className={cn(
                    "flex min-h-[28rem] flex-col rounded-xl border bg-surface-sunken/60 p-2 transition-colors duration-200 ease-swift",
                    isOver ? "border-ring/60 bg-surface-sunken" : "border-border-subtle",
                  )}
                >
                  <header className="flex items-center gap-2 px-2 pb-3 pt-2">
                    <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", stage.dot)} />
                    <h2 className="text-sm font-medium text-foreground">{stage.label}</h2>
                    <span className="ml-auto text-xs tabular text-muted-foreground">{formatInt(items.length)}</span>
                  </header>

                  <ul className="flex-1 space-y-2">
                    {isLoading ? (
                      <>
                        <Skeleton className="h-24 w-full rounded-lg" />
                        <Skeleton className="h-24 w-full rounded-lg" />
                      </>
                    ) : items.length === 0 ? (
                      <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                        Vazio
                      </li>
                    ) : (
                      items.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            draggable
                            onDragStart={(e) => { setDragged(r); e.dataTransfer.effectAllowed = "move"; }}
                            onDragEnd={() => { setDragged(null); setOver(null); }}
                            onClick={() => setSelected(r)}
                            className={cn(
                              "press w-full cursor-grab rounded-lg border border-border bg-card p-3 text-left transition-[border-color,opacity] duration-200 ease-swift active:cursor-grabbing",
                              "hover:border-ring/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              dragged?.id === r.id && "opacity-50",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="line-clamp-2 text-sm font-medium text-foreground">{r.titulo}</p>
                              {r.imagem_url && <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Com imagem" />}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{r.descricao}</p>
                            <p className="mt-2 text-2xs text-muted-foreground">{formatRelative(r.created_at)}</p>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[36rem]">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6 leading-snug">{selected.titulo}</DialogTitle>
                <DialogDescription>
                  Enviado em {formatDate(selected.created_at, "dd 'de' MMMM 'de' yyyy 'às' HH:mm")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{selected.descricao}</p>

                {safeImageSrc(selected.imagem_url) && (
                  <img
                    src={safeImageSrc(selected.imagem_url)}
                    referrerPolicy="no-referrer"
                    alt={`Captura anexada ao relato: ${selected.titulo}`}
                    loading="lazy"
                    decoding="async"
                    className="max-h-72 w-full rounded-lg border border-border object-contain"
                  />
                )}

                <div className="flex flex-col gap-2 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <StageBadge status={selected.status} />
                  <Select value={selected.status} onValueChange={(v) => move(selected, v)}>
                    <SelectTrigger className="sm:w-56" aria-label="Mudar estágio">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
