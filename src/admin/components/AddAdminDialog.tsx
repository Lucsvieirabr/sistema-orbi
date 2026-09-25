import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { rpcErrorMessage } from "@/admin/lib/admin-ui";
import { parseOrThrow, sanitizeSingleLine } from "@/lib/validation/schemas";
import { z } from "zod";

const ADMIN_PASSWORD_MIN = 12;

const adminUserSchema = z.object({
  fullName: z.preprocess(sanitizeSingleLine, z.string().min(1, "Nome é obrigatório").max(120, "Máximo de 120 caracteres")),
  email: z.preprocess(
    (v) => sanitizeSingleLine(v).toLowerCase(),
    z.string().email("Email inválido").max(254, "Email inválido"),
  ),
  password: z
    .string()
    .min(ADMIN_PASSWORD_MIN, `Senha deve ter no mínimo ${ADMIN_PASSWORD_MIN} caracteres`)
    .max(72, "Senha deve ter no máximo 72 caracteres")
    .regex(/[A-Za-z]/, "Senha deve conter letras")
    .regex(/[0-9]/, "Senha deve conter números"),
});

interface AddAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAdminDialog({ open, onOpenChange }: AddAdminDialogProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation para criar admin
  const createAdminMutation = useMutation({
    mutationFn: async () => {
      const safe = parseOrThrow(adminUserSchema, { fullName, email, password });

      const { data, error } = await supabase
        .rpc('admin_create_admin_user', {
          p_email: safe.email,
          p_password: safe.password,
          p_full_name: safe.fullName
        });

      if (error) throw error;
      return data as { user_id: string; created: boolean };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
      toast({
        title: result?.created ? "Administrador criado" : "Conta promovida a admin",
        description: result?.created
          ? `${fullName} já pode entrar no painel.`
          : "O e-mail já tinha conta no Orbi; ela ganhou acesso ao painel e a senha atual foi mantida.",
      });
      
      // Limpar formulário
      setFullName("");
      setEmail("");
      setPassword("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Não foi possível adicionar",
        // Sem `code` = erro da validação local (parseOrThrow), mensagem já é nossa.
        description: error?.code ? rpcErrorMessage(error) : error?.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAdminMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar administrador</DialogTitle>
          <DialogDescription>
            Acesso total ao painel. Se o e-mail já tiver conta no Orbi, ela é promovida e a senha abaixo é ignorada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Ex: João Silva"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={createAdminMutation.isPending}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="Ex: joao@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={createAdminMutation.isPending}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha inicial</Label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 12 caracteres, com letras e números"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={createAdminMutation.isPending}
              required
              minLength={ADMIN_PASSWORD_MIN}
              maxLength={72}
            />
            <p className="text-xs text-muted-foreground">
              A senha deve ter de 12 a 72 caracteres, com letras e números
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createAdminMutation.isPending}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createAdminMutation.isPending}
              className="flex-1"
            >
              {createAdminMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Salvando…
                </>
              ) : (
                'Adicionar'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

