import { ToastAction } from "@/components/ui/toast";
import { toast } from "@/hooks/use-toast";
import { UPGRADE_PATH } from "@/lib/features/premium-modules";

import { describePlanningError } from "./planning-utils";

/** Toast de erro dos módulos de planejamento, com atalho para upgrade quando a causa é o plano. */
export function notifyPlanningError(title: string, error: unknown) {
  const { message, suggestUpgrade } = describePlanningError(error);
  toast({
    title,
    description: message,
    variant: "destructive",
    duration: 6000,
    action: suggestUpgrade ? (
      <ToastAction altText="Ver planos" onClick={() => window.location.assign(UPGRADE_PATH)}>
        Ver planos
      </ToastAction>
    ) : undefined,
  });
}

export function notifyPlanningSuccess(title: string, description?: string) {
  toast({ title, description, duration: 2500 });
}
