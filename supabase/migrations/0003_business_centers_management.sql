-- Fase 3: gestão de Business Centers — alias editável, desconexão por BC,
-- e Realtime para saldo atualizar na tela sem F5.

create policy "business_centers_update_admin" on public.business_centers
  for update
  using (public.current_org_role(org_id) in ('owner', 'admin'))
  with check (public.current_org_role(org_id) in ('owner', 'admin'));

create policy "business_centers_delete_admin" on public.business_centers
  for delete
  using (public.current_org_role(org_id) in ('owner', 'admin'));

alter table public.business_centers replica identity full;
alter table public.ad_accounts replica identity full;

alter publication supabase_realtime add table public.business_centers;
alter publication supabase_realtime add table public.ad_accounts;
