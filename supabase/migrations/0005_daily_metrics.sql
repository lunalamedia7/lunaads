-- Fase 5: agregados do dashboard. O dashboard nunca varre `sales` cru —
-- sempre lê daily_metrics, mantida em tempo real por trigger em `sales`.

create table public.daily_metrics (
  org_id uuid not null references public.organizations (id) on delete cascade,
  metric_date date not null,
  metric_hour smallint not null check (metric_hour between 0 and 23),
  gross_revenue numeric not null default 0,
  paid_count integer not null default 0,
  pending_count integer not null default 0,
  initiated_count integer not null default 0,
  refunded_amount numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (org_id, metric_date, metric_hour)
);

alter table public.daily_metrics enable row level security;

create policy "daily_metrics_select_member" on public.daily_metrics
  for select using (public.is_org_member(org_id));

alter table public.daily_metrics replica identity full;
alter publication supabase_realtime add table public.daily_metrics;

-- Recalcula só o balde (org, dia, hora) afetado — nunca a tabela inteira.
create or replace function public.refresh_daily_metrics(p_org_id uuid, p_date date, p_hour smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gross numeric;
  v_paid int;
  v_pending int;
  v_initiated int;
  v_refunded numeric;
begin
  select
    coalesce(sum(gross_amount) filter (where status = 'paid'), 0),
    count(*) filter (where status = 'paid'),
    count(*) filter (where status in ('pending', 'initiated')),
    count(*) filter (where status = 'initiated'),
    coalesce(sum(gross_amount) filter (where status = 'refunded'), 0)
  into v_gross, v_paid, v_pending, v_initiated, v_refunded
  from public.sales
  where org_id = p_org_id
    and (occurred_at at time zone 'America/Sao_Paulo')::date = p_date
    and extract(hour from occurred_at at time zone 'America/Sao_Paulo') = p_hour;

  insert into public.daily_metrics
    (org_id, metric_date, metric_hour, gross_revenue, paid_count, pending_count, initiated_count, refunded_amount, updated_at)
  values
    (p_org_id, p_date, p_hour, v_gross, v_paid, v_pending, v_initiated, v_refunded, now())
  on conflict (org_id, metric_date, metric_hour) do update set
    gross_revenue = excluded.gross_revenue,
    paid_count = excluded.paid_count,
    pending_count = excluded.pending_count,
    initiated_count = excluded.initiated_count,
    refunded_amount = excluded.refunded_amount,
    updated_at = now();
end;
$$;

create or replace function public.sales_refresh_daily_metrics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_daily_metrics(
    new.org_id,
    (new.occurred_at at time zone 'America/Sao_Paulo')::date,
    extract(hour from new.occurred_at at time zone 'America/Sao_Paulo')::smallint
  );
  return new;
end;
$$;

create trigger sales_after_upsert_refresh_metrics
  after insert or update on public.sales
  for each row execute function public.sales_refresh_daily_metrics();
