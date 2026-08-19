-- ============================================================
-- Verificação do arquivamento de contrato e do backstop de
-- exclusão — Kanban Aluguel (Phase 6.2)
--
-- Este runbook prova, em duas partes, que a migração
-- 20260819000000_cards_arquivado_em.sql funciona como pretendido
-- antes e depois de ser aplicada em produção (~48 imóveis reais,
-- com parcelas e lançamentos reais, sem ambiente de staging).
--
-- *** AVISO DE POOLING (D-19) — LEIA ANTES DE RODAR QUALQUER
-- BLOCO DESTE ARQUIVO: ***
-- O SQL Editor do Supabase Studio usa um pool de conexões e NÃO
-- garante a mesma sessão de banco entre cliques separados de
-- "Run" — mesmo dentro da mesma aba. Um `begin;` colado num clique
-- pode não estar mais amarrado aos comandos colados num clique
-- seguinte. Na Phase 6.1 isso transformou um ensaio pensado para
-- terminar em rollback num push real que só foi percebido
-- comparando `updated_at_max` antes e depois (ver
-- supabase/verificacao_cards_numero.sql, seção "RESULTADO DO
-- ENSAIO — 2026-08-18").
--
-- Só existem DUAS saídas aceitas para a PARTE A (o BLOCO 2 inteiro,
-- que abre transação e só fecha no rollback do fim da Parte A):
--   (a) colar a PARTE A INTEIRA (do primeiro `select` do BLOCO 1
--       até o `rollback;` que fecha o BLOCO 3... — na prática, a
--       forma mais segura é colar tudo, do BLOCO 1 ao BLOCO 3, num
--       ÚNICO clique de "Run"); ou
--   (b) rodar via `psql` ou Supabase CLI (`supabase db execute` /
--       `psql "$DATABASE_URL" -f ...`), onde a continuidade de
--       sessão é garantida por construção, e aí sim os blocos podem
--       ser colados em pedaços separados dentro da mesma conexão
--       `psql`.
-- Rodar bloco a bloco dentro do SQL Editor do Studio, em cliques
-- separados de "Run", NÃO é uma terceira opção — é exatamente o
-- que já causou push acidental antes.
-- ============================================================


-- ============================================================
-- PARTE A — ENSAIO (roda ANTES de `supabase db push` aplicar a
-- migração de verdade; termina em `rollback;`, nada persiste)
-- ============================================================


-- ============================================================
-- BLOCO 1 — BASELINE, fora de transação (só leitura, roda sozinho)
--
-- Contagens e marca d'água que serão comparadas com o BLOCO 3,
-- depois do rollback da Parte A.
--
-- ATENÇÃO: este bloco NÃO PODE citar a coluna nova de public.cards
-- criada pela migração — ela ainda não existe neste ponto do
-- ensaio. Foi exatamente este o bug real encontrado no ensaio da
-- Phase 6.1 (`column "numero" does not exist`, ver
-- supabase/verificacao_cards_numero.sql). Não "melhorar" este
-- bloco acrescentando uma referência à coluna nova antes dela
-- nascer.
-- ============================================================

select
  count(*)         as cards_total,
  max(updated_at)  as updated_at_max
from public.cards;

select count(*) as parcelas_total from public.parcelas;

select count(*) as lancamentos_total from public.parcela_lancamentos;


-- ============================================================
-- BLOCO 2 — ENSAIO EM TRANSAÇÃO (mesmo clique de "Run" do BLOCO 1
-- e do BLOCO 3 — ver aviso de pooling no topo deste arquivo)
--
-- Abre a transação que sustenta as Provas 2.1 a 2.7 abaixo. Dentro:
-- (a) uma cópia literal da DDL da migração; (b) a MESMA DDL de
-- novo, para provar reexecutabilidade — se a segunda passagem der
-- erro ou mudar qualquer contagem, a migração não está pronta;
-- (c) as sete provas. A transação só fecha no BLOCO 3, com
-- `rollback;`.
-- ============================================================

begin;

-- ---- (a) DDL da migração — primeira passagem --------------------

alter table public.cards
  add column if not exists arquivado_em timestamptz;

create or replace function public.impedir_exclusao_de_card_com_lancamento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.parcela_lancamentos pl
    join public.parcelas p on p.id = pl.parcela_id
    where p.card_id = old.id
  ) then
    raise exception 'Contrato com lançamento financeiro registrado não pode ser excluído. Arquive o contrato em vez de excluir.';
  end if;

  return old;
