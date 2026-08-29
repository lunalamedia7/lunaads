-- Fase 1: fundação multi-tenant — organizations, org_members, audit_log, notifications.
-- RLS ligada em todas as tabelas de negócio desde a primeira migration.

create extension if not exists "pgcrypto";

create type public.org_role as enum ('owner', 'admin', 'operator', 'viewer');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

create table public.org_members (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'operator',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index org_members_user_id_idx on public.org_members (user_id);
create index audit_log_org_id_idx on public.audit_log (org_id, created_at desc);
create index notifications_user_id_idx on public.notifications (user_id, created_at desc);

-- Função security definer: evita recursão de RLS ao checar associação a uma org
-- (roda com privilégio do dono da função, que ignora RLS nas próprias tabelas).
create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.org_members
    where org_id = target_org_id and user_id = auth.uid()
  );
$$;

create or replace function public.current_org_role(target_org_id uuid)
returns public.org_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.org_members
  where org_id = target_org_id and user_id = auth.uid()
  limit 1;
$$;

alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.audit_log enable row level security;
alter table public.notifications enable row level security;

create policy "organizations_select_member" on public.organizations
  for select using (public.is_org_member(id));

create policy "org_members_select_same_org" on public.org_members
  for select using (public.is_org_member(org_id));

create policy "audit_log_select_member" on public.audit_log
  for select using (public.is_org_member(org_id));

create policy "audit_log_insert_own_org" on public.audit_log
  for insert with check (public.is_org_member(org_id) and actor_id = auth.uid());

create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid());

-- Cria a organização automaticamente no primeiro login de cada usuário
-- (dono do gatilho é o Postgres, então o insert ignora RLS legitimamente).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into public.organizations (name, slug)
  values ('Minha organização', 'org-' || replace(new.id::text, '-', ''))
  returning id into new_org_id;

  insert into public.org_members (org_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  insert into public.audit_log (org_id, actor_id, action, entity, entity_id, payload)
  values (new_org_id, new.id, 'org.created', 'organization', new_org_id::text, jsonb_build_object('trigger', 'handle_new_user'));

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: usuários criados antes desta migration (ex.: contas de teste
-- via Admin API) ainda não têm organização — cria para quem estiver faltando.
do $$
declare
  u record;
  new_org_id uuid;
begin
  for u in
    select au.id
    from auth.users au
    left join public.org_members om on om.user_id = au.id
    where om.user_id is null
  loop
    insert into public.organizations (name, slug)
    values ('Minha organização', 'org-' || replace(u.id::text, '-', ''))
    returning id into new_org_id;

    insert into public.org_members (org_id, user_id, role)
    values (new_org_id, u.id, 'owner');

    insert into public.audit_log (org_id, actor_id, action, entity, entity_id, payload)
    values (new_org_id, u.id, 'org.created', 'organization', new_org_id::text, jsonb_build_object('trigger', 'backfill'));
  end loop;
end;
$$;
