"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { RefreshCw, Bell, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { createClient } from "@/lib/supabase/client";

export function Topbar({
  orgName,
  userId,
  initialUnreadCount,
}: {
  orgName: string;
  userId: string;
  initialUnreadCount: number;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // @supabase/ssr hidrata a sessão (guardada em cookie) de forma
    // assíncrona — se o channel().subscribe() rodar antes disso, o handshake
    // do WebSocket de Realtime sai sem token e a RLS de notifications (que é
    // por user_id = auth.uid()) nunca deixa nenhum evento passar. Por isso
    // esperamos a sessão resolver antes de assinar o canal.
    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`notifications-bell-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          () => {
            supabase
              .from("notifications")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId)
              .is("read_at", null)
              .then(({ count }) => setUnreadCount(count ?? 0));
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
      <OrgSwitcher orgName={orgName} />

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => router.refresh()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            }
          />
          <TooltipContent>Atualizar dados</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                <Sun className="hidden h-4 w-4 dark:block" />
                <Moon className="h-4 w-4 dark:hidden" />
              </Button>
            }
          />
          <TooltipContent>Alternar tema</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                nativeButton={false}
                className="relative h-9 w-9 rounded-full"
                render={<Link href="/notificacoes" />}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 ? (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </Button>
            }
          />
          <TooltipContent>Notificações</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
