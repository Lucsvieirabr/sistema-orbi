import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { assertUuid } from "@/lib/utils";

export interface UserNotification {
  id: string;
  kind: "budget_inflation" | "project_archived";
  title: string;
  body: string;
  actionPath: string | null;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export const NOTIFICATIONS_QUERY_KEY = ["user-notifications"] as const;

const SAFE_PATH = /^\/sistema(\/[a-z0-9-]+)*(\?[a-z0-9=&_-]*)?$/;

export function useNotifications() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: async (): Promise<UserNotification[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_notifications")
        .select("id, kind, title, body, action_path, payload, read_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: String(row.id),
        kind: row.kind === "project_archived" ? "project_archived" : "budget_inflation",
        title: String(row.title ?? ""),
        body: String(row.body ?? ""),
        actionPath: typeof row.action_path === "string" && SAFE_PATH.test(row.action_path) ? row.action_path : null,
        payload: (row.payload ?? {}) as Record<string, unknown>,
        readAt: row.read_at ?? null,
        createdAt: String(row.created_at ?? ""),
      }));
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ["personal-inflation"] }),
    ]);

  const markRead = async (id: string) => {
    const { error } = await supabase
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", assertUuid(id, "notification_id"));
    if (error) throw error;
    await invalidate();
  };

  const markAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (error) throw error;
    await invalidate();
  };

  const notifications = query.data ?? [];

  return {
    notifications,
    unread: notifications.filter((item) => !item.readAt).length,
    isLoading: query.isLoading,
    markRead,
    markAllRead,
  };
}
