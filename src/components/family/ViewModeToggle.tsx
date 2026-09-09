import { useQueryClient } from "@tanstack/react-query";
import { User, Users } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useFamilyGroup } from "@/hooks/use-family-group";
import { useViewMode, setViewMode, type ViewMode } from "@/hooks/use-view-mode";

/**
 * Alterna entre dados Pessoais e dados do Casal.
 * Só aparece quando existe parceiro vinculado.
 */
export function ViewModeToggle() {
  const { isLinked } = useFamilyGroup();
  const mode = useViewMode();
  const queryClient = useQueryClient();

  if (!isLinked) return null;

  const handleChange = (value: string) => {
    if (!value || value === mode) return;
    setViewMode(value as ViewMode);
    queryClient.invalidateQueries();
  };

  return (
    <ToggleGroup
      type="single"
      value={mode}
      onValueChange={handleChange}
      className="justify-start"
      aria-label="Alternar entre modo pessoal e casal"
    >
      <ToggleGroupItem value="personal" aria-label="Modo pessoal" className="gap-2 px-3">
        <User className="h-4 w-4" />
        Pessoal
      </ToggleGroupItem>
      <ToggleGroupItem value="couple" aria-label="Modo casal" className="gap-2 px-3">
        <Users className="h-4 w-4" />
        Casal
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
