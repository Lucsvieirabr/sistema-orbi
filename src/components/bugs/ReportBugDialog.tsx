import { useState } from "react";
import { Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useBugReports } from "@/hooks/use-bug-reports";
import { useToast } from "@/hooks/use-toast";

export function ReportBugDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");
  const { createBugReport } = useBugReports();
  const { toast } = useToast();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Converter para base64 ou URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagemUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!titulo.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, preencha o título.",
        variant: "destructive",
      });
      return;
    }

    if (!descricao.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, preencha a descrição.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await createBugReport(titulo, descricao, imagemUrl);
      setTitulo("");
      setDescricao("");
      setImagemUrl("");
      setOpen(false);
    } catch (error) {
      console.error("Erro ao reportar defeito:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-3 text-yellow-500 border-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-400"
        >
          <Bug className="h-4 w-4" />
          Defeitos e Sugestões
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-yellow-500" />
            Reportar Defeito ou Sugestão
          </DialogTitle>
          <DialogDescription>
            Ajude-nos a melhorar! Descreva o problema ou sua sugestão.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="titulo" className="text-sm font-medium">
              Título *
            </label>
            <Input
              id="titulo"
              placeholder="Ex: Erro ao importar extrato"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="descricao" className="text-sm font-medium">
              Descrição *
            </label>
            <Textarea
              id="descricao"
              placeholder="Descreva o defeito ou sugestão em detalhes..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              disabled={isLoading}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="imagem" className="text-sm font-medium">
              Imagem (opcional)
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="imagem"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isLoading}
                className="cursor-pointer"
              />
            </div>
            {imagemUrl && (
              <div className="relative w-full max-w-xs">
                <img
                  src={imagemUrl}
                  alt="Preview"
                  className="w-full h-auto rounded-md border border-input"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setImagemUrl("")}
                  className="absolute top-2 right-2"
                >
                  Remover
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Enviando..." : "Reportar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
