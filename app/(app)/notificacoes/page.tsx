import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";
import { NotificationsView, type NotificationRow } from "@/components/notifications/notifications-view";

export default async function NotificacoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <EmptyState icon={Bell} title="Não foi possível carregar suas notificações" />;

  const { data: notificationsRaw } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const notifications: NotificationRow[] = notificationsRaw ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[34px] font-bold tracking-tight text-foreground">Notificações</h1>
        <p className="mt-1 text-sm text-text-muted">Alertas de saldo, contas, criativos, lotes e automações.</p>
      </div>
      <NotificationsView notifications={notifications} />
    </div>
  );
}
