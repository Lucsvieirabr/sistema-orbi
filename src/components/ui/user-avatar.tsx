import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AVATAR_SIGNED_URL_TTL, initialsOf, isAvatarPath } from "@/lib/avatar";
import { signAvatarPath } from "@/lib/avatar-storage";
import { safeImageSrc } from "@/lib/safe-url";
import { cn } from "@/lib/utils";
import { isClientError } from "@/lib/query-client";

type Tone = "self" | "partner";

interface UserAvatarProps {
  /** Nome/apelido: vira iniciais quando não há foto. */
  name?: string | null;
  /** Caminho no bucket privado `avatars` (resolvido para signed URL). */
  avatarPath?: string | null;
  /** URL já resolvida (preview local `blob:` no uploader). Tem prioridade. */
  src?: string | null;
  /** self = navy do Orbi; partner = tom de identidade do casal (chart-6). */
  tone?: Tone;
  className?: string;
  /** Texto acessível; sem ele o avatar é decorativo. */
  label?: string;
}

const SIGNED_STALE_MS = (AVATAR_SIGNED_URL_TTL - 10 * 60) * 1000;

/** Signed URL compartilhada por caminho — React Query deduplica e renova antes de expirar. */
export function useAvatarSrc(path?: string | null) {
  const enabled = isAvatarPath(path);
  const { data } = useQuery({
    queryKey: ["avatar-url", path],
    queryFn: () => signAvatarPath(path),
    enabled,
    staleTime: SIGNED_STALE_MS,
    gcTime: SIGNED_STALE_MS,
    retry: (failureCount, error) => failureCount < 1 && !isClientError(error),
  });
  return enabled ? safeImageSrc(data) : null;
}

/**
 * Avatar global do Orbi — três estados, nesta ordem:
 *  1. Foto (`object-cover`, círculo perfeito);
 *  2. Iniciais do nome em cor sólida da paleta;
 *  3. Glifo de pessoa (sem nome nem foto).
 * Foto que falha ao carregar (URL expirada, 403) cai para 2/3 sem piscar.
 */
export function UserAvatar({ name, avatarPath, src, tone = "self", className, label }: UserAvatarProps) {
  const signed = useAvatarSrc(src ? null : avatarPath);
  const url = src ?? signed;
  const [failed, setFailed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const showImage = Boolean(url) && failed !== url;
  const initials = initialsOf(name);

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      title={label}
      className={cn(
        "relative inline-grid h-8 w-8 shrink-0 select-none place-items-center overflow-hidden rounded-full font-semibold leading-none",
        tone === "partner" ? "bg-chart-6 text-background" : "bg-primary text-primary-foreground",
        className,
      )}
    >
      {initials ? (
        <span className="tracking-tight">{initials}</span>
      ) : (
        <PersonGlyph />
      )}
      {showImage && (
        <img
          key={url}
          src={url}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          decoding="async"
          onLoad={() => setLoaded(url)}
          onError={() => setFailed(url)}
          className={cn(
            "absolute inset-0 h-full w-full rounded-full object-cover transition-opacity duration-200 ease-out",
            loaded === url ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </span>
  );
}

/** Busto minimalista (cabeça + ombros), herda a cor do texto. */
function PersonGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[62%] w-[62%] opacity-80" fill="currentColor" aria-hidden>
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4.5 20.25c0-3.6 3.36-6.25 7.5-6.25s7.5 2.65 7.5 6.25c0 .41-.34.75-.75.75H5.25a.75.75 0 0 1-.75-.75Z" />
    </svg>
  );
}
