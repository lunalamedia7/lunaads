-- Fase 12: Estilo Builder — um job de publicação passa a poder criar N
-- conjuntos com M anúncios cada (não mais só 1+1). O motor de publicação
-- continua sendo o mesmo (lib/campaigns/publish.ts): isso só guarda o
-- progresso de cada item da árvore pra permitir retomar depois de uma
-- falha/reprocessamento sem duplicar.
alter table public.publish_jobs add column created_tree jsonb not null default '[]'::jsonb;
