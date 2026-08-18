-- ============================================================
-- Verificação do identificador sequencial de contrato — Kanban Aluguel
--
-- Este runbook prova, em duas partes, que a migração
-- 20260818000000_cards_numero_sequencial.sql funciona como
-- pretendido antes e depois de ser aplicada em produção (~46
-- imóveis reais, sem ambiente de staging).
--
-- PARTE A — ENSAIO: roda ANTES do `supabase db push`, dentro de
-- uma única transação que só termina em ROLLBACK. Nada do que
-- acontece aqui persiste no banco — é seguro rodar quantas vezes
-- for preciso.
--
-- PARTE B — VERIFICAÇÃO PÓS-PUSH: blocos independentes, escritos
-- aqui e rodados DEPOIS que a migração for aplicada de verdade
-- (plano 06.1-03).
--
-- RODE UM BLOCO DE CADA VEZ, na ordem, na MESMA aba do SQL Editor
-- (sem abrir "New query" no meio) — o BEGIN do BLOCO 2 e o ROLLBACK
-- que fecha a Parte A precisam estar na mesma sessão.
--
-- *** LIÇÃO DO ENSAIO REAL DE 2026-08-18 (ver RESULTADO DO ENSAIO
-- logo abaixo) — LEIA ANTES DE RODAR ESTE RUNBOOK DE NOVO: ***
-- "mesma aba" NÃO garante "mesma conexão/sessão de banco" no
-- Supabase Studio SQL Editor — ele usa um pool de conexões, e um
-- `begin;` colado num clique de "Run" pode não estar mais amarrado
-- às instruções coladas num clique seguinte. Isso já aconteceu aqui:
-- os blocos que deveriam estar dentro da transação do BLOCO 2 na
-- prática commitaram sozinhos, e o `rollback;` final rodou sem
-- efeito nenhum. Para um ensaio que dependa de transação contínua
-- entre múltiplos comandos, prefira `psql` ou `supabase db
-- diff`/`supabase sql` via CLI, onde a sessão é garantida por
-- construção — ou cole TUDO (todos os blocos da Parte A) num único
-- clique de "Run", nunca em cliques separados.
-- ============================================================


