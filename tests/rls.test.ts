import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type TestUser = {
  id: string;
  email: string;
  orgId: string;
  client: SupabaseClient;
};

async function createSignedInUser(emailPrefix: string): Promise<TestUser> {
  const email = `${emailPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = "Test1234!rls";

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw new Error(`falha ao criar usuário de teste: ${createError?.message}`);
  }

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    throw new Error(`falha ao logar usuário de teste: ${signInError.message}`);
  }

  const { data: membership, error: membershipError } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", created.user.id)
    .single();
  if (membershipError || !membership) {
    throw new Error(`usuário de teste sem organização (trigger não rodou?): ${membershipError?.message}`);
  }

  return { id: created.user.id, email, orgId: membership.org_id, client };
}

describe("RLS: isolamento entre organizações", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    userA = await createSignedInUser("rls-user-a");
    userB = await createSignedInUser("rls-user-b");
  }, 30_000);

  afterAll(async () => {
    await admin.auth.admin.deleteUser(userA.id);
    await admin.auth.admin.deleteUser(userB.id);
    await admin.from("organizations").delete().in("id", [userA.orgId, userB.orgId]);
  });

  it("cada usuário enxerga a própria organização", async () => {
    const { data, error } = await userA.client.from("organizations").select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(userA.orgId);
  });

  it("usuário A não consegue ler a organização do usuário B", async () => {
    const { data, error } = await userA.client
      .from("organizations")
      .select("id")
      .eq("id", userB.orgId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("usuário A não consegue ler org_members da organização do usuário B", async () => {
    const { data, error } = await userA.client
      .from("org_members")
      .select("org_id, user_id")
      .eq("org_id", userB.orgId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("usuário A não consegue ler audit_log da organização do usuário B", async () => {
    const { data, error } = await userA.client
      .from("audit_log")
      .select("id")
      .eq("org_id", userB.orgId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("a criação de organização gravou um evento em audit_log", async () => {
    const { data, error } = await userA.client
      .from("audit_log")
      .select("action, entity")
      .eq("org_id", userA.orgId)
      .eq("action", "org.created");
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThanOrEqual(1);
  });
});
