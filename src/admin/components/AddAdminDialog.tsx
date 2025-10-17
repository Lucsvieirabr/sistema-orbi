import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
      // Validações
      if (!fullName.trim()) {
        throw new Error('Nome é obrigatório');
      }
      if (!email.trim()) {
        throw new Error('Email é obrigatório');
      }
      if (!password.trim() || password.length < 6) {
        throw new Error('Senha deve ter no mínimo 6 caracteres');
      }

      const { data, error } = await supabase
        .rpc('admin_create_admin_user', {
          p_email: email.trim(),
          p_password: password,
          p_full_name: fullName.trim()
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
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={createAdminMutation.isPending}
              required
              minLength={6}
            />
            <p className="text-xs text-muted-foreground">
              A senha deve ter no mínimo 6 caracteres
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

