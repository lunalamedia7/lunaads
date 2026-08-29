-- Fase 2: conexão com o TikTok Ads — tokens (nunca expostos ao client),
-- Business Centers e contas de anúncio sincronizados.

create table public.tiktok_connections (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  tiktok_app_id text not null,
  access_token_enc text not null,
  refresh_token_enc text,
  scopes text[] not null default '{}',
  expires_at timestamptz not null,
  status text not null default 'connected',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tiktok_connections_status_check
    check (status in ('connected', 'needs_reauth', 'disconnected'))
);

-- Sem policy de select/insert/update para authenticated/anon: esta tabela só
-- é lida/escrita pelo backend via client com a service_role key, que ignora
-- RLS. Isso garante que access_token_enc/refresh_token_enc nunca saem por
-- uma query feita a partir do navegador, mesmo que alguém tente um
-- `select *` direto pelo supabase-js do client.
alter table public.tiktok_connections enable row level security;

create table public.business_centers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  bc_id text not null,
  name text not null,
  alias text,
  company_name text not null default '',
  currency text not null,
  status text not null default 'active',
  can_read_finance boolean not null default true,
  balance numeric,
  balance_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, bc_id)
);

create table public.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  business_center_id uuid not null references public.business_centers (id) on delete cascade,
  advertiser_id text not null,
  name text not null,
  currency text not null,
  timezone text not null default 'UTC',
  status text not null default 'active',
  is_limited boolean not null default false,
  can_read_finance boolean not null default true,
  balance numeric,
  spend_today numeric,
  balance_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, advertiser_id)
);

create index business_centers_org_id_idx on public.business_centers (org_id);
create index ad_accounts_org_id_idx on public.ad_accounts (org_id);
create index ad_accounts_business_center_id_idx on public.ad_accounts (business_center_id);

alter table public.business_centers enable row level security;
alter table public.ad_accounts enable row level security;

create policy "business_centers_select_member" on public.business_centers
  for select using (public.is_org_member(org_id));

create policy "ad_accounts_select_member" on public.ad_accounts
  for select using (public.is_org_member(org_id));
