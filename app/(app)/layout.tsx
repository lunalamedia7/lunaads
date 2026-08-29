import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userName = (user.user_metadata?.full_name as string | undefined) ?? "";
  const userEmail = user.email ?? "";
  const org = await getCurrentOrg();

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar userName={userName} userEmail={userEmail} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar orgName={org?.name ?? "Minha organização"} userId={user.id} initialUnreadCount={unreadCount ?? 0} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