end;
$$;

drop trigger if exists cards_impede_exclusao_com_lancamento on public.cards;

create trigger cards_impede_exclusao_com_lancamento
  before delete on public.cards
  for each row
  execute function public.impedir_exclusao_de_card_com_lancamento();

-- ---- (b) DDL da migração — segunda passagem (prova de idempotência) ----

alter table public.cards
  add column if not exists arquivado_em timestamptz;

create or replace function public.impedir_exclusao_de_card_com_lancamento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.parcela_lancamentos pl
    join public.parcelas p on p.id = pl.parcela_id
    where p.card_id = old.id
  ) then
    raise exception 'Contrato com lançamento financeiro registrado não pode ser excluído. Arquive o contrato em vez de excluir.';
  end if;

  return old;
end;
$$;

drop trigger if exists cards_impede_exclusao_com_lancamento on public.cards;

create trigger cards_impede_exclusao_com_lancamento
  before delete on public.cards
  for each row
  execute function public.impedir_exclusao_de_card_com_lancamento();

-- ---- Prova 2.1 — a coluna nasceu certa: timestamptz, nulável, sem default ----

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cards'
  and column_name = 'arquivado_em';
-- esperado: data_type = 'timestamp with time zone',
-- is_nullable = 'YES', column_default is null

-- ---- Prova 2.2 — ninguém foi arquivado pela migração ------------------

select count(*) as arquivados
from public.cards
where arquivado_em is not null;
-- esperado: 0

-- ---- Prova 2.3 — o trigger existe e é BEFORE DELETE ROW ---------------

select
  t.tgname,
  t.tgtype,
  t.tgenabled,
  c.relname as tabela
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where t.tgname = 'cards_impede_exclusao_com_lancamento';
-- esperado: uma linha, tabela = 'cards', tgenabled = 'O'
-- (tgtype é a codificação bitmask do Postgres para BEFORE/DELETE/ROW,
-- não precisa decodificar à mão para confirmar que a linha existe)

-- ---- Prova 2.4 — o backstop BLOQUEIA (o lado que importa) -------------

do $$
declare
  v_card_id uuid;
begin
  select p.card_id into v_card_id
  from public.parcelas p
  join public.parcela_lancamentos pl on pl.parcela_id = p.id
  limit 1;

  if v_card_id is null then
    raise exception 'FALHOU: ensaio precisa de pelo menos um card com lançamento para provar o bloqueio';
  end if;

  begin
    delete from public.cards where id = v_card_id;
    raise exception 'FALHOU: cards_impede_exclusao_com_lancamento deveria ter recusado a exclusão de um card com lançamento';
  exception when raise_exception then
    raise notice 'OK recusado: card % com lançamento não pôde ser excluído', v_card_id;
  end;
end $$;

-- ---- Prova 2.5 — o backstop NÃO bloqueia demais (D-14) ----------------
--
-- Card com parcelas mas ZERO lançamentos precisa continuar
-- excluível. Se não existir nenhum assim no banco no momento do
-- ensaio, cria-se um card temporário dentro desta mesma transação
-- (desfeito pelo rollback do BLOCO 3) e usa-se esse — o bloco
-- registra em `raise notice` qual dos dois caminhos foi seguido.

do $$
declare
  v_card_id uuid;
  v_column_id uuid;
  v_afetadas integer;
  v_criado_temporario boolean := false;
begin
  select p.card_id into v_card_id
  from public.parcelas p
  where not exists (
    select 1 from public.parcela_lancamentos pl where pl.parcela_id = p.id
  )
  limit 1;

  if v_card_id is null then
    select id into v_column_id from public.columns limit 1;

    if v_column_id is null then
      raise exception 'FALHOU: ensaio precisa de pelo menos uma column para criar o card temporário da Prova 2.5';
    end if;

    insert into public.cards (column_id, position, proprietario, valor, endereco)
    values (v_column_id, 999999, 'ENSAIO TEMPORÁRIO', 1.00, 'ENSAIO TEMPORÁRIO')
    returning id into v_card_id;

    v_criado_temporario := true;
    raise notice 'Prova 2.5: nenhum card sem lançamento encontrado — card temporário % criado dentro da transação', v_card_id;
  else
    raise notice 'Prova 2.5: usando card existente % (parcelas sem lançamento)', v_card_id;
  end if;

  delete from public.cards where id = v_card_id;
  get diagnostics v_afetadas = row_count;

  if v_afetadas <> 1 then
    raise exception 'FALHOU: exclusão de card sem lançamento deveria afetar exatamente 1 linha, afetou %', v_afetadas;
  end if;

  raise notice 'OK excluído sem bloqueio: card % (temporário: %)', v_card_id, v_criado_temporario;
