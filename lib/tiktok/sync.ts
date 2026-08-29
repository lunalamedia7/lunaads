import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getTikTokProvider } from "@/lib/tiktok";
import { getAccessToken } from "@/lib/tiktok/connection";
import { notifyOrg } from "@/lib/notifications";

// Abaixo disso conta com saldo baixo — fixo em BRL por enquanto (PRECISA
// CONFIRMAR NA DOC se compensa converter por moeda da conta).
const LOW_BALANCE_THRESHOLD = 50;

export { TikTokNeedsReauthError } from "@/lib/tiktok/connection";

export async function syncBusinessCenters(orgId: string): Promise<{ count: number }> {
  const db = createServiceClient();
  const accessToken = await getAccessToken(orgId);
  const provider = getTikTokProvider();
  const businessCenters = await provider.listBusinessCenters(accessToken);

  for (const bc of businessCenters) {
    await db
      .from("business_centers")
      .upsert(
        {
          org_id: orgId,
          bc_id: bc.bcId,
          name: bc.name,
          company_name: bc.companyName,
          currency: bc.currency,
          status: bc.status,
          can_read_finance: bc.canReadFinance,
          balance: bc.canReadFinance ? bc.balance : null,
          balance_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,bc_id" },
      );
  }

  await db
    .from("audit_log")
    .insert({
      org_id: orgId,
      actor_id: null,
      action: "tiktok.sync_business_centers",
      entity: "business_center",
      entity_id: null,
      payload: { count: businessCenters.length },
    });

  return { count: businessCenters.length };
}

export async function syncAdAccounts(orgId: string): Promise<{ count: number }> {
  const db = createServiceClient();
  const accessToken = await getAccessToken(orgId);
  const provider = getTikTokProvider();

  const { data: businessCenters, error } = await db
    .from("business_centers")
    .select("id, bc_id")
    .eq("org_id", orgId);

  if (error || !businessCenters) return { count: 0 };

  const { data: existingAccounts } = await db
    .from("ad_accounts")
    .select("advertiser_id, name, is_limited, balance")
    .eq("org_id", orgId);
  const previousByAdvertiser = new Map((existingAccounts ?? []).map((a) => [a.advertiser_id, a]));

  let total = 0;
  for (const bc of businessCenters) {
    const accounts = await provider.listAdAccounts(accessToken, bc.bc_id);
    for (const account of accounts) {
      const previous = previousByAdvertiser.get(account.advertiserId);
      const newBalance = account.canReadFinance ? account.balance : null;

      await db
        .from("ad_accounts")
        .upsert(
          {
            org_id: orgId,
            business_center_id: bc.id,
            advertiser_id: account.advertiserId,
            name: account.name,
            currency: account.currency,
            timezone: account.timezone,
            status: account.status,
            is_limited: account.isLimited,
            can_read_finance: account.canReadFinance,
            balance: newBalance,
            balance_updated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "org_id,advertiser_id" },
        );
      total += 1;

      // Só notifica na transição (evita spam a cada sync de 5 em 5 min).
      if (account.isLimited && previous && !previous.is_limited) {
        await notifyOrg(orgId, {
          type: "conta_limitada",
          title: "Conta ficou limitada",
          body: `${account.name} (${account.advertiserId}) foi marcada como limitada pelo TikTok.`,
          link: "/contas",
        });
      }
      if (
        newBalance !== null &&
        newBalance < LOW_BALANCE_THRESHOLD &&
        (!previous || previous.balance === null || previous.balance >= LOW_BALANCE_THRESHOLD)
      ) {
        await notifyOrg(orgId, {
          type: "saldo_baixo",
          title: "Saldo baixo em conta de anúncios",
          body: `${account.name} (${account.advertiserId}) está com saldo de ${newBalance.toFixed(2)}.`,
          link: "/contas",
        });
      }
    }
  }

  await db
    .from("audit_log")
    .insert({
      org_id: orgId,
      actor_id: null,
      action: "tiktok.sync_ad_accounts",
      entity: "ad_account",
      entity_id: null,
      payload: { count: total },
    });

  return { count: total };
}

export async function syncAll(orgId: string) {
  const bcResult = await syncBusinessCenters(orgId);
  const accountsResult = await syncAdAccounts(orgId);
  await createServiceClient()
    .from("tiktok_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("org_id", orgId);
  return { businessCenters: bcResult.count, adAccounts: accountsResult.count };
}