-- ============================================================
-- RESULTADO DO ENSAIO — 2026-08-18
--
-- Contexto primeiro: este ensaio NÃO saiu como o desenho original
-- da PARTE A previa. O operador seguiu literalmente a instrução
-- "rode um bloco de cada vez, na mesma aba" — só que essa instrução
-- estava errada para o Supabase Studio SQL Editor. Ver o aviso
-- "LIÇÃO DO ENSAIO REAL" logo acima do cabeçalho: o SQL Editor não
-- garante a mesma conexão de banco entre cliques separados de "Run"
-- (pool de conexões). O `begin;` do BLOCO 2 só amarrou as instruções
-- coladas *junto* com ele naquele clique; os blocos seguintes
-- (rodados em cliques separados) pegaram conexões novas do pool,
-- fora de qualquer transação — cada `alter table`/`update` real do
-- BLOCO 2 (incluindo a segunda passagem, pensada só para provar
-- idempotência) commitou sozinho, na hora. O `rollback;` do fim
-- rodou "no vazio": Postgres não erra rollback sem transação aberta,
-- só ignora — por isso nada pareceu errado até comparar
-- `updated_at_max` antes/depois.
--
-- Também foi achado, durante o ensaio, um bug real no BLOCO 1
-- original: ele referenciava a coluna `numero`
-- (`count(*) filter (where numero is not null) as com_numero`)
-- antes dela existir, quebrando com `column "numero" does not
-- exist` numa leitura pré-migração — já corrigido no próprio BLOCO
-- 1 abaixo (a versão corrigida foi passada ao operador na hora, na
-- forma `select count(*) as cards_total, max(updated_at) as
-- updated_at_max from public.cards;`).
--
-- Resultado, então: a migração NÃO ficou confinada a uma transação
-- revertida — ela foi aplicada e commitada de verdade em produção
-- durante este "ensaio". Verificado passo a passo pelo operador,
-- com as mesmas queries de integridade/ordem/constraint/RLS que a
-- PARTE A prescreve:
--
--   - cards_total = numeros_distintos = numero_max = 47,
--     numero_min = 1, sem_numero = 0 — numeração completa, sem
--     duplicata, sem buraco
--   - segunda passagem da DDL (prova de idempotência pretendida):
--     `setval` retornou 48 nas duas rodadas — nenhuma renumeração
--   - fora_de_ordem = 0
--   - teste da constraint única (BLOCO 3): "Success. No rows
--     returned" no bloco `do $$ ... $$` — só é possível se
--     `unique_violation` foi capturado pelo `exception when
--     unique_violation` (o caminho de sucesso do `do $$` levanta
--     `raise exception 'FALHOU: ...'` sem handler se a constraint
--     NÃO tivesse recusado a duplicata)
--   - RLS (BLOCO 4): count = 0 sob e-mail intruso (`.invalid`),
--     count = 47 sob o e-mail real da allowlist
--   - pós-fato: `numero integer not null default
--     nextval('cards_numero_seq'::regclass)` confirmado via
--     information_schema.columns; constraint `cards_numero_unico
--     UNIQUE (numero)` presente; `select numero from public.cards
--     limit 1;` devolveu `numero: 4` — a coluna existe de verdade
--   - `updated_at_max` mudou entre a primeira e a última leitura
--     (~5h30 de diferença); investigado e não é sobra do teste — é
--     edição real, não relacionada, feita no board nesse intervalo
--
-- Decisão explícita do usuário (via pergunta direta do orquestrador,
-- respondida por ele): "Aceitar como aplicada" — não reverter. A
-- migração já é a versão final revisada, os dados batem 100%
-- limpos, e nada no app ainda lê `cards.numero` (só entra na
-- Wave 4 da fase), então não havia custo real em reverter e
-- reaplicar minutos depois. O plano 06.1-03 original ("aplicar a
-- migração via `supabase db push`") deixa de ser necessário — o
-- push já aconteceu de fato aqui; 06.1-03 é replanejado pelo
-- orquestrador para verificação pós-push + documentação.
--
-- Nenhuma correção na migração foi necessária: a DDL em si (dentro
-- da transação pretendida) estava e continua correta — só a leitura
-- do BLOCO 1, ANTES/FORA de qualquer transação, estava quebrada, e
-- já foi corrigida abaixo.
-- ============================================================


-- ============================================================
-- PARTE A — ENSAIO (roda antes do push)
-- ============================================================


-- ============================================================
-- BLOCO 1 — PRÉ-VOO (rode sozinho, só leitura, não altera nada)
--
-- Anote os dois números abaixo. O BLOCO 6 (Parte B) confere que
-- cards_total e updated_at_max não mudaram depois do push.
--
-- CORRIGIDO em 2026-08-18 (ver RESULTADO DO ENSAIO no topo deste
-- arquivo): a versão original desta consulta trazia
-- `count(*) filter (where numero is not null) as com_numero`, que
-- quebra com `column "numero" does not exist` quando rodada antes
-- da coluna existir — a coluna só nasce dentro da transação do
-- BLOCO 2, e este BLOCO 1 roda ANTES disso (ou, na releitura do
-- passo 5, numa sessão separada que não viu a transação em
-- andamento). Por isso não pode referenciar `numero`.
-- ============================================================

select
  count(*)          as cards_total,
  max(updated_at)   as updated_at_max
from public.cards;


-- ============================================================
-- BLOCO 2 — ENSAIO EM TRANSAÇÃO
--
-- Abre a transação que os BLOCOS 3 e 4 (ainda nesta mesma aba do
-- SQL Editor) vão usar. Dentro: (a) uma cópia literal da DDL da
-- migração; (b) a MESMA DDL de novo, para provar que o arquivo é
-- reexecutável e não duplica numeração — se a segunda passagem der
-- erro ou mudar os números, a migração não está pronta; (c) as
-- consultas de integridade e de ordem.
--
-- A transação só fecha no fim da Parte A (BLOCO 4), com ROLLBACK.
-- ============================================================

begin;

-- ---- (a) DDL da migração — primeira passagem ------------------

create sequence if not exists public.cards_numero_seq;

alter table public.cards
  add column if not exists numero integer;

with candidatos as (
  select id, row_number() over (order by created_at, id) as posicao
  from public.cards
  where numero is null
)
update public.cards as c
set numero = (select coalesce(max(numero), 0) from public.cards) + candidatos.posicao
from candidatos
where c.id = candidatos.id;

alter table public.cards
  alter column numero set default nextval('public.cards_numero_seq');

select setval(
  'public.cards_numero_seq',
  (select coalesce(max(numero), 0) from public.cards) + 1,
  false
);

alter table public.cards
  alter column numero set not null;

alter table public.cards drop constraint if exists cards_numero_unico;

alter table public.cards
  add constraint cards_numero_unico unique (numero);

alter sequence public.cards_numero_seq owned by public.cards.numero;

-- ---- (b) DDL da migração — segunda passagem (prova de idempotência) ----

create sequence if not exists public.cards_numero_seq;

alter table public.cards
  add column if not exists numero integer;

with candidatos as (
  select id, row_number() over (order by created_at, id) as posicao
  from public.cards
  where numero is null
)
update public.cards as c
set numero = (select coalesce(max(numero), 0) from public.cards) + candidatos.posicao
from candidatos
where c.id = candidatos.id;

alter table public.cards
  alter column numero set default nextval('public.cards_numero_seq');

select setval(
  'public.cards_numero_seq',
  (select coalesce(max(numero), 0) from public.cards) + 1,
  false
);

alter table public.cards
  alter column numero set not null;

alter table public.cards drop constraint if exists cards_numero_unico;

alter table public.cards
  add constraint cards_numero_unico unique (numero);

alter sequence public.cards_numero_seq owned by public.cards.numero;

-- ---- (c) integridade: numeração completa, sem buraco, sem duplicata ----

select
  count(*)                                     as cards_total,
  count(distinct numero)                       as numeros_distintos,
  min(numero)                                  as numero_min,
  max(numero)                                  as numero_max,
  count(*) filter (where numero is null)       as sem_numero
from public.cards;
-- esperado: cards_total = numeros_distintos = numero_max,
-- numero_min = 1, sem_numero = 0

-- ---- (d) ordem: nenhum card mais novo recebeu número menor -------------

select count(*) as fora_de_ordem
from public.cards c
where exists (
  select 1
  from public.cards c2
  where c2.numero < c.numero and c2.created_at > c.created_at
);
-- esperado: 0


-- ============================================================
-- BLOCO 3 — PROVA DA CONSTRAINT ÚNICA (mesma transação do BLOCO 2 —
-- não rode `begin;` de novo)
--
-- Tenta fazer o card de numero = 1 assumir o numero do card de
-- segundo menor numero. Deve ser recusado por unique_violation.
-- ============================================================

do $$
declare
  v_id_numero_1 uuid;
  v_id_numero_2 uuid;
  v_numero_2 integer;
begin
  select id into v_id_numero_1 from public.cards where numero = 1;

  select id, numero into v_id_numero_2, v_numero_2
  from public.cards
  where numero = (select min(numero) from public.cards where numero <> 1);

  if v_id_numero_1 is null or v_id_numero_2 is null then
    raise exception 'FALHOU: ensaio precisa de pelo menos dois cards numerados';
  end if;

  begin
    update public.cards set numero = v_numero_2 where id = v_id_numero_1;
    raise exception 'FALHOU: cards_numero_unico deveria ter recusado numero duplicado';
  exception when unique_violation then
    raise notice 'OK recusado: cards_numero_unico';
  end;
end $$;


-- ============================================================
-- BLOCO 4 — CONFIRMAÇÃO DE QUE O RLS CONTINUA VALENDO (mesma
-- transação — não rode `begin;` de novo)
--
-- Este bloco não está reprovando o RLS do zero — isso já foi feito
-- em 20260811000000_security_hardening.sql — está confirmando que a
-- coluna numero não abriu nenhuma exceção nova a essa regra
-- (T-06.1-01).
-- ============================================================

set local role authenticated;
set local request.jwt.claims to '{"email":"intruso-teste@exemplo.invalid","role":"authenticated"}';

select count(*) from public.cards;
-- esperado: 0 — mesmo resultado que já valia antes desta coluna existir

reset role;

-- TROQUE o e-mail abaixo pelo seu, o mesmo cadastrado em
-- public.allowed_members, antes de rodar.
set local request.jwt.claims to '{"email":"SEU-EMAIL-DA-ALLOWLIST@exemplo.com","role":"authenticated"}';
set local role authenticated;

select count(*) from public.cards;
-- esperado: volta a devolver as linhas (mesmo cards_total do BLOCO 1)


-- ============================================================
-- Fim da PARTE A. Nada do que rodou acima persiste: o ROLLBACK
-- abaixo desfaz a DDL de teste e a numeração de teste dos BLOCOS 2-4
-- de uma vez só. Rodar `commit` no lugar deste ROLLBACK gravaria a
-- numeração e a tentativa do "intruso" no banco de produção.
--
-- NUNCA troque este `rollback;` por `commit;`.
-- ============================================================

rollback;


-- ============================================================
-- PARTE B — VERIFICAÇÃO PÓS-PUSH
--
-- Blocos independentes. Rodam DEPOIS de `supabase db push` aplicar
-- a migração de verdade (plano 06.1-03) — não fazem parte da
-- transação da Parte A acima, cada um pode ser rodado sozinho.
-- ============================================================


-- ============================================================
-- BLOCO 5 — INVENTÁRIO (rode sozinho, só leitura, não altera nada)
--
-- Esperado: coluna numero do tipo integer, is_nullable = 'NO',
-- column_default citando nextval; constraint cards_numero_unico
-- presente; sequence_dona = 'public.cards_numero_seq'.
-- ============================================================

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cards'
  and column_name = 'numero';

select
  conname,
  pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid = 'public.cards'::regclass
  and conname = 'cards_numero_unico';

select pg_get_serial_sequence('public.cards', 'numero') as sequence_dona;


-- ============================================================
-- BLOCO 6 — INTEGRIDADE PÓS-PUSH (rode sozinho, só leitura)
--
-- Esperado: cards_total e updated_at_max idênticos aos anotados no
-- BLOCO 1, sem_numero = 0, numeros_distintos = cards_total.
-- ============================================================

select
  count(*)                                     as cards_total,
  count(*) filter (where numero is null)       as sem_numero,
  count(distinct numero)                       as numeros_distintos,
  max(updated_at)                              as updated_at_max
from public.cards;


-- ============================================================
-- BLOCO 7 — ROLLBACK DE EMERGÊNCIA (só se algo der muito errado)
--
-- *** ATENÇÃO: as linhas dentro deste comentário APAGAM o
-- identificador sequencial de TODO contrato real. *** Só descomente
-- e rode isto se o push precisar ser revertido NO MESMO DIA, antes
-- de qualquer filtro por ID ter sido usado de verdade. Depois disso,
-- qualquer referência salva a um "#N" (ex: numa conversa com
-- inquilino/proprietário) fica órfã.
-- ============================================================

/*
alter table public.cards drop constraint if exists cards_numero_unico;
alter table public.cards alter column numero drop default;
alter table public.cards alter column numero drop not null;
alter table public.cards drop column if exists numero;
drop sequence if exists public.cards_numero_seq;
*/
