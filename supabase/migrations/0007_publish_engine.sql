-- Fase 7: motor de publicação em massa. Execução no servidor via fila
-- durável orientada a cron (não depende do navegador ficar aberto).

create table public.publish_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  template_snapshot jsonb not null,
  total integer not null default 0,
  done integer not null default 0,
  failed integer not null default 0,
  mode text not null default 'safe',
  status text not null default 'running',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publish_batches_mode_check check (mode in ('safe', 'fast')),
  constraint publish_batches_status_check check (status in ('running', 'completed', 'failed'))
);

create table public.publish_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.publish_batches (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  ad_account_id uuid not null references public.ad_accounts (id) on delete cascade,
  advertiser_id text not null,
  sequence integer not null default 0,
  idempotency_key text not null unique,
  status text not null default 'queued',
  attempt integer not null default 0,
  next_run_at timestamptz not null default now(),
  step text,
  tiktok_campaign_id text,
  tiktok_adgroup_id text,
  tiktok_ad_id text,
  error_code text,
  error_message text,
  request_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publish_jobs_status_check check (status in ('queued', 'running', 'ok', 'failed'))
);

create index publish_batches_org_id_idx on public.publish_batches (org_id, created_at desc);
create index publish_jobs_batch_id_idx on public.publish_jobs (batch_id);
create index publish_jobs_due_idx on public.publish_jobs (status, next_run_at) where status = 'queued';

alter table public.publish_batches enable row level security;
alter table public.publish_jobs enable row level security;

create policy "publish_batches_select_member" on public.publish_batches
  for select using (public.is_org_member(org_id));

create policy "publish_jobs_select_member" on public.publish_jobs
  for select using (public.is_org_member(org_id));

alter table public.publish_batches replica identity full;
alter table public.publish_jobs replica identity full;
alter publication supabase_realtime add table public.publish_batches;
alter publication supabase_realtime add table public.publish_jobs;
