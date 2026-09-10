import { useLocation, useNavigate } from "react-router-dom";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <p className="label-eyebrow flex items-center gap-1.5">
          <Compass className="h-3 w-3" aria-hidden />
          Erro 404
        </p>
        <h1 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-[-0.02em] text-balance md:text-3xl">
          Esta página não existe.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-pretty text-muted-foreground">
          O endereço <code className="rounded border border-border-subtle bg-surface-sunken px-1.5 py-0.5 text-sm">
            {location.pathname}
          </code>{" "}
          não corresponde a nenhuma tela do Orbi. Pode ter sido renomeado ou digitado errado.
        </p>
        <div className="mt-8 flex flex-col gap-2 border-t border-border-subtle pt-6 sm:flex-row">
          <Button onClick={() => navigate("/sistema")} className="sm:flex-1">
            Ir para o sistema
          </Button>
          <Button variant="ghost" onClick={() => navigate(-1)} className="sm:flex-1">
            Voltar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
