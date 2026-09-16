import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFeature } from "@/hooks/use-feature";
import { useProjectOptions } from "@/hooks/use-projects";
import "@/lib/features/orbi-features";

export function ProjectPicker({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
}) {
  const { hasFeature } = useFeature("projetos_vida");
  const { data: projects = [] } = useProjectOptions({ enabled: hasFeature });

  if (!hasFeature) return null;
  const options = projects.filter((project) => project.status === "active" || project.id === value);
  if (options.length === 0) return null;

  return (
    <div className="space-y-1">
      <Label htmlFor="transaction-project" className="text-sm">
        Projeto de vida
      </Label>
      <Select value={value ?? "none"} onValueChange={(next) => onChange(next === "none" ? null : next)} disabled={disabled}>
        <SelectTrigger id="transaction-project" aria-describedby="transaction-project-hint">
          <SelectValue placeholder="Nenhum" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nenhum</SelectItem>
          {options.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
                {project.name}
                {project.status === "archived" ? " (arquivado)" : ""}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p id="transaction-project-hint" className="text-xs text-muted-foreground">
        Fica fora do DRE e dos orçamentos do mês.
      </p>
    </div>
  );
}
