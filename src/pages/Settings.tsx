import { FamilyGroupSettings } from "@/components/family/FamilyGroupSettings";

export default function Settings() {
  return (
    <div className="min-w-0 space-y-4 md:space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-lg font-semibold tracking-tight md:text-xl">Configurações</h2>
        <p className="text-sm text-muted-foreground">Preferências do usuário e do app.</p>
      </div>

      <FamilyGroupSettings />
    </div>
  );
}
