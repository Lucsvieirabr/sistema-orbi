import orbiLogo from "@/assets/orbi-logo_dark.png";
import { UserAvatar } from "@/components/ui/user-avatar";
import "./orbit.css";

export interface OrbitPerson {
  name: string;
  avatarPath: string | null;
}

/**
 * Espera com cara de eclipse: disco escuro e um arco de luz que dá a volta.
 * Decorativo — o texto de status fica com quem usa.
 */
export function EclipseLoader() {
  return (
    <div className="orbit-eclipse" aria-hidden>
      <span className="orbit-eclipse__halo" />
      <span className="orbit-eclipse__sweep">
        <span className="orbit-eclipse__corona" />
        <span className="orbit-eclipse__spark" />
      </span>
      <span className="orbit-eclipse__moon" />
    </div>
  );
}

/**
 * O momento do aceite do Plano Casal: os dois chegam de lados opostos, são
 * capturados pela mesma órbita em torno do logo e seguem girando juntos,
 * cada um com o próprio rastro de luz. Estilos em `orbit.css`.
 */
export function OrbitUnion({ me, partner }: { me: OrbitPerson; partner: OrbitPerson }) {
  return (
    <div className="orbit-scene" aria-hidden>
      <span className="orbit-track orbit-track--outer" />
      <span className="orbit-track" />

      <div className="orbit-core">
        <div className="orbit-mark-glow">
          <div className="orbit-mark">
            <img src={orbiLogo} alt="" width={500} height={500} decoding="async" draggable={false} />
          </div>
        </div>
      </div>

      <div className="orbit-ring">
        <span className="orbit-trail" />
        <OrbitBody person={me} side="self" />
        <OrbitBody person={partner} side="partner" />
      </div>
    </div>
  );
}

function OrbitBody({ person, side }: { person: OrbitPerson; side: "self" | "partner" }) {
  return (
    <div className={`orbit-body orbit-body--${side}`}>
      <div className="orbit-upright">
        <div className="orbit-glass">
          <UserAvatar
            name={person.name}
            avatarPath={person.avatarPath}
            tone={side}
            className="h-full w-full text-lg sm:text-xl"
          />
        </div>
      </div>
    </div>
  );
}
