-- Fase 11: tracking, pixel e atribuição.

create table public.pixels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  business_center_id uuid references public.business_centers (id) on delete set null,
  tiktok_pixel_id text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, tiktok_pixel_id)
);

alter table public.pixels enable row level security;
create policy "pixels_select_member" on public.pixels
  for select using (public.is_org_member(org_id));

create table public.tracking_domains (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  domain text not null,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, domain)
);

alter table public.tracking_domains enable row level security;
create policy "tracking_domains_select_member" on public.tracking_domains
  for select using (public.is_org_member(org_id));

-- Escrita de eventos de tracking é feita via service_role a partir de
-- /api/t/collect (requisição vem do navegador do visitante do site do
-- operador, sem sessão do LunaAds) — sem policy de insert/update aqui.

create table public.tracking_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  domain text not null,
  event_type text not null,
  session_id text not null,
  ttclid text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  occurred_at timestamptz not null default now(),
  constraint tracking_events_type_check
    check (event_type in ('PageView', 'ViewContent', 'InitiateCheckout', 'Purchase'))
);

create index tracking_events_org_id_idx on public.tracking_events (org_id, occurred_at desc);
create index tracking_events_session_idx on public.tracking_events (org_id, session_id);

alter table public.tracking_events enable row level security;
create policy "tracking_events_select_member" on public.tracking_events
  for select using (public.is_org_member(org_id));

create table public.attribution_settings (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  window_hours integer not null default 168,
  model text not null default 'last_click',
  updated_at timestamptz not null default now(),
  constraint attribution_settings_model_check check (model in ('last_click', 'first_click'))
);

alter table public.attribution_settings enable row level security;
create policy "attribution_settings_select_member" on public.attribution_settings
  for select using (public.is_org_member(org_id));

-- Purchase enviado por CAPI compartilha event_id com o pixel do TikTok
-- instalado no site do operador, pra deduplicar (mesmo evento, duas fontes).
alter table public.sales add column event_id text;
alter table public.sales add column capi_sent_at timestamptz;
alter table public.sales add column capi_response text;

alter table public.tracking_domains replica identity full;
alter publication supabase_realtime add table public.tracking_domains;
