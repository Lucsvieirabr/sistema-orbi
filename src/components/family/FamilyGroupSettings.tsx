import { useState } from "react";
import { Trash2, Loader2, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useFeature } from "@/hooks/use-feature";
import { useFamilyGroup } from "@/hooks/use-family-group";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/**
 * Plano Casal — bloco único dentro de Configurações.
 * Criar grupo -> adicionar e-mail do parceiro -> pronto.
 */
export function FamilyGroupSettings() {
  const { toast } = useToast();
  const { hasFeature, isLoading: featureLoading } = useFeature("familia_compartilhada");
  const {
    groupId,
    isOwner,
    members,
    isLoading,
    createGroup,
    addPartner,
    removePartner,
  } = useFamilyGroup();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  if (featureLoading || isLoading) {
    return null;
  }

  const fail = (e: any, fallback: string) =>
    toast({ title: "Erro", description: e?.message || fallback, variant: "destructive" as any });

  const handleCreate = async () => {
    setBusy(true);
    try {
      await createGroup();
      toast({ title: "Plano Casal criado", description: "Agora adicione o e-mail do seu parceiro." });
    } catch (e: any) {
      fail(e, "Não foi possível criar o Plano Casal.");
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async () => {
    if (!isValidEmail(email)) {
      toast({ title: "E-mail inválido", description: "Informe um e-mail válido.", variant: "destructive" as any });
      return;
    }
    setBusy(true);
    try {
      await addPartner(email);
      setEmail("");
      toast({ title: "Parceiro adicionado", description: "Ele terá acesso no próximo login no Orbi." });
    } catch (e: any) {
      fail(e, "Não foi possível adicionar o parceiro.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (id: string) => {
    setBusy(true);
    try {
      await removePartner(id);
      toast({ title: "Parceiro removido", description: "O acesso compartilhado foi revogado." });
    } catch (e: any) {
      fail(e, "Não foi possível remover o parceiro.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Plano Casal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasFeature ? (
          <p className="text-sm text-muted-foreground">
            Disponível no Plano Casal. Faça upgrade para compartilhar suas finanças com outra pessoa.
          </p>
        ) : !groupId ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Uma assinatura, dois acessos. O parceiro visualiza contas, cartões e transações compartilhadas.
            </p>
            <Button onClick={handleCreate} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Plano Casal
            </Button>
          </div>
        ) : !isOwner ? (
          <p className="text-sm text-muted-foreground">
            Você faz parte de um Plano Casal. Use o seletor <strong>Pessoal / Casal</strong> no Dashboard.
          </p>
        ) : (
          <div className="space-y-4">
            {members.length === 0 && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  placeholder="email@doparceiro.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  disabled={busy}
                />
                <Button onClick={handleAdd} disabled={busy} className="sm:w-auto">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Adicionar
                </Button>
              </div>
            )}

            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{member.email}</p>
                    <Badge variant={member.user_id ? "secondary" : "outline"} className="mt-1 text-xs">
                      {member.user_id ? "Ativo" : "Aguardando primeiro acesso"}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(member.id)}
                    disabled={busy}
                    aria-label={`Remover ${member.email}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {members.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  O parceiro precisa ter (ou criar) uma conta no Orbi com este mesmo e-mail.
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
