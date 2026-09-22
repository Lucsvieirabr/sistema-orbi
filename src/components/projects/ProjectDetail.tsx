import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowUpRight,
  CalendarRange,
  Flag,
  FolderKanban,
  Link2,
  Pencil,
  Plus,
  RotateCw,
  Split,
  Trash2,
  Unlink,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";

import { LedgerStrip, type LedgerTone } from "@/components/planning/LedgerStrip";
import { notifyPlanningError, notifyPlanningSuccess } from "@/components/planning/notify";
import {
  describePlanningError,
  formatDateMedium,
  formatDayMonth,
  formatMoney,
  formatMonthAbbr,
  formatMonthName,
  formatPct,
  formatSignedMoney,
  plural,
} from "@/components/planning/planning-utils";
import { PartnerBadge } from "@/components/family/PartnerBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconRenderer } from "@/components/ui/icon-renderer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, PageBody, PageHeader, SectionHeader } from "@/components/ui/page";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { useFeature } from "@/hooks/use-feature";
import { useLedgers } from "@/hooks/use-ledgers";
import { useProject, useProjects, type ProjectOverview, type ProjectTransaction } from "@/hooks/use-projects";
import { useChartPalette } from "@/lib/chart-colors";
import { cn, getCurrentDateString } from "@/lib/utils";
import "@/lib/features/orbi-features";

import { AttachTransactionsDialog } from "./AttachTransactionsDialog";
import { PaceMeter } from "./PaceMeter";
import { ProjectEditor, type ProjectEditorState } from "./ProjectEditor";
import { addDaysKey, kindLabel, reportSentence } from "./project-meta";

const STATUS_BADGE: Record<string, { label: string; variant: "success" | "warning" | "outline" }> = {
  PAID: { label: "Pago", variant: "success" },
  PENDING: { label: "Agendado", variant: "warning" },
};

