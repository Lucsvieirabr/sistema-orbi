import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, PageToolbar } from "@/components/ui/page";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { AddAdminDialog } from "@/admin/components/AddAdminDialog";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDate, formatInt, formatRelative, rpcErrorMessage } from "@/admin/lib/admin-ui";

interface AdminRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

export default function AdminManagement() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const { adminUser } = useAdminAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: admins = [], isLoading, error } = useQuery<AdminRow[]>({
    queryKey: ["admin-list"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_admins");
      if (error) throw error;
      return (data ?? []) as AdminRow[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const { error } = await supabase.rpc("admin_toggle_admin", { p_user_id: userId, p_is_active: active });
      if (error) throw error;
    },
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-list"] });
      toast({ title: active ? "Acesso reativado" : "Acesso desativado" });
    },
    onError: (e) => toast({ title: "Não foi possível alterar o acesso", description: rpcErrorMessage(e), variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return admins.filter((a) => !q || a.email?.toLowerCase().includes(q) || a.full_name?.toLowerCase().includes(q));
  }, [admins, search]);

  const activeCount = admins.filter((a) => a.is_active).length;

  return (
    <div className="min-w-0 space-y-5 md:space-y-7">
      <PageHeader
        eyebrow="Administração"
        icon={Shield}
        title="Administradores"
        description={`${formatInt(activeCount)} com acesso ativo. Um só papel: todo admin tem acesso total ao painel.`}
        actions={
          <Button onClick={() => setAddOpen(true)} className="press w-full sm:w-auto">
            <Plus className="h-4 w-4" aria-hidden />
            Adicionar admin
          </Button>
        }
      />

      <PageToolbar>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Buscar por nome ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Buscar administradores"
          />
        </div>
      </PageToolbar>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : error ? (
        <EmptyState icon={Shield} title="Não foi possível carregar" description={rpcErrorMessage(error)} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="Nenhum administrador encontrado"
          description={search ? `Nada corresponde a “${search}”.` : "Adicione a primeira pessoa com acesso ao painel."}
        />
      ) : (
        <ul className="surface divide-y divide-border-subtle overflow-hidden">
          {filtered.map((a) => {
            const name = a.full_name || a.email || "Sem nome";
            const isSelf = a.user_id === adminUser?.user_id;
            return (
              <li
                key={a.user_id}
                className={cn(
                  "flex flex-col gap-3 p-4 transition-colors duration-200 ease-swift hover:bg-surface-sunken/60 sm:flex-row sm:items-center lg:px-6",
                  !a.is_active && "text-muted-foreground",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken font-display text-xs font-semibold",
                      a.is_active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {initials(name)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("truncate font-medium", a.is_active && "text-foreground")}>{name}</span>
                      {isSelf && <Badge variant="secondary">Você</Badge>}
                      {!a.is_active && <Badge variant="outline">Inativo</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-6 text-xs sm:flex sm:items-center">
                  <div>
                    <dt className="text-muted-foreground">Desde</dt>
                    <dd className="tabular text-foreground">{formatDate(a.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Último acesso</dt>
                    <dd className="text-foreground">{formatRelative(a.last_sign_in_at)}</dd>
                  </div>
                </dl>

                <div className="flex justify-end sm:w-32">
                  {a.is_active ? (
                    <ConfirmationDialog
                      title={`Desativar o acesso de ${name}?`}
                      description="A pessoa perde o acesso ao painel na hora. A conta dela no Orbi continua intacta e o acesso pode ser reativado."
                      confirmText="Desativar"
                      variant="destructive"
                      onConfirm={() => toggle.mutate({ userId: a.user_id, active: false })}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isSelf || toggle.isPending}
                        title={isSelf ? "Você não pode desativar o próprio acesso" : undefined}
                        className="hover:bg-destructive-soft hover:text-destructive"
                      >
                        Desativar
                      </Button>
                    </ConfirmationDialog>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ userId: a.user_id, active: true })}
                    >
                      Reativar
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AddAdminDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
