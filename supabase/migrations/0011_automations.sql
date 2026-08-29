-- Fase 10: automações — regras com gatilho + condição + ação, sempre
-- nascendo em modo simulação (dry run) por segurança.

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  trigger_type text not null default 'interval',
  trigger_config jsonb not null default '{"intervalMinutes": 60}'::jsonb,
  condition jsonb not null,
  action jsonb not null,
  scope jsonb not null default '{"type": "account", "ids": []}'::jsonb,
  is_dry_run boolean not null default true,
  is_active boolean not null default true,
  dry_run_until timestamptz not null default (now() + interval '24 hours'),
  max_actions_per_run integer not null default 20,
  cooldown_minutes integer not null default 60,
  max_budget_change_percent_per_day numeric not null default 20,
  last_run_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automation_rules_trigger_type_check check (trigger_type in ('interval', 'schedule'))
);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  rule_id uuid not null references public.automation_rules (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  actions_taken integer not null default 0,
  constraint automation_runs_status_check check (status in ('running', 'completed', 'failed'))
);

create table public.automation_run_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.automation_runs (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  rule_id uuid not null references public.automation_rules (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  entity_name text not null,
  decision text not null,
  action_type text,
  value_before jsonb,
  value_after jsonb,
  result text not null,
  error_message text,
  created_at timestamptz not null default now(),
  constraint automation_run_logs_decision_check
    check (decision in ('would_act', 'acted', 'skipped_condition', 'skipped_cooldown', 'skipped_guardrail')),
  constraint automation_run_logs_result_check check (result in ('ok', 'error', 'dry_run'))
);

create index automation_rules_org_id_idx on public.automation_rules (org_id);
create index automation_runs_rule_id_idx on public.automation_runs (rule_id, started_at desc);
create index automation_run_logs_run_id_idx on public.automation_run_logs (run_id);
create index automation_run_logs_org_id_idx on public.automation_run_logs (org_id, created_at desc);
create index automation_run_logs_cooldown_idx on public.automation_run_logs (rule_id, entity_id, created_at desc);

alter table public.automation_rules enable row level security;
alter table public.automation_runs enable row level security;
alter table public.automation_run_logs enable row level security;

create policy "automation_rules_select_member" on public.automation_rules
  for select using (public.is_org_member(org_id));
create policy "automation_rules_write_operator" on public.automation_rules
  for all
  using (public.current_org_role(org_id) in ('owner', 'admin', 'operator'))
  with check (public.current_org_role(org_id) in ('owner', 'admin', 'operator'));

create policy "automation_runs_select_member" on public.automation_runs
  for select using (public.is_org_member(org_id));
create policy "automation_run_logs_select_member" on public.automation_run_logs
  for select using (public.is_org_member(org_id));

alter table public.automation_rules replica identity full;
alter table public.automation_run_logs replica identity full;
alter publication supabase_realtime add table public.automation_rules;
alter publication supabase_realtime add table public.automation_run_logs;
