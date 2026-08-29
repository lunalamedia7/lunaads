-- Fase 9: apelações de criativos reprovados.

alter table public.ads add column is_smart_plus boolean not null default false;
alter table public.ads add column reject_reason text;
alter table public.ads add column review_checked_at timestamptz;

create table public.appeal_settings (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  auto_appeal_enabled boolean not null default false,
  min_interval_seconds integer not null default 120,
  daily_cap_per_account integer not null default 20,
  failure_pause_threshold numeric not null default 0.3,
  paused_reason text,
  updated_at timestamptz not null default now()
);

alter table public.appeal_settings enable row level security;
create policy "appeal_settings_select_member" on public.appeal_settings
  for select using (public.is_org_member(org_id));

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  ad_id uuid not null references public.ads (id) on delete cascade,
  bc_id text,
  advertiser_id text not null,
  tiktok_campaign_id text,
  tiktok_adgroup_id text,
  tiktok_ad_id text not null,
  ad_name text not null,
  reject_reason text,
  strategy text not null default 'assisted',
  status text not null default 'pending',
  sent_text text,
  tiktok_response text,
  attempts integer not null default 0,
  next_run_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, tiktok_ad_id),
  constraint appeals_strategy_check check (strategy in ('api', 'assisted')),
  constraint appeals_status_check
    check (status in ('pending', 'queued', 'sent', 'approved', 'failed'))
);

create index appeals_org_id_idx on public.appeals (org_id, created_at desc);
create index appeals_due_idx on public.appeals (status, next_run_at) where status = 'queued';

alter table public.appeals enable row level security;
create policy "appeals_select_member" on public.appeals
  for select using (public.is_org_member(org_id));

alter table public.appeals replica identity full;
alter publication supabase_realtime add table public.appeals;
