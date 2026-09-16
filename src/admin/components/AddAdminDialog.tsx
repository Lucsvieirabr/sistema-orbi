import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-list'] });
      toast({
        title: "Administrador criado",
        description: `${fullName} foi adicionado como super admin com sucesso.`,
      });
      
      // Limpar formulário
      setFullName("");
      setEmail("");
      setPassword("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar administrador",
        description: error.message,
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
          <DialogTitle>Adicionar Administrador</DialogTitle>
          <DialogDescription>
            Criar novo super administrador no sistema
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome Completo *</Label>
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
            <Label htmlFor="email">Email *</Label>
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
            <Label htmlFor="password">Senha *</Label>
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
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Admin'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