const compactMoney = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function ProjectDetail({ projectId, onDeleted }: { projectId: string; onDeleted: () => void }) {
  const {
    data,
    isLoading,
    error,
    refetch,
    updateProject,
    deleteProject,
    archiveProject,
    reopenProject,
    linkLedger,
    attachTransactions,
    detachTransaction,
  } = useProject(projectId);
  const { createProject } = useProjects({ enabled: false });
  const [editor, setEditor] = useState<ProjectEditorState | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [archiving, setArchiving] = useState(false);

  if (isLoading) {
    return (
      <PageBody aria-busy="true">
        <div className="space-y-3 border-b border-border-subtle pb-5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>
        <Skeleton className="h-[7.5rem] w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-6">
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </PageBody>
    );
  }

  if (error || !data) {
    return (
      <PageBody>
        <EmptyState
          icon={FolderKanban}
          title="Não deu para abrir o projeto"
          description={describePlanningError(error).message}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" asChild>
                <Link to="/sistema/projects">
                  <ArrowLeft aria-hidden />
                  Voltar aos projetos
                </Link>
              </Button>
              <Button variant="outline" onClick={() => refetch()}>
                <RotateCw aria-hidden />
                Tentar de novo
              </Button>
            </div>
          }
        />
      </PageBody>
    );
  }

  const { project, totals, pace } = data;
  const archived = project.status === "archived";
  const readOnly = !project.isOwner;
  const frozen = archived || readOnly;
  const remainingTone: LedgerTone = totals.remaining < 0 ? "negative" : pace.budgetPct !== null && pace.budgetPct > pace.timePct + 15 ? "warning" : "neutral";

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const report = await archiveProject();
      notifyPlanningSuccess("Projeto arquivado", report ? reportSentence(project.name, report).lead : "O relatório final está pronto.");
    } catch (err) {
      notifyPlanningError("Não foi possível arquivar", err);
    } finally {
      setArchiving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProject();
      notifyPlanningSuccess(
        "Projeto excluído",
        project.goalId ? "Os lançamentos continuam no extrato e a meta voltou a aceitar aportes." : "Os lançamentos continuam no extrato, sem vínculo.",
      );
      onDeleted();
    } catch (err) {
      notifyPlanningError("Não foi possível excluir", err);
    }
  };

  return (
    <PageBody>
      <PageHeader
        eyebrow={
          <Link
            to="/sistema/projects"
            className="inline-flex items-center gap-1 rounded-sm transition-colors duration-200 ease-swift hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden />
            Projetos de vida
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="min-w-0 break-words">{project.name}</span>
            <Badge variant={archived ? "outline" : "success"}>{archived ? "Arquivado" : "Em andamento"}</Badge>
            {readOnly && <PartnerBadge userId={project.userId} />}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <CalendarRange className="h-3.5 w-3.5" aria-hidden />
              <span className="tabular">
                {formatDateMedium(project.startDate)} a {formatDateMedium(project.endDate)}
              </span>
            </span>
            <span aria-hidden>·</span>
            <span>{kindLabel(project.kind)}</span>
            {project.description && (
              <>
                <span aria-hidden>·</span>
                <span>{project.description}</span>
              </>
            )}
          </span>
        }
        actions={
          readOnly ? null : archived ? (
            <>
              <ConfirmationDialog
                title="Excluir projeto"
                description={`“${project.name}” e o relatório final serão apagados. Os lançamentos continuam no extrato.`}
                confirmText="Excluir projeto"
                variant="destructive"
                onConfirm={handleDelete}
              >
                <Button variant="ghost" size="icon" aria-label="Excluir projeto" className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive">
                  <Trash2 aria-hidden />
                </Button>
              </ConfirmationDialog>
              <Button variant="outline" onClick={() => setReopening(true)} className="flex-1 sm:flex-none">
                <ArchiveRestore aria-hidden />
                Reabrir projeto
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Editar projeto"
                onClick={() =>
                  setEditor({
                    mode: "edit",
                    projectId: project.id,
                    fundedFromGoal: project.fundedFromGoal,
                    input: {
                      name: project.name,
                      description: project.description,
                      kind: project.kind,
                      icon: project.icon,
                      color: project.color,
                      budget: project.budget,
                      startDate: project.startDate,
                      endDate: project.endDate,
                    },
                  })
                }
              >
                <Pencil aria-hidden />
              </Button>
              <ConfirmationDialog
                title="Excluir projeto"
                description={`“${project.name}” sai da lista e os lançamentos voltam a contar no DRE do mês. Nada é apagado do extrato.`}
                confirmText="Excluir projeto"
                variant="destructive"
                onConfirm={handleDelete}
              >
                <Button variant="ghost" size="icon" aria-label="Excluir projeto" className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive">
                  <Trash2 aria-hidden />
                </Button>
              </ConfirmationDialog>
              <ConfirmationDialog
                title="Arquivar projeto"
                description={`O relatório final de “${project.name}” é gerado agora e a tela fica congelada. Os lançamentos continuam no extrato para auditoria. Dá para reabrir depois.`}
                confirmText="Arquivar e gerar relatório"
                onConfirm={handleArchive}
              >
                <Button variant="outline" disabled={archiving} className="flex-1 sm:flex-none">
                  {archiving ? <Spinner className="h-4 w-4" /> : <Archive aria-hidden />}
                  Arquivar
                </Button>
              </ConfirmationDialog>
              <Button onClick={() => setAttaching(true)} className="flex-1 sm:flex-none">
                <Link2 aria-hidden />
                Vincular lançamentos
              </Button>
            </>
          )
        }
      />

      {archived && project.finalReport && <FinalReport overview={data} />}

      <LedgerStrip
        aria-label={`Resumo de ${project.name}`}
        cells={[
          {
            label: "Orçamento total",
            value: formatMoney(project.budget),
            hint: project.goalId ? (
              <span>
                {formatMoney(project.fundedFromGoal)} vieram da meta{" "}
                <Link to="/sistema/goals" className="font-medium text-foreground underline-offset-4 hover:underline">
                  {project.goalName ?? "executada"}
                </Link>
                {project.budget > project.fundedFromGoal && ` · ${formatMoney(project.budget - project.fundedFromGoal)} somados à parte`}
              </span>
            ) : (
              "Definido por você ao criar o projeto."
            ),
          },
          {
            label: "Custo realizado",
            value: formatMoney(totals.cost),
            hint: (
              <span className="tabular">
                {formatMoney(totals.spent)} pagos
                {totals.committed > 0 && ` · ${formatMoney(totals.committed)} agendados`}
                {totals.compensation > 0 && ` · ${formatMoney(totals.compensation)} compensados por terceiros`}
              </span>
            ),
          },
          {
            label: totals.remaining < 0 ? "Acima do orçamento" : "Saldo remanescente",
            value: totals.remaining < 0 ? formatMoney(Math.abs(totals.remaining)) : formatMoney(totals.remaining),
            tone: remainingTone,
            hint: archived
              ? `Fechado em ${formatDateMedium(project.finalReport?.closedOn || project.endDate)}.`
              : pace.daysElapsed <= 0
                ? `Começa em ${formatDateMedium(project.startDate)}.`
                : `${plural(Math.max(pace.daysTotal - pace.daysElapsed, 0), "dia restante", "dias restantes")} de ${pace.daysTotal}.`,
          },
        ]}
        footer={
          <div className="border-t border-border-subtle px-4 py-4 md:px-5 lg:px-6">
            <PaceMeter
              budget={project.budget}
              spent={totals.spent}
              committed={totals.committed}
              timePct={pace.timePct}
              color={project.color}
              archived={archived}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-6">
        <MiniDreCard overview={data} />
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          <CategoriesCard overview={data} />
          <SplitCard overview={data} frozen={frozen} onLink={linkLedger} />
        </div>
      </div>

      {data.timeline.some((point) => point.paid > 0 || point.pending > 0) && <TimelineCard overview={data} />}

      <TransactionsCard
        overview={data}
        frozen={frozen}
        onAttach={() => setAttaching(true)}
        onDetach={async (id) => {
          try {
            await detachTransaction(id);
            notifyPlanningSuccess("Lançamento desvinculado", "Ele continua no extrato e volta a contar no DRE do mês.");
          } catch (err) {
            notifyPlanningError("Não foi possível desvincular", err);
          }
        }}
      />

      {!frozen && (
        <AttachTransactionsDialog
          open={attaching}
          projectId={project.id}
          projectName={project.name}
          startDate={project.startDate}
          endDate={project.endDate}
          onClose={() => setAttaching(false)}
          onAttach={attachTransactions}
        />
      )}

      <ProjectEditor state={editor} onClose={() => setEditor(null)} onCreate={createProject} onUpdate={updateProject} />

      <ReopenDialog
        open={reopening}
        endDate={project.endDate}
        onClose={() => setReopening(false)}
        onConfirm={async (nextEnd) => {
          await reopenProject(nextEnd);
          notifyPlanningSuccess("Projeto reaberto", "O relatório anterior foi descartado. Um novo sai quando você arquivar de novo.");
        }}
      />
    </PageBody>
  );
}

