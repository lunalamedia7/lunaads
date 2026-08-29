-- Fase 6: templates de campanha e rascunhos do assistente de criação.

create table public.campaign_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  is_favorite boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index campaign_templates_org_id_idx on public.campaign_templates (org_id);

alter table public.campaign_templates enable row level security;

create policy "campaign_templates_select_member" on public.campaign_templates
  for select using (public.is_org_member(org_id));

create policy "campaign_templates_write_operator" on public.campaign_templates
  for all
  using (public.current_org_role(org_id) in ('owner', 'admin', 'operator'))
  with check (public.current_org_role(org_id) in ('owner', 'admin', 'operator'));

-- Um rascunho ativo por usuário — fechar o navegador e voltar preserva o
-- progresso do assistente de criação de campanha.
create table public.campaign_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  current_step smallint not null default 1,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);

alter table public.campaign_drafts enable row level security;

create policy "campaign_drafts_own_row" on public.campaign_drafts
  for all
  using (user_id = auth.uid() and public.is_org_member(org_id))
  with check (user_id = auth.uid() and public.is_org_member(org_id));
