-- ============================================================
-- Identificador sequencial de contrato — Kanban Aluguel
--
-- Adiciona public.cards.numero: um inteiro sequencial (#1, #2,
-- #3...) atribuído automaticamente a cada contrato, sustentado por
-- uma sequence dedicada. É o que CONTRATO-03 e o filtro por ID da
-- Phase 6.1 (CONSULTA-01) precisam para existir — hoje `cards.id`
-- é um uuid, que não serve como identificador digitável/memorável.
--
-- ESTA MIGRAÇÃO É ESTRITAMENTE ADITIVA. O app está em produção no
-- Vercel + Supabase com ~46 imóveis reais e nenhum ambiente de
-- staging (mesma régua da 20260816000000_financeiro_schema.sql).
-- Nada aqui apaga coluna, apaga tabela, renomeia ou troca tipo de
-- coluna existente — só cria uma sequence nova, uma coluna nova
-- (backfillada antes de virar not null) e uma constraint nova.
--
-- Também é REEXECUTÁVEL: toda criação usa "if not exists", o
-- backfill só toca linhas com numero is null (segunda passagem não
-- duplica numeração) e a constraint é derrubada com "if exists"
-- antes de ser recriada, no mesmo padrão já usado em `parcelas`.
--
-- Runbook operacional que prova estas regras, com ensaio em
-- transação e verificação pós-push: supabase/verificacao_cards_numero.sql
-- ============================================================


-- ------------------------------------------------------------
-- Seção 1 — a sequence que sustenta a numeração
-- ------------------------------------------------------------

create sequence if not exists public.cards_numero_seq;


-- ------------------------------------------------------------
-- Seção 2 — a coluna, ainda sem NOT NULL
--
-- Uma coluna nova não pode nascer NOT NULL sem default numa tabela
-- que já tem ~46 linhas — o NOT NULL só entra na Seção 4, depois
-- que o backfill da Seção 3 já preencheu todo mundo.
-- ------------------------------------------------------------

alter table public.cards
  add column if not exists numero integer;


-- ------------------------------------------------------------
-- Seção 3 — backfill em ordem de criação, idempotente
--
-- O subselect `coalesce(max(numero), 0)` é resolvido uma única vez,
-- contra o estado da tabela ANTES deste UPDATE (snapshot de início
-- de statement do Postgres — um UPDATE nunca lê as próprias
-- escritas em andamento). Por isso rodar esta seção duas vezes na
-- mesma migração não duplica numeração: na segunda passagem
-- `candidatos` vem vazio (nenhum numero is null sobrando) e o
-- UPDATE não toca em nada.
--
-- A ordem `created_at, id` desempata determinismo entre cards
-- criados no mesmo instante — mesmo padrão de desempate por segunda
-- coluna já usado no índice único de `parcelas`
-- (parcelas_unica_por_competencia usa card_id, competencia).
-- ------------------------------------------------------------

with candidatos as (
  select id, row_number() over (order by created_at, id) as posicao
  from public.cards
  where numero is null
)
update public.cards as c
set numero = (select coalesce(max(numero), 0) from public.cards) + candidatos.posicao
from candidatos
where c.id = candidatos.id;


-- ------------------------------------------------------------
-- Seção 4 — trava o default e o NOT NULL, prepara a sequence
--
-- O setval é recalculado a cada execução a partir do max(numero)
-- atual, então repetir a migração nunca desalinha a sequence — e é
-- por isso que createCardAction (web/src/lib/kanban/actions.ts) não
-- precisa de nenhuma mudança: o insert já feito por essa Server
-- Action não passa numero, e o banco preenche via nextval() no
-- default, exatamente como já acontece hoje com
-- id uuid default gen_random_uuid().
-- ------------------------------------------------------------

alter table public.cards
  alter column numero set default nextval('public.cards_numero_seq');

select setval(
  'public.cards_numero_seq',
  (select coalesce(max(numero), 0) from public.cards) + 1,
  false
);
-- o terceiro argumento `false` faz o próximo nextval() devolver
-- exatamente esse número, sem pular um

alter table public.cards
  alter column numero set not null;


-- ------------------------------------------------------------
-- Seção 5 — constraint única
-- ------------------------------------------------------------

alter table public.cards drop constraint if exists cards_numero_unico;

alter table public.cards
  add constraint cards_numero_unico unique (numero);


-- ------------------------------------------------------------
-- Seção 6 — amarra a sequence à coluna
--
-- Só para que um `\d cards` no SQL Editor mostre a relação
-- (documentação viva, sem mudar comportamento).
-- ------------------------------------------------------------

alter sequence public.cards_numero_seq owned by public.cards.numero;


-- ------------------------------------------------------------
-- T-06.1-01 / T-06.1-02 — nada de RLS novo, nada de multi-tenant
--
-- Nenhuma policy de RLS é criada, alterada ou removida por esta
-- migração. public.cards já está coberta pela policy que usa
-- public.is_team_member() desde 20260811000000_security_hardening.sql,
-- e a coluna nova herda essa mesma proteção sem precisar de
-- predicado novo.
--
-- A sequence é uma numeração de contratos dentro de um único board
-- compartilhado por toda a allowlist — não expõe nada sobre um
-- "outro tenant" porque, no desenho atual de board único, não existe
-- outro tenant a proteger (ver PROJECT.md sobre o caminho de
-- migração para SaaS multi-tenant, que precisaria revisitar esta
-- decisão).
-- ------------------------------------------------------------
