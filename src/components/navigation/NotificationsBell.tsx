import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Flag, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications, type UserNotification } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

function timeAgo(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.round((date.getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

export function NotificationsBell() {
  const { notifications, unread, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const openItem = async (item: UserNotification) => {
    setOpen(false);
    if (!item.readAt) {
      try {
        await markRead(item.id);
      } catch {
        return;
      }
    }
    if (item.actionPath) navigate(item.actionPath);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={unread > 0 ? `Avisos, ${unread} não lidos` : "Avisos"} className="relative">
          <Bell className="h-4 w-4" aria-hidden />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-background animate-fade-in"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Avisos</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => markAllRead().catch(() => undefined)}>
              Marcar tudo como lido
            </Button>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum aviso por aqui.</p>
        ) : (
          <ul className="max-h-[min(24rem,70dvh)] divide-y divide-border-subtle overflow-y-auto overscroll-contain">
            {notifications.map((item) => {
              const Icon = item.kind === "project_archived" ? Flag : TrendingUp;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-200 ease-swift hover:bg-surface-sunken/70 focus-visible:bg-surface-sunken focus-visible:outline-none",
                      item.readAt && "opacity-70",
                    )}
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-sunken">
                      <Icon className={cn("h-3.5 w-3.5", item.kind === "budget_inflation" ? "text-warning" : "text-muted-foreground")} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                        {!item.readAt && <span aria-label="não lido" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                      </span>
                      <span className="mt-0.5 line-clamp-3 block text-xs leading-relaxed text-muted-foreground">{item.body}</span>
                      <span className="mt-1 block text-2xs text-muted-foreground">{timeAgo(item.createdAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