function FinalReport({ overview }: { overview: ProjectOverview }) {
  const { project } = overview;
  const report = project.finalReport!;
  const sentence = reportSentence(project.name, report);

  return (
    <section
      aria-labelledby="project-report-title"
      className="relative isolate overflow-hidden rounded-xl border border-border bg-card animate-rise"
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: project.color }} />
      <div className="grid gap-5 px-4 py-5 md:px-6 md:py-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-10">
        <div className="min-w-0">
          <h2 id="project-report-title" className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Flag className="h-3.5 w-3.5" aria-hidden />
            Relatório final
          </h2>
          <p className="mt-3 font-display text-lg font-semibold leading-snug tracking-[-0.015em] text-foreground text-balance md:text-xl">
            {sentence.lead}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
            {report.auto ? "Arquivado automaticamente no dia seguinte à data final." : "Arquivado por você."} As{" "}
            {plural(report.transactions, "transação continua", "transações continuam")} no extrato para auditoria
            {report.pending > 0 ? `, ${plural(report.pending, "ainda agendada", "ainda agendadas")}` : ""}.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Orçamento</dt>
            <dd className="mt-0.5 tabular text-foreground">{formatMoney(report.budget)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Diferença</dt>
            <dd className={cn("mt-0.5 tabular", sentence.tone === "negative" ? "text-destructive" : sentence.tone === "positive" ? "text-success" : "text-foreground")}>
              {formatSignedMoney(report.variance)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Duração</dt>
            <dd className="mt-0.5 tabular text-foreground">{plural(report.days, "dia", "dias")}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Compensado por terceiros</dt>
            <dd className="mt-0.5 tabular text-foreground">{formatMoney(report.compensation)}</dd>
          </div>
          {report.topCategories.length > 0 && (
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Onde mais pesou</dt>
              <dd className="mt-0.5 text-foreground">
                {report.topCategories
                  .slice(0, 3)
                  .map((category) => `${category.name} (${formatMoney(category.amount)})`)
                  .join(" · ")}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}

function MiniDreCard({ overview }: { overview: ProjectOverview }) {
  const { project, totals } = overview;
  const available = project.budget - totals.cost;
  const lines: Array<{ label: string; value: number; kind: "total" | "line" | "result" | "note"; tone?: "positive" | "negative" }> = [
    { label: "Orçamento global", value: project.budget, kind: "total" },
    { label: "(−) Pago", value: totals.spent, kind: "line" },
    { label: "(−) Agendado", value: totals.committed, kind: "line" },
    { label: "(=) Disponível", value: available, kind: "result", tone: available >= 0 ? "positive" : "negative" },
  ];
  const secondary: Array<{ label: string; value: number }> = [
    { label: "Gasto bruto no projeto", value: totals.gross },
    { label: "(−) Compensado por terceiros", value: totals.compensation },
    { label: "Receitas ligadas ao projeto", value: totals.income },
  ].filter((line) => line.value > 0);

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          title="Mini-DRE do projeto"
          description="Orçamento contra o que já saiu e o que está agendado. Gastos rateados entram pelo valor líquido."
        />
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <caption className="sr-only">Demonstrativo do projeto {project.name}</caption>
          <tbody>
            {lines.map((line) => (
              <tr key={line.label} className={cn("border-t border-border-subtle first:border-t-0", line.kind === "result" && "border-border")}>
                <th
                  scope="row"
                  className={cn(
                    "py-2.5 text-left",
                    line.kind === "line" ? "pl-3 font-normal text-muted-foreground" : "font-medium text-foreground",
                  )}
                >
                  {line.label}
                </th>
                <td
                  className={cn(
                    "py-2.5 text-right tabular",
                    line.kind === "result" && "font-semibold",
                    line.tone === "positive" && "text-success",
                    line.tone === "negative" && "text-destructive",
                    !line.tone && "text-foreground",
                  )}
                >
                  {line.kind === "result" ? formatSignedMoney(line.value) : formatMoney(line.value)}
                </td>
                <td className="w-16 py-2.5 text-right text-xs tabular text-muted-foreground">
                  {project.budget > 0 && line.kind !== "total" ? formatPct((line.value / project.budget) * 100, { digits: 0 }) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {secondary.length > 0 && (
          <dl className="mt-4 space-y-1.5 border-t border-border-subtle pt-3 text-xs">
            {secondary.map((line) => (
              <div key={line.label} className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">{line.label}</dt>
                <dd className="tabular text-foreground">{formatMoney(line.value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function CategoriesCard({ overview }: { overview: ProjectOverview }) {
  const { series } = useChartPalette();
  const { categories, totals } = overview;
  const max = Math.max(...categories.map((category) => category.amount), 0);

  return (
    <Card>
      <CardHeader>
        <SectionHeader title="Por categoria" description="As categorias continuam as mesmas do extrato. O projeto só as agrupa." />
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem gastos no projeto ainda.</p>
        ) : (
          <ol className="space-y-3">
            {categories.map((category, index) => (
              <li key={category.categoryId ?? `none-${index}`}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-sunken">
                    <IconRenderer iconName={category.icon ?? "circle"} className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{category.name}</span>
                  <span className="shrink-0 text-sm tabular text-foreground">{formatMoney(category.amount)}</span>
                  <span className="w-10 shrink-0 text-right text-xs tabular text-muted-foreground">
                    {totals.cost > 0 ? formatPct((category.amount / totals.cost) * 100, { digits: 0 }) : "—"}
                  </span>
                </div>
                <div className="ml-[2.375rem] mt-1.5 h-px bg-border-subtle">
                  <div
                    className="h-px origin-left transition-transform duration-500 ease-swift motion-reduce:transition-none"
                    style={{ backgroundColor: series[index % series.length], transform: `scaleX(${max > 0 ? category.amount / max : 0})` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function SplitCard({
  overview,
  frozen,
  onLink,
}: {
  overview: ProjectOverview;
  frozen: boolean;
  onLink: (ledgerId: string) => Promise<void>;
}) {
  const { project } = overview;
  const { hasFeature } = useFeature("contratos_rateio");
  const { createLedger } = useLedgers({ enabled: false });
  const [creating, setCreating] = useState(false);

  if (!hasFeature) return null;
  if (!project.ledgerId && (frozen || project.kind !== "trip")) return null;

  const create = async () => {
    setCreating(true);
    try {
      const ledgerId = await createLedger({
        name: project.name,
        description: null,
        startDate: project.startDate,
        endDate: project.endDate,
        ownerWeight: 1,
        pixKey: null,
        pixName: null,
      });
      await onLink(ledgerId);
      notifyPlanningSuccess("Acerto criado", "Os próximos gastos do projeto entram no rateio automaticamente.");
    } catch (err) {
      notifyPlanningError("Não foi possível criar o acerto", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          title="Acerto entre pessoas"
          description={
            project.ledgerId
              ? "Cada gasto lançado no projeto entra no fechamento da viagem: quem pagou, quanto cabia a cada um e o PIX de cobrança."
              : "Viajando com outras pessoas? Crie o acerto e os gastos do projeto passam a entrar no rateio."
          }
        />
      </CardHeader>
      <CardContent>
        {project.ledgerId ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-sunken px-3.5 py-3">
            <span className="flex min-w-0 items-center gap-2.5">
              <Split className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{project.ledgerName ?? project.name}</span>
                <span className="block text-xs text-muted-foreground">{project.ledgerStatus === "settled" ? "Liquidado" : "Em aberto"}</span>
              </span>
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/sistema/ledgers?evento=${project.ledgerId}`}>
                Abrir fechamento
                <ArrowUpRight aria-hidden />
              </Link>
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={create} disabled={creating} className="w-full">
            {creating ? <Spinner className="h-4 w-4" /> : <Plus aria-hidden />}
            Criar acerto da viagem
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineCard({ overview }: { overview: ProjectOverview }) {
  const { semantic, series } = useChartPalette();
  const data = useMemo(
    () =>
      overview.timeline.map((point) => ({
        ...point,
        label: formatMonthAbbr(point.month).replace(/^./, (char) => char.toUpperCase()),
      })),
    [overview.timeline],
  );
  const color = series[0];

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          title="Como o projeto drena o caixa"
          description="Gasto líquido por mês de competência. O agendado já aparece na Projeção de caixa."
          actions={
            <ul className="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Legenda">
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
                Pago
              </li>
              <li className="flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-sm opacity-40" style={{ backgroundColor: color }} />
                Agendado
              </li>
            </ul>
          }
        />
      </CardHeader>
      <CardContent>
        <div className="h-52 w-full md:h-60" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="30%" margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke={semantic.border} strokeOpacity={0.5} />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: semantic.border }} tick={{ fill: semantic.muted, fontSize: 12 }} />
              <YAxis width={64} tickLine={false} axisLine={false} tick={{ fill: semantic.muted, fontSize: 11 }} tickFormatter={(value: number) => compactMoney.format(value)} />
              <Tooltip cursor={{ fill: "hsl(var(--accent))", opacity: 0.5 }} content={<TimelineTooltip />} />
              <Bar dataKey="paid" name="Pago" stackId="cost" fill={color} maxBarSize={28} />
              <Bar dataKey="pending" name="Agendado" stackId="cost" fill={color} fillOpacity={0.4} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="sr-only">
          <caption>Gasto do projeto por mês</caption>
          <thead>
            <tr>
              <th scope="col">Mês</th>
              <th scope="col">Pago</th>
              <th scope="col">Agendado</th>
            </tr>
          </thead>
          <tbody>
            {overview.timeline.map((point) => (
              <tr key={point.month}>
                <th scope="row">{formatMonthName(point.month)}</th>
                <td>{formatMoney(point.paid)}</td>
                <td>{formatMoney(point.pending)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function TimelineTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="mt-0.5 tabular text-muted-foreground">
          {entry.name}: <span className="text-foreground">{formatMoney(Number(entry.value ?? 0))}</span>
        </p>
      ))}
    </div>
  );
}

function TransactionsCard({
  overview,
  frozen,
  onAttach,
  onDetach,
}: {
  overview: ProjectOverview;
  frozen: boolean;
  onAttach: () => void;
  onDetach: (id: string) => Promise<void>;
}) {
  const { transactions, totals } = overview;

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          title="Lançamentos do projeto"
          description={
            transactions.length > 0
              ? `${plural(totals.transactions, "lançamento", "lançamentos")}${totals.pending > 0 ? ` · ${plural(totals.pending, "agendado", "agendados")}` : ""}.`
              : "No Extrato, escolha este projeto ao lançar, ou vincule o que já foi lançado."
          }
          actions={
            !frozen && transactions.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={onAttach}>
                <Plus aria-hidden />
                Vincular
              </Button>
            ) : null
          }
        />
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          frozen ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento ficou ligado a este projeto.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button variant="outline" onClick={onAttach}>
                <Link2 aria-hidden />
                Vincular do extrato
              </Button>
              <Button variant="outline" asChild>
                <Link to="/sistema/statement?new=1">
                  <Plus aria-hidden />
                  Lançar gasto novo
                </Link>
              </Button>
            </div>
          )
        ) : (
          <ul className="divide-y divide-border-subtle">
            {transactions.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} frozen={frozen} onDetach={onDetach} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TransactionRow({
  transaction,
  frozen,
  onDetach,
}: {
  transaction: ProjectTransaction;
  frozen: boolean;
  onDetach: (id: string) => Promise<void>;
}) {
  const badge = STATUS_BADGE[transaction.status];
  const income = transaction.type === "income";

  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="w-11 shrink-0 text-xs font-medium tabular text-muted-foreground">{formatDayMonth(transaction.date)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground" title={transaction.description}>
          {transaction.description}
        </span>
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          {badge && <Badge variant={badge.variant} className="px-1.5 py-0 text-2xs">{badge.label}</Badge>}
          <span className="truncate">
            {transaction.categoryName ?? "Sem categoria"}
            {transaction.paymentLabel ? ` · ${transaction.paymentLabel}` : ""}
            {transaction.ledgerId ? " · no acerto" : ""}
          </span>
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className={cn("block text-sm tabular", income ? "text-success" : "text-foreground")}>
          {income ? "+" : ""}
          {formatMoney(transaction.net)}
        </span>
        {transaction.compensation > 0 && (
          <span className="block text-2xs tabular text-muted-foreground">de {formatMoney(transaction.value)}</span>
        )}
      </span>
      {!frozen && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Tirar ${transaction.description} do projeto`}
          title="Tirar do projeto (continua no extrato)"
          onClick={() => onDetach(transaction.id)}
        >
          <Unlink aria-hidden />
        </Button>
      )}
    </li>
  );
}

function ReopenDialog({
  open,
  endDate,
  onClose,
  onConfirm,
}: {
  open: boolean;
  endDate: string;
  onClose: () => void;
  onConfirm: (endDate: string) => Promise<void>;
}) {
  const today = getCurrentDateString();
  const [nextEnd, setNextEnd] = useState(endDate >= today ? endDate : addDaysKey(today, 30));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await onConfirm(nextEnd);
      onClose();
    } catch (err) {
      notifyPlanningError("Não foi possível reabrir", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reabrir projeto</DialogTitle>
          <DialogDescription>O relatório final é descartado e o projeto volta a aceitar lançamentos até a nova data final.</DialogDescription>
        </DialogHeader>
        <div className="mt-5 space-y-2">
          <Label htmlFor="reopen-end">Nova data final</Label>
          <Input id="reopen-end" type="date" min={today} max="2100-12-31" value={nextEnd} onChange={(event) => setNextEnd(event.target.value)} />
        </div>
        <DialogFooter className="mt-6">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={saving || !nextEnd || nextEnd < today}>
            {saving ? <Spinner className="h-4 w-4 text-primary-foreground" /> : <ArchiveRestore aria-hidden />}
            Reabrir projeto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

