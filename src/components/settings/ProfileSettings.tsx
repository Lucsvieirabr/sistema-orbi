import { useEffect, useId, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { AvatarUploader } from "@/components/settings/AvatarUploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { displayNameSchema, useProfile } from "@/hooks/use-profile";

/** Configurações → Geral: como você aparece para o parceiro no Nosso espaço. */
export function ProfileSettings() {
  const { toast } = useToast();
  const fieldId = useId();
  const { profile, isLoading, updateDisplayName } = useProfile();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(profile?.displayName ?? "");
  }, [profile?.displayName]);

  const current = profile?.displayName ?? "";
  const dirty = value.trim() !== current;
  const previewName = value.trim() || profile?.fullName || "";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !dirty) return;
    const parsed = displayNameSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Nome inválido");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const saved = await updateDisplayName(value);
      setValue(saved ?? "");
      toast({ title: "Nome atualizado", description: saved ? `Você aparece como ${saved}.` : "Voltamos a usar seu nome de cadastro." });
    } catch {
      toast({ title: "Não foi possível salvar", description: "Tente novamente em instantes.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} noValidate>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>Foto e nome que seu parceiro vê nos lançamentos do Nosso espaço.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AvatarUploader name={previewName} />
          <div className="max-w-sm space-y-2">
            <Label htmlFor={fieldId}>Nome de exibição</Label>
            <Input
              id={fieldId}
              value={value}
              maxLength={40}
              autoComplete="nickname"
              placeholder={profile?.fullName?.split(" ")[0] || "Como quer ser chamado"}
              disabled={isLoading || saving}
              aria-invalid={error ? true : undefined}
              aria-describedby={`${fieldId}-hint`}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) setError(null);
              }}
            />
            <p id={`${fieldId}-hint`} className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
              {error ?? "Apelido de até 40 caracteres. Em branco, usamos seu primeiro nome."}
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={!dirty || saving || isLoading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            Salvar
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
