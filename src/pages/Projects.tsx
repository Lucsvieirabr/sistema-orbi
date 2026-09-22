import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CalendarRange, Flag, FolderKanban, Plus, RotateCw, Split, Target } from "lucide-react";

import { formatDateMedium, formatMoney, formatPct, plural, describePlanningError } from "@/components/planning/planning-utils";
import { PaceMeter } from "@/components/projects/PaceMeter";
import { ProjectDetail } from "@/components/projects/ProjectDetail";
import { ProjectEditor, type ProjectEditorState } from "@/components/projects/ProjectEditor";
import { kindLabel, reportSentence } from "@/components/projects/project-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { IconRenderer } from "@/components/ui/icon-renderer";
import { EmptyState, PageBody, PageHeader, PageToolbar, SectionHeader, ToolbarSpacer } from "@/components/ui/page";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { useProjects, type ProjectSummary } from "@/hooks/use-projects";
import { cn, getCurrentDateString, isUuid } from "@/lib/utils";

function daysBetween(from: string, to: string) {
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

function timePct(project: ProjectSummary, today: string) {
  const total = daysBetween(project.startDate, project.endDate) + 1;
  const elapsed = Math.min(Math.max(daysBetween(project.startDate, today) + 1, 0), total);
  return total > 0 ? (elapsed / total) * 100 : 0;
}

export default function Projects() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const projectParam = params.get("projeto");
  const projectId = isUuid(projectParam) ? projectParam : null;

  if (projectId) {
    return <ProjectDetail key={projectId} projectId={projectId} onDeleted={() => navigate("/sistema/projects", { replace: true })} />;
  }

  return <ProjectList onOpen={(id) => navigate(`/sistema/projects?projeto=${id}`)} />;
}

function ProjectList({ onOpen }: { onOpen: (id: string) => void }) {
  const { projects, isLoading, isFetching, error, refetch, createProject } = useProjects();
  const [editor, setEditor] = useState<ProjectEditorState | null>(null);
  const today = getCurrentDateString();

  const active = useMemo(() => projects.filter((project) => project.status === "active"), [projects]);
  const archived = useMemo(() => projects.filter((project) => project.status === "archived"), [projects]);
  const activeBudget = active.reduce((sum, project) => sum + project.totals.budget, 0);
  const activeCost = active.reduce((sum, project) => sum + project.totals.cost, 0);

  return (
    <PageBody>
      <PageHeader
        eyebrow="Planejamento"
        icon={FolderKanban}
        title="Projetos de vida"
        description="Grandes eventos com orçamento próprio. O que entra aqui não distorce a média do mês nem dispara alerta de orçamento."
        actions={
          <Button onClick={() => setEditor({ mode: "create" })} className="w-full sm:w-auto">
            <Plus aria-hidden />
            Novo projeto
          </Button>
        }
      />

      {projects.length > 0 && (
        <PageToolbar>
          <p className="text-sm tabular text-muted-foreground">
            {active.length > 0 ? (
              <>
                <span className="font-medium text-foreground">{formatMoney(activeCost)}</span> realizados de{" "}
                {formatMoney(activeBudget)} em {plural(active.length, "projeto ativo", "projetos ativos")}
              </>
            ) : (
              "Nenhum projeto em andamento"
            )}
          </p>
          <ToolbarSpacer />
          <div className="flex items-center gap-3">
            {isFetching && !isLoading && <Spinner className="h-4 w-4" />}
          </div>
        </PageToolbar>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[16.5rem] w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={FolderKanban}
          title="Não deu para carregar os projetos"
          description={describePlanningError(error).message}
          action={
            <Button variant="outline" onClick={() => refetch()}>
              <RotateCw aria-hidden />
              Tentar de novo
            </Button>
          }
        />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Nenhum projeto ainda"
          description="Crie um projeto para o casamento, a reforma ou a viagem. Se você já guardou dinheiro numa meta, execute a meta e o valor vira o orçamento."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setEditor({ mode: "create" })}>
                <Plus aria-hidden />
                Criar projeto
              </Button>
              <Button variant="outline" asChild>
                <Link to="/sistema/goals">
                  <Target aria-hidden />
                  Executar uma meta
                </Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-7">
          {active.length > 0 && (
            <section aria-labelledby="projects-active" className="space-y-3">
              <SectionHeader title={<span id="projects-active">Em andamento</span>} description={plural(active.length, "projeto", "projetos")} />
              <ProjectGrid projects={active} today={today} onOpen={onOpen} />
            </section>
          )}
          {archived.length > 0 && (
            <section aria-labelledby="projects-archived" className="space-y-3">
              <SectionHeader
                title={<span id="projects-archived">Arquivados</span>}
                description="Congelados para consulta. Os lançamentos continuam no extrato."
              />
              <ProjectGrid projects={archived} today={today} onOpen={onOpen} />
            </section>
          )}
        </div>
      )}

      <ProjectEditor
        state={editor}
        onClose={() => setEditor(null)}
        onCreate={async (input) => {
          const id = await createProject(input);
          onOpen(id);
          return id;
        }}
        onUpdate={async () => undefined}
      />
    </PageBody>
  );
}

