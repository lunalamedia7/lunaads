import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type OrgRole = "owner" | "admin" | "operator" | "viewer";

export type CurrentOrg = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: OrgRole;
};

type OrgMemberRow = {
  role: OrgRole;
  organizations: { id: string; name: string; slug: string; plan: string } | null;
};

export async function getCurrentOrg(): Promise<CurrentOrg | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("org_members")
    .select("role, organizations(id, name, slug, plan)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
    .returns<OrgMemberRow>();

  if (error || !data || !data.organizations) return null;

  return {
    id: data.organizations.id,
    name: data.organizations.name,
    slug: data.organizations.slug,
    plan: data.organizations.plan,
    role: data.role,
  };
}

const ROLE_RANK: Record<OrgRole, number> = { viewer: 0, operator: 1, admin: 2, owner: 3 };

export async function requireRole(minRole: OrgRole): Promise<CurrentOrg> {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");
  if (ROLE_RANK[org.role] < ROLE_RANK[minRole]) {
    redirect("/dashboard");
  }
  return org;
}
