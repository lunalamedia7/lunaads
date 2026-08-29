# LunaAds — operação e infraestrutura

Guia de referência para manter, hospedar e depurar o LunaAds. Escrito pra
quem for mexer no código depois — não é documentação de usuário final.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript estrito.
- Supabase hospedado: Postgres + Auth + Realtime. Sem Docker/local — todo
  desenvolvimento aponta pro projeto hospedado.
- Deploy: Vercel (inclui os cron jobs via `vercel.json`).
- Sem serviço externo de e-mail, fila de jobs (Inngest etc.) ou observabilidade
  (Sentry etc.) — deliberado, pra não exigir mais contas externas do dono do
  produto. Fila de publicação e logs de erro rodam 100% em Postgres + Vercel
  Cron (ver abaixo).

## Variáveis de ambiente

Todas em `.env.local` (nunca commitado — está no `.gitignore`). Na Vercel,
configurar as mesmas chaves em Project Settings → Environment Variables.

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase (browser + server, respeita RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Cliente que ignora RLS — só em código de servidor de confiança (`lib/supabase/service.ts`) |
| `ENCRYPTION_KEY` | Chave AES-256-GCM (`lib/crypto.ts`) pra criptografar tokens do TikTok e segredos de checkout |
| `TIKTOK_PROVIDER` | `mock` (dados fictícios determinísticos) ou `http` (API real do TikTok) |
| `TIKTOK_APP_ID` / `TIKTOK_APP_SECRET` / `TIKTOK_OAUTH_REDIRECT_URI` | Credenciais do app no TikTok for Developers — só necessárias com `TIKTOK_PROVIDER=http` |
| `CRON_SECRET` | Protege `/api/cron/*` — a Vercel injeta esse valor automaticamente no header `Authorization` quando configurado nas env vars do projeto |
| `NEXT_PUBLIC_SITE_URL` | Base URL usada pro script de tracking (`/t.js`) |
| `SUPABASE_DB_URL` | Só usado localmente para rodar migrations via `supabase db push` — não é lido pelo app |
| `E2E_EMAIL` / `E2E_PASSWORD` | Usuário existente no Supabase, usado só por `pnpm test:e2e` |

## Banco de dados e migrations

Migrations vivem em `supabase/migrations/*.sql`, numeradas sequencialmente.
Não há ambiente de staging separado — todas as migrations vão direto pro
projeto Supabase real. Para aplicar uma nova migration:

```bash
export SUPABASE_DB_URL=$(grep '^SUPABASE_DB_URL=' .env.local | cut -d= -f2-)
pnpm dlx supabase db push --db-url "$SUPABASE_DB_URL"
```

A conexão direta (`db.<ref>.supabase.co`) não funciona a partir de algumas
redes — use o pooler (`aws-0-sa-east-1.pooler.supabase.com`) se a direta
falhar com `ECONNREFUSED`.

**RLS**: toda tabela multi-tenant usa `public.is_org_member(org_id)`
(security definer, evita recursão) nas policies de select. Tabelas com
segredo (`tiktok_connections`, `checkout_integrations`) não têm NENHUMA
policy pra `authenticated`/`anon` — só o service_role client as acessa.
`notifications` é a exceção: é por `user_id`, não por org (`user_id =
auth.uid()`).

**Realtime**: uma tabela só dispara `postgres_changes` pro client se estiver
em `alter publication supabase_realtime add table ...` E tiver `replica
identity full`. Ao criar uma tabela nova que precisa de realtime, não
esqueça as duas linhas (isso já causou um bug real — ver a nota abaixo).

> **Armadilha de timing do Realtime com `@supabase/ssr`**: se um componente
> client chama `supabase.channel(...).subscribe()` sem esperar
> `supabase.auth.getSession()` resolver primeiro, o handshake do WebSocket
> pode sair sem o token do usuário — a conexão fica `SUBSCRIBED` normalmente,
> mas a RLS barra todo evento silenciosamente (nenhum erro aparece). Os dois
> componentes que assinam Realtime (`components/layout/topbar.tsx` e
> `components/realtime-refresh.tsx`) já esperam a sessão antes de assinar —
> siga o mesmo padrão em qualquer novo `useEffect` com `channel().subscribe()`.

## Motor de publicação (fila sem serviço externo)

`lib/campaigns/publish.ts` implementa uma fila durável só com Postgres +
Vercel Cron (`/api/cron/process-publish-jobs`, roda a cada minuto): cada job
tem `next_run_at`, só o primeiro job de um lote recebe timestamp imediato, os
demais ficam com `next_run_at = null` até `scheduleNextJob()` agendar o
próximo após o anterior terminar (sucesso ou falha definitiva). Isso garante
o espaçamento entre publicações mesmo com o navegador do usuário fechado.

`created_tree` (jsonb em `publish_jobs`) guarda o progresso de cada conjunto/
anúncio dentro de um job — permite retomar depois de uma falha parcial sem
duplicar itens já criados no TikTok. `normalizeAdGroups()`
(`lib/campaigns/schema.ts`) é o único ponto que converte tanto o Estilo Fast
(1 conjunto/1 anúncio) quanto o Estilo Builder (N conjuntos/M anúncios) pro
mesmo formato — não existe um segundo caminho de código pra publicar.

## Cron jobs (GitHub Actions — `.github/workflows/`)

O plano Hobby (gratuito) da Vercel só permite cron jobs nativos rodando no
máximo 1x/dia — incompatível com a fila de publicação. Por isso `vercel.json`
não declara nenhum cron: em vez disso, três workflows do GitHub Actions
chamam essas rotas via HTTP no horário certo, agrupados por frequência
(`cron-5min.yml`, `cron-15min.yml`, `cron-daily.yml`). Isso só é grátis sem
limite porque o repositório é **público** — GitHub Actions em repositório
privado tem cota mensal de minutos e um cron de 5 em 5 minutos estoura essa
cota em poucos dias. Se um dia a Vercel virar plano Pro, dá pra migrar os
crons de volta pra `vercel.json` e desativar os workflows.

O `process-publish-jobs` original era pensado pra rodar a cada minuto — o
GitHub Actions não garante intervalos menores que 5 minutos de forma
confiável (schedules mais curtos são ignorados/atrasados pela própria
GitHub), então foi ajustado pra 5 em 5 minutos. Isso não quebra nada — só
significa que um lote de publicação pode demorar um pouco mais pra terminar
de processar (o espaçamento entre publicações continua sendo o mesmo,
definido em `lib/campaigns/publish.ts`; o que muda é de quanto em quanto
tempo o cron verifica se há um job pronto pra rodar).

| Rota | Frequência | Função |
|---|---|---|
| `/api/cron/process-publish-jobs` | a cada 5 min | processa a fila de publicação |
| `/api/cron/sync-tiktok` | a cada 5 min | sincroniza BCs/contas (saldo, contas limitadas) |
| `/api/cron/sync-campaign-metrics` | a cada 15 min | sincroniza métricas de campanhas |
| `/api/cron/sync-rejections` | a cada 15 min | detecta anúncios reprovados |
| `/api/cron/process-appeals` | a cada 5 min | envia apelações automáticas (Smart+) |
| `/api/cron/run-automations` | a cada 5 min | executa regras de automação |
| `/api/cron/cleanup-hardening` | 1x/dia (03h) | limpa `rate_limit_hits`/`error_logs` antigos |

Todas exigem o header `Authorization: Bearer $CRON_SECRET` — guardado como
secret do repositório (`gh secret set CRON_SECRET`), referenciado nos
workflows como `${{ secrets.CRON_SECRET }}`. Em dev local, sem `CRON_SECRET`
configurado, ficam abertas. Dá pra forçar uma execução manual de qualquer
workflow em Actions → escolher o workflow → "Run workflow" (todos têm
`workflow_dispatch` habilitado).

## Notificações in-app

`lib/notifications.ts`'s `notifyOrg()` insere uma linha por membro da
organização na tabela `notifications` (existe desde a Fase 1, mas só passou
a ser usada na Fase 14). Eventos disparados hoje: saldo baixo e conta
limitada (`lib/tiktok/sync.ts`), criativo reprovado (`lib/appeals/sync.ts`),
lote de publicação concluído/falhou (`lib/campaigns/publish.ts`), automação
disparada (`lib/automations/engine.ts`). Sem envio de e-mail — só in-app
(badge na topbar + `/notificacoes`), porque não há provedor de e-mail
configurado (evita mais uma conta externa).

## Observabilidade e rate limiting

Sem Sentry — os erros de sync por organização (que antes eram silenciosamente
engolidos pra uma org com erro não travar as outras) agora vão pra tabela
`error_logs` via `lib/error-log.ts`. Consultar direto no Supabase Studio
(`select * from error_logs order by created_at desc`) ou pela API com a
service role key. Runtime errors não capturados continuam visíveis nos
logs de função da Vercel (grátis, sem configuração extra).

Rotas públicas sem autenticação de usuário (`/api/webhooks/[platform]/
[token]` e `/api/t/collect`) têm rate limit via `lib/rate-limit.ts` (janela
fixa em Postgres, função `increment_rate_limit`): 120 req/min por token de
webhook, 600 req/min por token de pixel. Retornam 429 quando excedido.

## Backup e restauração

Supabase faz backup automático do banco (frequência depende do plano do
projeto — conferir em Project Settings → Database → Backups no painel do
Supabase). Pra um backup manual pontual (antes de uma migration arriscada,
por exemplo):

```bash
export SUPABASE_DB_URL=$(grep '^SUPABASE_DB_URL=' .env.local | cut -d= -f2-)
pnpm dlx supabase db dump --db-url "$SUPABASE_DB_URL" -f backup-$(date +%Y%m%d).sql
```

Restaurar exige recriar o schema a partir desse dump num Postgres vazio —
nunca rodar um restore direto contra o projeto de produção sem confirmar
com o dono do produto antes, é uma operação destrutiva.

## Segredos e criptografia

Tokens do TikTok (`tiktok_connections`) e segredos de checkout
(`checkout_integrations`) são armazenados com AES-256-GCM
(`lib/crypto.ts`), chave em `ENCRYPTION_KEY`. Rotacionar essa chave invalida
todos os segredos já criptografados — reconectar o TikTok e reconfigurar os
checkouts seria necessário depois de trocá-la.

## LGPD — o que já está feito e o que observar

- E-mail do comprador nunca é armazenado em texto puro: só o hash SHA-256
  (`hashBuyer()` em `lib/checkout/process.ts`), usado pra deduplicar eventos
  de conversão (CAPI). A tabela `sales` não tem coluna de e-mail bruto.
- Segredos (tokens, chaves de checkout) ficam criptografados em repouso e
  sem nenhuma policy de RLS que os exponha a `authenticated`/`anon`.
- `audit_log` guarda ações administrativas (quem fez o quê); não guarda
  dados de clientes finais além do necessário pro rastro de auditoria.
- Isso não é parecer jurídico — é higiene técnica básica. Se o produto vier
  a processar mais dados pessoais de terceiros (ex.: nome/CPF de
  compradores), vale revisar com um advogado o que precisa de base legal,
  retenção e eventual atendimento a pedidos de titular.

## Testes

- `pnpm test` — Vitest, testes unitários (schemas, cálculos).
- `pnpm test:e2e` — Playwright, sobe o próprio `pnpm dev` automaticamente.
  Precisa de `E2E_EMAIL`/`E2E_PASSWORD` válidos no `.env.local`. Os testes de
  wizard propositalmente **não clicam em publicar** — como não existe um
  Supabase de staging separado, isso evitaria criar campanhas/lotes reais a
  cada execução da suíte. Rodar `pnpm typecheck && pnpm lint && pnpm build`
  antes de qualquer deploy.

## Deploy

Hospedar na Vercel: importar o repositório, configurar as env vars da
tabela acima (incluindo `CRON_SECRET`, que a própria Vercel referencia nos
crons definidos em `vercel.json`), e apontar `TIKTOK_PROVIDER=http` só
depois de ter credenciais reais aprovadas no TikTok for Developers — até lá,
manter `mock`.
