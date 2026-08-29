-- Fase 4: ingestão de vendas via webhook de plataformas de checkout.

create table public.checkout_integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  platform text not null,
  webhook_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  secret_enc text,
  is_active boolean not null default true,
  field_map jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checkout_integrations_platform_check
    check (platform in ('hotmart', 'kiwify', 'generic'))
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  integration_id uuid not null references public.checkout_integrations (id) on delete cascade,
  platform text not null,
  raw jsonb not null,
  signature_ok boolean not null,
  dedupe_key text not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (org_id, dedupe_key)
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  platform text not null,
  external_id text not null,
  status text not null,
  gross_amount numeric not null default 0,
  net_amount numeric not null default 0,
  currency text not null default 'BRL',
  payment_method text,
  occurred_at timestamptz not null default now(),
  paid_at timestamptz,
  buyer_hash text,
  buyer_first_name text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  tiktok_campaign_id text,
  ad_id text,
  product_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, platform, external_id),
  constraint sales_status_check
    check (status in ('initiated', 'pending', 'paid', 'refunded', 'chargeback')),
  constraint sales_payment_method_check
    check (payment_method is null or payment_method in ('pix', 'card', 'boleto'))
);

create index webhook_events_org_id_idx on public.webhook_events (org_id, created_at desc);
create index webhook_events_unprocessed_idx on public.webhook_events (org_id) where error is not null;
create index sales_org_id_idx on public.sales (org_id, occurred_at desc);
create index sales_status_idx on public.sales (org_id, status);
create index sales_tiktok_campaign_idx on public.sales (org_id, tiktok_campaign_id);

-- checkout_integrations guarda secret_enc: mesma política de tiktok_connections
-- (sem policy de select/insert/update para authenticated/anon, só service_role).
alter table public.checkout_integrations enable row level security;

alter table public.webhook_events enable row level security;
alter table public.sales enable row level security;

create policy "webhook_events_select_member" on public.webhook_events
  for select using (public.is_org_member(org_id));

create policy "sales_select_member" on public.sales
  for select using (public.is_org_member(org_id));

alter publication supabase_realtime add table public.sales;
