import { Settings2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { FamilyGroupSettings } from "@/components/family/FamilyGroupSettings";
import { LegalDocumentsCard } from "@/components/legal";
import { PasswordSettings, SubscriptionSettings } from "@/components/settings";
import { PageBody, PageHeader } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SECTIONS = [
  { value: "geral", label: "Geral" },
  { value: "seguranca", label: "Segurança" },
  { value: "assinatura", label: "Assinatura" },
] as const;

type Section = (typeof SECTIONS)[number]["value"];

const isSection = (value: string | null): value is Section => SECTIONS.some((section) => section.value === value);

/**
 * Configurações em três seções. A seção ativa vive na URL (`?secao=`): um link
 * direto para "Assinatura" ou "Segurança" abre na aba certa e recarregar a
 * página não perde a posição. Trocar de aba substitui a entrada do histórico.
 */
export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("secao");
  const section: Section = isSection(requested) ? requested : "geral";

  const handleSectionChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "geral") next.delete("secao");
    else next.set("secao", value);
    setSearchParams(next, { replace: true });
  };

  return (
    <PageBody>
      <PageHeader
        eyebrow="Conta"
        icon={Settings2}
        title="Configurações"
        description="Compartilhamento, senha e assinatura da sua conta."
      />

      <Tabs value={section} onValueChange={handleSectionChange} className="max-w-3xl">
        <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto" aria-label="Seções de configurações">
          {SECTIONS.map((item) => (
            <TabsTrigger key={item.value} value={item.value} className="sm:min-w-[7.5rem]">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="geral" className="mt-5 space-y-5 md:mt-6">
          <FamilyGroupSettings />
          <LegalDocumentsCard />
        </TabsContent>

        <TabsContent value="seguranca" className="mt-5 md:mt-6">
          <PasswordSettings />
        </TabsContent>

        <TabsContent value="assinatura" className="mt-5 md:mt-6">
          <SubscriptionSettings />
        </TabsContent>
      </Tabs>
    </PageBody>
  );
}