function ProjectGrid({ projects, today, onOpen }: { projects: ProjectSummary[]; today: string; onOpen: (id: string) => void }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project, index) => (
        <ProjectCard key={project.id} project={project} index={index} today={today} onOpen={onOpen} />
      ))}
    </ul>
  );
}

function ProjectCard({
  project,
  index,
  today,
  onOpen,
}: {
  project: ProjectSummary;
  index: number;
  today: string;
  onOpen: (id: string) => void;
}) {
  const archived = project.status === "archived";
  const { totals } = project;
  const pct = timePct(project, today);
  const report = archived && project.finalReport ? reportSentence(project.name, project.finalReport) : null;
  const upcoming = !archived && project.startDate > today;

  return (
    <li className="flex animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
      <Card interactive className={cn("relative isolate flex w-full flex-col overflow-hidden", archived && "bg-surface-sunken/40")}>
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: project.color }} />
        <CardHeader className="gap-0 space-y-0">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken">
              <IconRenderer iconName={project.icon} className="h-4 w-4 text-muted-foreground" fallbackIcon={FolderKanban} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-display text-[0.9375rem] font-semibold tracking-[-0.015em] text-foreground" title={project.name}>
                {project.name}
              </h3>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarRange className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate tabular">
                  {kindLabel(project.kind)} · {formatDateMedium(project.startDate)} a {formatDateMedium(project.endDate)}
                </span>
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {archived ? (
              <Badge variant="outline">
                <Flag className="h-3 w-3" aria-hidden />
                Arquivado
              </Badge>
            ) : upcoming ? (
              <Badge variant="outline">Começa em {formatDateMedium(project.startDate)}</Badge>
            ) : (
              <Badge variant="success">Em andamento</Badge>
            )}
            {project.goalId && (
              <Badge variant="outline">
                <Target className="h-3 w-3" aria-hidden />
                Veio da meta
              </Badge>
            )}
            {project.ledgerId && (
              <Badge variant="outline">
                <Split className="h-3 w-3" aria-hidden />
                Com acerto
              </Badge>
            )}
            {!project.isOwner && <Badge variant="outline">Parceiro</Badge>}
          </div>
        </CardHeader>

        <CardContent className="mt-auto">
          {report ? (
            <p className={cn("text-sm leading-relaxed text-pretty", report.tone === "negative" ? "text-destructive" : "text-foreground")}>
              {report.lead}
            </p>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <p className="figure-lg tabular text-foreground">{formatMoney(totals.cost)}</p>
                <p className="text-sm font-medium tabular text-muted-foreground">
                  {totals.budget > 0 ? formatPct((totals.cost / totals.budget) * 100, { digits: 0 }) : "—"}
                </p>
              </div>
              <p className="text-xs tabular text-muted-foreground">de {formatMoney(totals.budget)} orçados</p>
              <PaceMeter
                className="mt-3"
                compact
                budget={totals.budget}
                spent={totals.spent}
                committed={totals.committed}
                timePct={pct}
                color={project.color}
              />
              <p className={cn("mt-2 text-xs tabular", totals.remaining < 0 ? "text-destructive" : "text-muted-foreground")}>
                {totals.remaining < 0
                  ? `Passou ${formatMoney(Math.abs(totals.remaining))} do orçamento`
                  : `Restam ${formatMoney(totals.remaining)} · ${formatPct(pct, { digits: 0 })} do prazo`}
              </p>
            </>
          )}
        </CardContent>

        <CardFooter>
          <Button variant="outline" size="sm" className="w-full" onClick={() => onOpen(project.id)}>
            {archived ? "Ver relatório" : "Abrir projeto"}
          </Button>
        </CardFooter>
      </Card>
    </li>
  );
}
