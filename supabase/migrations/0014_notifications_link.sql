-- Fase 14: notificações in-app (saldo baixo, conta limitada, criativo
-- reprovado, lote concluído, automação disparada). A tabela notifications já
-- existia desde a Fase 1 mas nunca foi usada — só falta uma rota interna
-- opcional pra navegar ao clicar.
alter table public.notifications add column link text;

create index notifications_org_unread_idx on public.notifications (org_id, user_id) where read_at is null;
