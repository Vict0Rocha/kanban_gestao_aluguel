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
-- ATUALIZAÇÃO — ENSAIO REAL DE 2026-08-19 (ver "RESULTADO DO
-- ENSAIO" no fim deste arquivo): mesmo colar TUDO num único clique
-- de "Run" (via (a) abaixo) não é garantia suficiente quando
-- existem comandos FORA de um `begin;...rollback;` explícito
-- misturados com comandos DENTRO dele — só o trecho estritamente
-- entre `begin;` e `rollback;` fica garantido na mesma conexão do
-- pool. Uma primeira tentativa de contornar isso com variáveis de
-- sessão (`set_config(..., false)`) para carregar resultados de
-- leitura "antes" através de múltiplos comandos fora de transação
-- FALHOU: os valores voltaram vazios. Isso levou a uma TERCEIRA
-- via, (c) abaixo, que elimina o problema por construção ao usar
-- um único comando PL/pgSQL em vez de vários.
--
-- Existem TRÊS saídas aceitas para a PARTE A (o BLOCO 2 inteiro,
-- que abre transação e só fecha no rollback do fim da Parte A):
--   (a) colar a PARTE A INTEIRA (do primeiro `select` do BLOCO 1
--       até o `rollback;` que fecha o BLOCO 3... — na prática, a
--       forma mais segura é colar tudo, do BLOCO 1 ao BLOCO 3, num
--       ÚNICO clique de "Run"); ou
--   (b) rodar via `psql` ou Supabase CLI (`supabase db execute` /
--       `psql "$DATABASE_URL" -f ...`), onde a continuidade de
--       sessão é garantida por construção, e aí sim os blocos podem
--       ser colados em pedaços separados dentro da mesma conexão
--       `psql`; ou
--   (c) [RECOMENDADA para ensaios que precisem combinar leitura-antes
--       + DDL + provas + leitura-depois numa sessão garantida —
--       descoberta e provada no ensaio de 2026-08-19, provavelmente
--       a mais segura das três porque é auto-contida por construção]
--       condensar baseline + DDL (nas duas passagens) + provas +
--       confirmação final dentro de um ÚNICO bloco `do $$ ... $$;`
--       — um comando PL/pgSQL só, portanto uma conexão só, sem
--       depender de o pool manter cliques ou comandos separados
--       amarrados. Capturar os resultados em variáveis locais e, no
--       fim do bloco, disparar um `raise exception` proposital cuja
--       mensagem concatena todos os resultados observados. Como DDL
--       é transacional em Postgres e uma exceção não capturada
--       aborta o `do $$` inteiro, isso desfaz TUDO sozinho — sem
--       precisar de um segundo comando/clique para o `rollback;`, e
--       sem risco de esquecê-lo. O SQL Editor mostra a mensagem de
--       erro normalmente, com o resultado consolidado nela. Ver o
--       exemplo real no bloco "RESULTADO DO ENSAIO" no fim deste
--       arquivo.
-- Rodar bloco a bloco dentro do SQL Editor do Studio, em cliques
-- separados de "Run", fora de uma das três vias acima, NÃO é uma
-- via válida — é exatamente o que já causou push acidental antes.
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
-- RESULTADO DO ENSAIO — 2026-08-19
--
-- Contexto primeiro: a Parte A NÃO foi executada literalmente por
-- nenhuma das duas vias previstas no plano — nem (a) um único Run
-- colando tudo no SQL Editor, nem (b) psql/CLI direto contra
-- produção. A via (a) foi tentada primeiro e revelou um problema
-- novo: mesmo dentro de UM clique, comandos que ficam FORA de um
-- `begin;...rollback;` explícito podem cair em conexões diferentes
-- do pool do Supabase Studio — só o trecho estritamente entre
-- `begin;` e `rollback;` fica garantido na mesma conexão. Uma
-- primeira tentativa de contornar isso com variáveis de sessão
-- (`set_config(..., false)`) para carregar resultados de leitura
-- "antes" através de múltiplos comandos fora de transação FALHOU:
-- os valores "antes" e das provas voltaram vazios, só os valores
-- "depois" (que rodaram em sequência imediata, sem gap de clique)
-- sobreviveram. Esta é uma extensão da lição de D-19 (Phase 6.1,
-- ver supabase/verificacao_cards_numero.sql) — não uma repetição
-- idêntica: lá o problema era `begin`/`rollback` em cliques
-- separados; aqui o problema apareceu mesmo dentro de um único
-- clique, por causa de comandos soltos fora da transação.
--
-- A técnica que efetivamente funcionou, desenvolvida ao vivo
-- durante este ensaio e agora documentada como a via (c) do aviso
-- de pooling no topo deste arquivo: todo o ensaio — baseline, DDL
-- (duas passagens), as 7 provas — dentro de um ÚNICO bloco
-- `do $$ ... $$;`. No final do bloco, em vez de um `rollback;`
-- separado, um `raise exception` proposital cuja mensagem
-- concatena os resultados capturados em variáveis locais. Como DDL
-- é transacional em Postgres e uma exceção não capturada aborta o
-- comando inteiro, isso desfaz TUDO sozinho — sem depender de um
-- segundo comando/clique para o rollback, e sem risco de
-- connection-hopping entre `begin` e `rollback`, porque não existem
-- dois comandos separados: é um só.
--
-- Caminho de execução usado: (c) — bloco `do $$ ... $$;` único com
-- `raise exception` final, não (a) nem (b) literalmente.
--
-- Baseline (antes, lido dentro do bloco):
--   cards_total = 50, updated_at_max = 2026-08-19 14:11:32.099956+00,
--   parcelas_total = 342, lancamentos_total = 16
--
-- IDs reais usados nas provas (para a Parte B repetir contra os
-- mesmos alvos quando aplicável — note que a Prova 2.5 excluiu e
-- restaurou um card real dentro da transação, então o mesmo `id`
-- pode não ter mais o mesmo estado de "sem lançamento" depois de
-- mais uso do app):
--   - card com lançamento (Prova 2.4): 88706ed9-778f-4dde-8478-addaa13a2a81
--   - card sem lançamento, real, não temporário (Prova 2.5): 12a909c5-d135-4ee7-aa8f-69070c5cdaa5
--   - column do cascade (Prova 2.6): cab7bbfe-95bb-4af6-be6a-9e2b26947468
--
-- Resultado de cada prova, observado (não presumido):
--   - 2.1: data_type = timestamp with time zone, is_nullable = YES,
--     column_default vazio — exatamente o esperado
--   - 2.2: arquivados = 0 — esperado
--   - 2.3: trigger_existe = true — esperado
--   - 2.4: OK recusado (card 88706ed9-778f-4dde-8478-addaa13a2a81)
--     — backstop bloqueou a exclusão do card com lançamento, como
--     deveria
--   - 2.5: OK excluido (card 12a909c5-d135-4ee7-aa8f-69070c5cdaa5,
--     temporario: false) — backstop liberou a exclusão de um card
--     real (não precisou criar temporário) com parcelas mas sem
--     lançamento nenhum, confirmando que o predicado de D-14 não é
--     largo demais
--   - 2.6: OK recusado (column cab7bbfe-95bb-4af6-be6a-9e2b26947468)
--     — cascade via exclusão de coluna também recusado
--   - 2.7 (dentro do bloco, antes do rollback automático via
--     exceção): cards = 49 (um a menos, porque a Prova 2.5 de fato
--     excluiu um card real dentro da transação — esperado, é o
--     teste acontecendo), updated_at_max idêntico ao baseline
--
-- Depois (confirmado via consulta separada e independente, fora de
-- qualquer transação, depois que a exceção proposital abortou o
-- bloco `do $$`):
--   cards_total = 50, updated_at_max = 2026-08-19 14:11:32.099956+00,
--   parcelas_total = 342, lancamentos_total = 16,
--   coluna_arquivado_em_existe = 0
--
-- Idêntico ao baseline em todos os quatro números, e a coluna
-- realmente não existe mais: o rollback automático (via exceção)
-- desfez tudo, incluindo o card real que a Prova 2.5 tinha apagado
-- dentro do bloco — ele voltou.
--
-- Nenhuma correção foi necessária em
-- supabase/migrations/20260819000000_cards_arquivado_em.sql: a DDL
-- em si passou sem alteração nas duas passagens, dentro do bloco
-- único. A única mudança foi de técnica de execução do ensaio, não
-- da migração — por isso não houve necessidade de refazer o ensaio
-- inteiro por causa de correção de arquivo (uma única rodada foi
-- suficiente com a via (c)).
--
-- Todos os critérios de aceite da Task 1 do plano 06.2-02 estão
-- satisfeitos com evidência real: caminho de execução declarado,
-- baseline e IDs anotados, sete provas com resultado observado, a
-- Prova 2.4 recusou e a Prova 2.5 passou, e depois do rollback
-- `arquivado_em` não existe e os quatro números batem com o
-- baseline.
--
-- Migração aprovada para aplicação em produção pelo plano 06.2-03.
-- ============================================================


-- ============================================================
-- RESULTADO DO PUSH E DA VERIFICAÇÃO PÓS-PUSH — 2026-08-19
--
-- Checkpoint:decision (Task 1) resolvido como `aplicar-agora`.
--
-- Push aplicado via SQL Editor do Supabase (colando a DDL completa
-- da migração, sem o wrapper begin/rollback do ensaio — mesmo
-- caminho documentado em 04-03-SUMMARY.md, CLI ausente na máquina
-- do operador): "Sucesso" / "Success. No rows returned".
--
-- Parte B rodada contra o banco já migrado. BLOCO 4 rodado em duas
-- consultas separadas (o SQL Editor só devolve o resultado da
-- última quando várias são coladas juntas — mesma limitação já
-- registrada no restante deste arquivo):
--   - coluna: data_type = timestamp with time zone, is_nullable =
--     YES, column_default = null — exatamente o esperado
--   - arquivados = 0 — esperado
--   - cards_total = 50, updated_at_max = 2026-08-19 14:11:32.099956+00
--     — idêntico ao baseline do ensaio (plano 06.2-02); nada foi
--     tocado pelo push
--
-- BLOCO 5: trigger cards_impede_exclusao_com_lancamento presente em
-- pg_trigger, tgenabled = 'O'.
--
-- BLOCO 6 (os três lados do backstop contra o banco já migrado)
-- rodado via a mesma técnica da via (c) — um único bloco `do $$ ...
-- $$;` terminando em `raise exception`, adaptado para não depender
-- de nenhum estado gravado antes do push (script em
-- pos-push-06.2-bloco6.sql, não versionado, gerado ad-hoc para este
-- checkpoint):
--   - 2.4: OK recusado (card 88706ed9-778f-4dde-8478-addaa13a2a81)
--     — mesmo card usado no ensaio, com lançamento real; exclusão
--     recusada pelo trigger em produção
--   - 2.5: OK excluído (card 12a909c5-d135-4ee7-aa8f-69070c5cdaa5,
--     temporário: false) — card real sem lançamento, excluído sem
--     bloqueio; desfeito pelo rollback automático da exceção
--     proposital, como toda a via (c)
--   - 2.6: OK recusado (column cab7bbfe-95bb-4af6-be6a-9e2b26947468)
--     — cascade via exclusão de coluna também recusado em produção
--
-- BLOCO 7: pg_policies para public.cards segue listando exatamente
-- "team full access cards" (cmd ALL, qual e with_check =
-- is_team_member()) — nenhuma policy criada, alterada ou removida.
--
-- Parte 2 (navegador, contra produção), confirmada pelo operador:
--   - Board carrega com os mesmos contratos; toggle Ativo/Inativo
--     continua salvando
--   - Financeiro carrega normalmente (regressão D-20 sem problema)
--   - Relatórios carrega com os mesmos números
--   - Exclusão de card COM lançamento: falhou (mensagem genérica,
--     esperada até o plano 06.2-05 mapear P0001). Confirmado por
--     SQL — não pela tela — que o card (id 3496b6d5-e79c-49f2-
--     950b-4b71699350c6) e seu lançamento (lancamentos_do_card = 1)
--     continuam no banco
--   - Exclusão de card SEM nenhum lançamento: funcionou
--
-- Todos os critérios de aceite da Task 3 do plano 06.2-03 estão
-- satisfeitos com evidência real contra produção.
-- ============================================================
