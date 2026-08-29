"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Escuta mudanças via Supabase Realtime nas tabelas informadas (filtradas
 * pela org atual) e chama router.refresh() para o Server Component buscar
 * dados frescos — sem duplicar estado no client.
 */
export function RealtimeRefresh({ orgId, tables }: { orgId: string; tables: string[] }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // @supabase/ssr hidrata a sessão (cookie) de forma assíncrona — assinar
    // o canal antes disso manda o handshake do Realtime sem token, e a RLS
    // (is_org_member, que depende de auth.uid()) barra todo evento depois.
    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase.channel(`realtime-refresh-${orgId}-${tables.join("-")}`);
      for (const table of tables) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `org_id=eq.${orgId}` },
          () => router.refresh(),
        );
      }
      channel.subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tables comparado por valor via join
  }, [orgId, tables.join(","), router]);

  return null;
}
