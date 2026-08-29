-- A tabela notifications (Fase 1) nunca tinha sido adicionada à publicação de
-- realtime — sem isso o badge de não lidas na topbar não atualiza sozinho.
alter table public.notifications replica identity full;
alter publication supabase_realtime add table public.notifications;
