import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { getAccessToken } from "@/lib/tiktok/connection";
import { getTikTokProvider } from "@/lib/tiktok";

export async function syncPixels(orgId: string): Promise<{ count: number }> {
  const db = createServiceClient();
  const accessToken = await getAccessToken(orgId);
  const provider = getTikTokProvider();

  const { data: businessCenters } = await db
    .from("business_centers")
    .select("id, bc_id")
    .eq("org_id", orgId);

  let count = 0;
  for (const bc of businessCenters ?? []) {
    const pixels = await provider.listPixels(accessToken, bc.bc_id);
    for (const pixel of pixels) {
      await db.from("pixels").upsert(
        {
          org_id: orgId,
          business_center_id: bc.id,
          tiktok_pixel_id: pixel.pixelId,
          name: pixel.name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,tiktok_pixel_id" },
      );
      count += 1;
    }
  }
  return { count };
}
