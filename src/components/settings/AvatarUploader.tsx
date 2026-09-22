import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useToast } from "@/hooks/use-toast";
import { AvatarFileError, useProfile } from "@/hooks/use-profile";
import { AVATAR_ACCEPT } from "@/lib/avatar";
import { cn } from "@/lib/utils";

/**
 * Foto de perfil: clique no avatar → escolhe arquivo → preview imediato
 * (blob: local) com spinner discreto enquanto sobe. Validação completa
 * (2 MB, JPG/PNG/WebP, magic bytes) roda antes de qualquer rede.
 */
export function AvatarUploader({ name }: { name?: string | null }) {
  const { toast } = useToast();
  const { profile, changeAvatar, removeAvatar } = useProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!file || busy) return;

    setPreview(URL.createObjectURL(file));
    setBusy("upload");
    try {
      await changeAvatar(file);
      toast({ title: "Foto atualizada", description: "Seu parceiro já vê a nova foto no Nosso espaço." });
    } catch (error) {
      toast({
        title: "Não foi possível trocar a foto",
        description:
          error instanceof AvatarFileError ? error.message : "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setPreview(null);
      setBusy(null);
    }
  };

  const handleRemove = async () => {
    if (busy) return;
    setBusy("remove");
    try {
      await removeAvatar();
      toast({ title: "Foto removida" });
    } catch {
      toast({ title: "Não foi possível remover a foto", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const hasPhoto = Boolean(profile?.avatarPath);

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy !== null}
        aria-label={hasPhoto ? "Trocar foto de perfil" : "Adicionar foto de perfil"}
        className={cn(
          "group press relative shrink-0 rounded-full outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-progress",
        )}
      >
        <UserAvatar
          name={name}
          avatarPath={profile?.avatarPath}
          src={preview}
          className="h-20 w-20 text-2xl ring-1 ring-inset ring-border-subtle"
        />
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 grid place-items-center rounded-full bg-foreground/45 text-background transition-opacity duration-200 ease-out",
            busy === "upload" ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
          )}
        >
          {busy === "upload" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
        </span>
        <span className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full bg-background text-foreground shadow-sm ring-1 ring-border-subtle">
          <Camera className="h-3.5 w-3.5" aria-hidden />
        </span>
      </button>

      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => inputRef.current?.click()}>
            {hasPhoto ? "Trocar foto" : "Enviar foto"}
          </Button>
          {hasPhoto && (
            <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={handleRemove}>
              {busy === "remove" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
              Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG ou WebP, até 2 MB. Visível só para você e seu parceiro.</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleFile}
      />
    </div>
  );
}
