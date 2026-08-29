-- Fase 8: espelho local da estrutura de campanhas do TikTok (campanha →
-- conjunto → anúncio), com métricas cacheadas — o Gerenciador nunca chama
-- a API a cada render, só lê o que o job de sync já gravou.

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts (id) on delete cascade,
  tiktok_campaign_id text not null,
  name text not null,
  objective text,
  status text not null default 'active',
  budget_mode text,
  budget_amount numeric,
  spend numeric,
  impressions bigint,
  clicks bigint,
  conversions bigint,
  metrics_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, tiktok_campaign_id)
);

create table public.ad_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  tiktok_adgroup_id text not null,
  name text not null,
  status text not null default 'active',
  budget_mode text,
  budget_amount numeric,
  spend numeric,
  impressions bigint,
  clicks bigint,
  conversions bigint,
  metrics_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, tiktok_adgroup_id)
);

create table public.ads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  ad_group_id uuid not null references public.ad_groups (id) on delete cascade,
  tiktok_ad_id text not null,
  name text not null,
  status text not null default 'active',
  spend numeric,
  impressions bigint,
  clicks bigint,
  conversions bigint,
  metrics_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, tiktok_ad_id)
);

create index campaigns_org_id_idx on public.campaigns (org_id);
create index campaigns_ad_account_id_idx on public.campaigns (ad_account_id);
create index ad_groups_campaign_id_idx on public.ad_groups (campaign_id);
create index ads_ad_group_id_idx on public.ads (ad_group_id);

alter table public.campaigns enable row level security;
alter table public.ad_groups enable row level security;
alter table public.ads enable row level security;

create policy "campaigns_select_member" on public.campaigns
  for select using (public.is_org_member(org_id));
create policy "ad_groups_select_member" on public.ad_groups
  for select using (public.is_org_member(org_id));
create policy "ads_select_member" on public.ads
  for select using (public.is_org_member(org_id));

alter table public.campaigns replica identity full;
alter table public.ad_groups replica identity full;
alter publication supabase_realtime add table public.campaigns;
alter publication supabase_realtime add table public.ad_groups;
