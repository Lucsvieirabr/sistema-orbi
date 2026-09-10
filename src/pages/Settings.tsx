import { Settings2 } from "lucide-react";

import { FamilyGroupSettings } from "@/components/family/FamilyGroupSettings";
import { PageBody, PageHeader } from "@/components/ui/page";

export default function Settings() {
  return (
    <PageBody>
      <PageHeader
        eyebrow="Conta"
        icon={Settings2}
        title="Configurações"
        description="Preferências da sua conta e do compartilhamento com quem divide as finanças com você."
      />

      <FamilyGroupSettings />
    </PageBody>
  );
}