end $$;

-- ---- Prova 2.6 — o cascade de coluna também é recusado -----------------
--
-- Este é o motivo principal de o backstop existir no banco e não
-- só na Server Action: deleteColumnAction nunca cobriu este
-- caminho de cascade.

do $$
declare
  v_column_id uuid;
begin
  select c.column_id into v_column_id
  from public.cards c
  join public.parcelas p on p.card_id = c.id
  join public.parcela_lancamentos pl on pl.parcela_id = p.id
  limit 1;

  if v_column_id is null then
    raise exception 'FALHOU: ensaio precisa de uma column com pelo menos um card com lançamento para provar o bloqueio do cascade';
  end if;

  begin
    delete from public.columns where id = v_column_id;
    raise exception 'FALHOU: excluir a column deveria ter sido recusado pelo cascade para cards (o trigger deveria disparar por linha cascateada)';
  exception when raise_exception then
    raise notice 'OK recusado: column % com card de lançamento não pôde ser excluída', v_column_id;
  end;
end $$;

-- ---- Prova 2.7 — updated_at intocado -----------------------------------

select
  count(*)         as cards_total,
  max(updated_at)  as updated_at_max
from public.cards;
-- esperado: idêntico ao anotado no BLOCO 1 (a Prova 2.5 pode ter
-- criado e apagado um card temporário dentro desta mesma
-- transação, o que não altera updated_at de nenhum card
-- pré-existente)


-- ============================================================
-- BLOCO 3 — FIM DA PARTE A (mesma transação — não rode `begin;`
-- de novo)
--
-- NUNCA troque este `rollback;` por `commit;`. Nada do que rodou
-- no BLOCO 2 persiste: o rollback desfaz a coluna nova, a função,
-- o trigger e o card temporário (se algum foi criado) de uma vez
-- só.
-- ============================================================

rollback;

-- ---- confirmação pós-rollback, fora de transação (roda sozinho) -------
--
-- Repete o BLOCO 1 e confere explicitamente que a coluna nova
-- deixou de existir depois do rollback. Se ela ainda existir aqui,
-- o ensaio virou push de verdade — exatamente o acidente do D-19 —
-- e o operador precisa PARAR e reportar antes de continuar.

select
  count(*)         as cards_total,
  max(updated_at)  as updated_at_max
from public.cards;

select count(*) as parcelas_total from public.parcelas;

select count(*) as lancamentos_total from public.parcela_lancamentos;

select count(*) as coluna_arquivado_em_existe
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cards'
  and column_name = 'arquivado_em';
-- esperado: 0 — se vier 1, o rollback não desfez a DDL. PARE e
-- reporte antes de qualquer outro passo.


-- ============================================================
-- PARTE B — VERIFICAÇÃO PÓS-PUSH
--
-- Blocos independentes, rodados só DEPOIS que o plano 06.2-03
-- aplicar a migração de verdade (`supabase db push`). Não fazem
-- parte da transação da Parte A — cada um pode ser rodado sozinho.
-- ============================================================


-- ============================================================
-- BLOCO 4 — INVENTÁRIO DA COLUNA (rode sozinho, só leitura)
--
-- Esperado: coluna presente, timestamp with time zone, nulável,
-- sem default; nenhum card arquivado; cards_total e updated_at_max
-- idênticos aos anotados no BLOCO 1 da Parte A.
-- ============================================================

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cards'
  and column_name = 'arquivado_em';

select count(*) as arquivados
from public.cards
where arquivado_em is not null;
-- esperado: 0

select
  count(*)         as cards_total,
  max(updated_at)  as updated_at_max
from public.cards;


-- ============================================================
-- BLOCO 5 — TRIGGER PRESENTE E HABILITADO (rode sozinho, só leitura)
-- ============================================================

select
  t.tgname,
  t.tgenabled,
  c.relname as tabela
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where t.tgname = 'cards_impede_exclusao_com_lancamento';
-- esperado: uma linha, tgenabled = 'O'


-- ============================================================
-- BLOCO 6 — REPETIÇÃO DAS PROVAS 2.4/2.5/2.6 CONTRA O BANCO JÁ
-- MIGRADO, DENTRO DE `begin; ... rollback;`
--
-- Mesmo aviso de pooling do topo deste arquivo se aplica: cole o
-- BLOCO 6 inteiro (do `begin;` ao `rollback;`) num único clique de
-- "Run", ou rode via psql/CLI. O objetivo é confirmar que o
-- backstop está vivo em produção sem apagar nada de verdade.
-- ============================================================

