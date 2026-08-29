-- Fase 15: hardening — observabilidade sem depender de um serviço externo
-- (Sentry etc. exigiriam mais uma conta) e rate limit nas rotas públicas
-- (webhook de checkout e coletor do pixel), que ficam abertas na internet
-- sem autenticação de usuário.

create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete cascade,
  source text not null,
  message text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index error_logs_created_at_idx on public.error_logs (created_at desc);
create index error_logs_org_id_idx on public.error_logs (org_id, created_at desc);

alter table public.error_logs enable row level security;

create policy "error_logs_select" on public.error_logs
  for select using (org_id is not null and public.is_org_member(org_id));

-- Só escrito via service_role (cron jobs/engines) — sem policy de insert.

create table public.rate_limit_hits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 1,
  primary key (key, window_start)
);

alter table public.rate_limit_hits enable row level security;
-- Sem nenhuma policy: só service_role acessa (bypassa RLS). Nunca exposta a
-- authenticated/anon.

create or replace function public.increment_rate_limit(p_key text, p_window_start timestamptz)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.rate_limit_hits (key, window_start, count)
  values (p_key, p_window_start, 1)
  on conflict (key, window_start)
  do update set count = public.rate_limit_hits.count + 1
  returning count;
$$;
