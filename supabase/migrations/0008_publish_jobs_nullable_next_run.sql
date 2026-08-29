-- publish_jobs.next_run_at precisa aceitar null pra representar "ainda não
-- agendado" (jobs além do primeiro da fila, que só ganham horário quando o
-- anterior terminar — é isso que implementa o espaçamento do modo seguro).
alter table public.publish_jobs alter column next_run_at drop not null;
alter table public.publish_jobs alter column next_run_at drop default;