begin;

do $$
declare
  v_card_id uuid;
begin
  select p.card_id into v_card_id
  from public.parcelas p
  join public.parcela_lancamentos pl on pl.parcela_id = p.id
  limit 1;

  if v_card_id is null then
    raise notice 'Prova 2.4 (pós-push): nenhum card com lançamento encontrado — pulei esta prova';
  else
    begin
      delete from public.cards where id = v_card_id;
      raise exception 'FALHOU: cards_impede_exclusao_com_lancamento deveria ter recusado a exclusão de um card com lançamento';
    exception when raise_exception then
      raise notice 'OK recusado: card % com lançamento não pôde ser excluído', v_card_id;
    end;
  end if;
end $$;

do $$
declare
  v_card_id uuid;
  v_column_id uuid;
  v_afetadas integer;
  v_criado_temporario boolean := false;
begin
  select p.card_id into v_card_id
  from public.parcelas p
  where not exists (
    select 1 from public.parcela_lancamentos pl where pl.parcela_id = p.id
  )
  limit 1;

  if v_card_id is null then
    select id into v_column_id from public.columns limit 1;

    if v_column_id is null then
      raise notice 'Prova 2.5 (pós-push): nenhuma column encontrada para criar card temporário — pulei esta prova';
    else
      insert into public.cards (column_id, position, proprietario, valor, endereco)
      values (v_column_id, 999999, 'ENSAIO TEMPORÁRIO PÓS-PUSH', 1.00, 'ENSAIO TEMPORÁRIO PÓS-PUSH')
      returning id into v_card_id;

      v_criado_temporario := true;
      raise notice 'Prova 2.5 (pós-push): card temporário % criado dentro da transação', v_card_id;
    end if;
  end if;

  if v_card_id is not null then
    delete from public.cards where id = v_card_id;
    get diagnostics v_afetadas = row_count;

    if v_afetadas <> 1 then
      raise exception 'FALHOU: exclusão de card sem lançamento deveria afetar exatamente 1 linha, afetou %', v_afetadas;
    end if;

    raise notice 'OK excluído sem bloqueio: card % (temporário: %)', v_card_id, v_criado_temporario;
  end if;
end $$;

do $$
declare
  v_column_id uuid;
begin
  select c.column_id into v_column_id
  from public.cards c
  join public.parcelas p on p.card_id = c.id
  join public.parcela_lancamentos pl on pl.parcela_id = p.id
  limit 1;

  if v_column_id is null then
    raise notice 'Prova 2.6 (pós-push): nenhuma column com card de lançamento encontrada — pulei esta prova';
  else
    begin
      delete from public.columns where id = v_column_id;
      raise exception 'FALHOU: excluir a column deveria ter sido recusado pelo cascade para cards';
    exception when raise_exception then
      raise notice 'OK recusado: column % com card de lançamento não pôde ser excluída', v_column_id;
    end;
  end if;
end $$;

rollback;


-- ============================================================
-- BLOCO 7 — POLICIES DE public.cards INTOCADAS (rode sozinho, só
-- leitura)
--
-- Esperado: continua exatamente "team full access cards", nada
-- acrescentado nem removido por esta migração.
-- ============================================================

select
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'cards';


-- ============================================================
-- BLOCO 8 — ROLLBACK DE EMERGÊNCIA
--
-- *** ATENÇÃO: este bloco só é uma saída válida ENQUANTO NENHUM
-- CONTRATO TIVER SIDO ARQUIVADO DE VERDADE. *** Depois que a
-- coluna arquivado_em carregar dado real de arquivamento, rodar
-- isto deixa de ser um rollback e vira PERDA DE INFORMAÇÃO — a
-- data de arquivamento de qualquer contrato já arquivado é
-- apagada para sempre. Só descomente e rode isto se o push
-- precisar ser revertido antes de qualquer arquivamento real ter
-- acontecido.
-- ============================================================

/*
drop trigger if exists cards_impede_exclusao_com_lancamento on public.cards;
drop function if exists public.impedir_exclusao_de_card_com_lancamento();
alter table public.cards drop column if exists arquivado_em;
*/


-- ============================================================
-- RESULTADO DO ENSAIO — <preencher no plano 06.2-02>
-- ============================================================
