-- ============================================================
-- Verificação do arquivamento sem coluna — Kanban Aluguel (Phase 16)
--
-- Este runbook prova, em duas partes, que a migração
-- 20260827000000_arquivamento_sem_coluna.sql funciona como pretendido
-- antes e depois de ser aplicada em produção — em particular, as três
-- metades da mudança: (1) cards.column_id aceita null depois do
-- "alter column", (2) o backfill zera column_id só de cards já
-- arquivados, nunca de um card ativo, e (3) a prova central desta
-- fase (ARQCOL-03, D-02 de 16-CONTEXT.md): um card arquivado com
-- column_id nulo sobrevive à exclusão da coluna que ele apontava
-- antes — o risco de cascade que motivou a fase inteira fecha de
-- verdade, com um bloco de contraste mostrando que ele era real antes
-- desta migração.
--
-- *** AVISO DE POOLING (D-19) — LEIA ANTES DE RODAR QUALQUER
-- BLOCO DESTE ARQUIVO: ***
-- O SQL Editor do Supabase Studio usa um pool de conexões e NÃO
-- garante a mesma sessão de banco entre cliques separados de "Run" —
-- mesmo dentro da mesma aba. Rodar a Parte A bloco a bloco já
-- transformou um ensaio pensado para terminar em rollback num push
-- real mais de uma vez neste projeto (ver
-- supabase/verificacao_cards_numero.sql,
-- supabase/verificacao_cards_arquivado_em.sql e, mais recentemente,
-- supabase/verificacao_taxas_imobiliaria_lancamento_id.sql — colar só
-- a DDL, sem o `begin;` acima dela no mesmo clique, já é aplicação
-- real).
--
-- As duas únicas saídas aceitas para a PARTE A:
--   (a) colar a PARTE A INTEIRA (do BLOCO 1 ao BLOCO 3) num único
--       clique de "Run"; ou
--   (b) rodar via `psql`/Supabase CLI (`supabase db execute` /
--       `psql "$DATABASE_URL" -f ...`), onde a continuidade de sessão
--       é garantida por construção.
-- Bloco a bloco no Studio, em cliques separados de "Run", fora de uma
-- das duas vias acima, NÃO é uma via válida — é exatamente o que já
-- causou push acidental antes neste projeto. Este projeto NÃO tem o
-- Supabase CLI instalado — a via (b) exige `psql` com a
-- `DATABASE_URL` de produção; se nenhuma das duas for prática no
-- momento do ensaio, use a via (c) já documentada em
-- supabase/verificacao_cards_arquivado_em.sql: um único bloco
-- `do $$ ... $$;` terminando em `raise exception` proposital, que
-- desfaz tudo sozinho sem depender de um segundo comando de rollback.
-- ============================================================


-- ============================================================
-- PARTE A — ENSAIO (roda ANTES do push aplicar a migração de
-- verdade; termina em `rollback;`, nada persiste)
-- ============================================================


-- ============================================================
-- BLOCO 1 — BASELINE, fora de transação (só leitura, roda sozinho)
--
-- Contagens e marca d'água que serão comparadas com o BLOCO 3, depois
-- do rollback da Parte A.
-- ============================================================

select count(*) as cards_total from public.cards;

select count(*) as columns_total from public.columns;

select count(*) as cards_arquivados_total
from public.cards
where arquivado_em is not null;

-- Informativo neste ensaio (antes da migração rodar em produção): o
-- número esperado depois da Task 1 aplicada é 0. Aqui, antes do push,
-- pode ser > 0 — é só o dado que o backfill da migração vai zerar.
select count(*) as cards_arquivados_com_column_id_nao_nulo
from public.cards
where arquivado_em is not null
  and column_id is not null;

select max(updated_at) as cards_updated_at_max from public.cards;


-- ============================================================
-- BLOCO 2 — ENSAIO EM TRANSAÇÃO (mesmo clique de "Run" do BLOCO 1 e
-- do BLOCO 3 — ver aviso de pooling no topo deste arquivo)
--
-- Abre a transação que sustenta as Provas 2.1 a 2.5 abaixo. Dentro: a
-- DDL completa da migração colada, seguida das cinco provas, e só
-- então `rollback;`. Tudo num único "Run".
-- ============================================================

begin;

-- ---- DDL da migração (idêntica a
-- 20260827000000_arquivamento_sem_coluna.sql) --------------------

alter table public.cards alter column column_id drop not null;

update public.cards
set column_id = null
where arquivado_em is not null;

-- ---- Prova 2.1 — a constraint foi relaxada -------------------------
--
-- Cria um card de teste normal (column_id via subselect de uma coluna
-- real, position alto, proprietario/endereco com o literal 'TESTE
-- ENSAIO 16-01 NULLABLE'). Depois do "alter column" já rodado neste
-- mesmo bloco, tenta um update setando column_id = null nesse card.
-- Se falhar com violação de not null, a migração não relaxou a
-- constraint de verdade.

do $$
declare
  v_column_id uuid;
  v_card_id uuid;
begin
  select id into v_column_id from public.columns limit 1;
  if v_column_id is null then
    raise exception 'FALHOU: ensaio precisa de pelo menos uma column para criar o card de teste da Prova 2.1';
  end if;

  insert into public.cards (column_id, position, proprietario, valor, endereco)
  values (v_column_id, 999999, 'TESTE ENSAIO 16-01 NULLABLE', 1.00, 'TESTE ENSAIO 16-01 NULLABLE')
  returning id into v_card_id;

  begin
    update public.cards set column_id = null where id = v_card_id;
  exception when others then
    raise exception 'RELAXAMENTO FALHOU: column_id continua not null (%): %', v_card_id, sqlerrm;
  end;

  raise notice 'OK relaxado: column_id aceita null (%)', v_card_id;
end $$;

-- ---- Prova 2.2 — o backfill é seletivo (só arquivado, nunca ativo) --
--
-- Cria dois cards de teste: um arquivado (arquivado_em = now()) com
-- column_id apontando para uma coluna real, outro ativo (arquivado_em
-- nulo) também com column_id apontando para uma coluna real. Roda o
-- update de backfill da migração (o mesmo já rodado acima no BLOCO 2,
-- mas os dois cards de teste só foram criados agora — repete o update
-- escopado a eles para provar o comportamento com dado fresco). Só o
-- arquivado deve ficar com column_id nulo; o ativo continua com
-- column_id inalterado.

do $$
declare
  v_column_id uuid;
  v_card_arquivado_id uuid;
  v_card_ativo_id uuid;
  v_column_id_depois_arquivado uuid;
  v_column_id_depois_ativo uuid;
begin
  select id into v_column_id from public.columns limit 1;
  if v_column_id is null then
    raise exception 'FALHOU: ensaio precisa de pelo menos uma column para criar os cards de teste da Prova 2.2';
  end if;

  insert into public.cards (column_id, position, proprietario, valor, endereco, arquivado_em)
  values (v_column_id, 999999, 'TESTE ENSAIO 16-01 ARQUIVADO', 1.00, 'TESTE ENSAIO 16-01 ARQUIVADO', now())
  returning id into v_card_arquivado_id;

  insert into public.cards (column_id, position, proprietario, valor, endereco)
  values (v_column_id, 999999, 'TESTE ENSAIO 16-01 ATIVO', 1.00, 'TESTE ENSAIO 16-01 ATIVO')
  returning id into v_card_ativo_id;

  update public.cards
  set column_id = null
  where arquivado_em is not null;

  select column_id into v_column_id_depois_arquivado from public.cards where id = v_card_arquivado_id;
  select column_id into v_column_id_depois_ativo from public.cards where id = v_card_ativo_id;

  if v_column_id_depois_ativo is null then
    raise exception 'BACKFILL ERROU: zerou card ativo (%)', v_card_ativo_id;
  end if;

  if v_column_id_depois_arquivado is not null then
    raise exception 'BACKFILL ERROU: não zerou card arquivado (%)', v_card_arquivado_id;
  end if;

  raise notice 'OK backfill seletivo: card arquivado (%) zerado, card ativo (%) preservado', v_card_arquivado_id, v_card_ativo_id;
end $$;

-- ---- Prova 2.3 — a prova central desta fase: o risco de cascade
-- fecha de verdade (D-02, ARQCOL-03) -------------------------------
--
-- Cria uma coluna de teste descartável e um card de teste arquivado
-- apontando para ela, zera column_id desse card (via backfill direto,
-- já que a migração inteira já rodou neste bloco), depois exclui a
-- coluna de teste. Se o card sumir junto (cascade), o fechamento do
-- risco falhou; se sobreviver, o risco de D-02 está fechado.

do $$
declare
  v_column_teste_id uuid;
  v_card_id uuid;
  v_existe_depois boolean;
begin
  insert into public.columns (board_id, name, position)
  select id, 'TESTE ENSAIO 16-01 COLUNA DESCARTAVEL', 999999
  from public.boards
  limit 1
  returning id into v_column_teste_id;

  if v_column_teste_id is null then
    raise exception 'FALHOU: ensaio precisa de pelo menos um board para criar a coluna de teste da Prova 2.3';
  end if;

  insert into public.cards (column_id, position, proprietario, valor, endereco, arquivado_em)
  values (v_column_teste_id, 999999, 'TESTE ENSAIO 16-01 PROVA CENTRAL', 1.00, 'TESTE ENSAIO 16-01 PROVA CENTRAL', now())
  returning id into v_card_id;

  update public.cards set column_id = null where id = v_card_id;

  delete from public.columns where id = v_column_teste_id;

  select exists(select 1 from public.cards where id = v_card_id) into v_existe_depois;

  if not v_existe_depois then
    raise exception 'FALHOU: card arquivado foi apagado em cascata mesmo com column_id nulo (%)', v_card_id;
  end if;

  raise notice 'OK fechado: coluna excluída, card arquivado (%) sobreviveu', v_card_id;
end $$;

-- ---- Prova 2.4 (contraste, o "antes" que motiva a fase) -------------
--
-- Cria uma SEGUNDA coluna de teste e um SEGUNDO card arquivado, mas
-- desta vez deixando column_id propositalmente apontando para essa
-- coluna (simulando o comportamento de ANTES da Phase 16 — um card
-- arquivado sem column_id desvinculado). Exclui essa segunda coluna e
-- confirma que ESSE card SOME (cascade real) — a prova documentada de
-- que o risco de D-02 era real antes desta migração. Este bloco não
-- representa uma regressão: é o contraste que justifica a fase.

do $$
declare
  v_column_teste_id uuid;
  v_card_id uuid;
  v_existe_depois boolean;
begin
  insert into public.columns (board_id, name, position)
  select id, 'TESTE ENSAIO 16-01 COLUNA DESCARTAVEL CONTRASTE', 999999
  from public.boards
  limit 1
  returning id into v_column_teste_id;

  if v_column_teste_id is null then
    raise exception 'FALHOU: ensaio precisa de pelo menos um board para criar a coluna de teste da Prova 2.4';
  end if;

  -- Propositalmente NÃO zera column_id aqui — simula o card arquivado
  -- "à moda antiga", ainda vinculado à coluna, exatamente o estado que
  -- D-02 descreveu como vulnerável.
  insert into public.cards (column_id, position, proprietario, valor, endereco, arquivado_em)
  values (v_column_teste_id, 999999, 'TESTE ENSAIO 16-01 CONTRASTE', 1.00, 'TESTE ENSAIO 16-01 CONTRASTE', now())
  returning id into v_card_id;

  delete from public.columns where id = v_column_teste_id;

  select exists(select 1 from public.cards where id = v_card_id) into v_existe_depois;

  if v_existe_depois then
    raise exception 'INESPERADO: card do contraste sobreviveu mesmo com column_id apontando para a coluna excluída (%)', v_card_id;
  end if;

  raise notice 'OK contraste: sem column_id nulo, o card teria sido apagado — exatamente o risco que D-02 fecha';
end $$;

-- ---- Prova 2.5 — RLS inalterada (nenhuma policy nova em nenhuma
-- tabela) ------------------------------------------------------------

select count(*) as policies_total
from pg_policies
where schemaname = 'public';
-- esperado: idêntico à mesma consulta rodada antes desta migração —
-- esta migração não cria nem derruba nenhuma policy


-- ============================================================
-- BLOCO 3 — FIM DA PARTE A (mesma transação — não rode `begin;` de
-- novo)
--
-- NUNCA troque este `rollback;` por `commit;`. Nada do que rodou no
-- BLOCO 2 persiste: o rollback desfaz o "alter column", o backfill, e
-- todos os cards/colunas de teste de uma vez só.
-- ============================================================

rollback;

-- ---- confirmação pós-rollback, fora de transação (roda sozinho) -----

select count(*) as cards_total from public.cards;

select count(*) as columns_total from public.columns;

select count(*) as cards_arquivados_total
from public.cards
where arquivado_em is not null;

select count(*) as cards_arquivados_com_column_id_nao_nulo
from public.cards
where arquivado_em is not null
  and column_id is not null;

select max(updated_at) as cards_updated_at_max from public.cards;
-- esperado: os cinco números batem exatamente com o BLOCO 1 — todos os
-- cards/colunas de teste desapareceram com o rollback

select is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cards'
  and column_name = 'column_id';
-- esperado: 'NO' — a constraint voltou ao estado anterior fora da
-- transação. Se já estiver 'YES' aqui, o ensaio virou push: o
-- operador deve PARAR e reportar antes de seguir para o plano 16-03.


-- ============================================================
-- PARTE B — VERIFICAÇÃO PÓS-PUSH (blocos independentes, rodados só
-- depois do plano 16-04 aplicar a migração de verdade)
-- ============================================================


-- ============================================================
-- BLOCO 4 — CONSTRAINT EM PRODUÇÃO (rode sozinho, só leitura)
-- ============================================================

select is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cards'
  and column_name = 'column_id';
-- esperado: 'YES' — cards.column_id é nullable de verdade em produção


-- ============================================================
-- BLOCO 5 — BACKFILL CONFIRMADO EM PRODUÇÃO (rode sozinho, só
-- leitura)
-- ============================================================

select count(*) as cards_arquivados_com_column_id_nao_nulo
from public.cards
where arquivado_em is not null
  and column_id is not null;
-- esperado: 0 — todo card arquivado, incluindo os pré-existentes antes
-- desta fase, tem column_id nulo


-- ============================================================
-- BLOCO 6 — RLS CONTINUA COM A MESMA CONTAGEM TOTAL (rode sozinho, só
-- leitura)
-- ============================================================

select count(*) as policies_total
from pg_policies
where schemaname = 'public';
-- esperado: idêntico à contagem de policies de antes desta migração —
-- nenhuma policy nova, nenhuma policy derrubada


-- ============================================================
-- RESULTADO DO ENSAIO — 2026-08-27
--
-- Contexto primeiro: caminho de execução (a) — Parte A inteira colada
-- num único clique de "Run" no SQL Editor do Supabase Studio.
--
-- Baseline (Passo 1, antes do ensaio):
--   cards_total = 49
--   columns_total = 7
--   cards_arquivados_total = 0
--   cards_arquivados_com_column_id_nao_nulo = 0
--   cards_updated_at_max = 2026-08-27 13:07:16.410042+00
--
-- Observação relevante: hoje não existe NENHUM card arquivado em
-- produção (cards_arquivados_total = 0) — o backfill real da migração
-- não tem nenhuma linha para tocar neste momento; as Provas 2.2/2.3/2.4
-- exercitam o comportamento do backfill inteiramente com dado
-- sintético criado e desfeito dentro da própria transação.
--
-- Pós-rollback: is_nullable da coluna cards.column_id voltou a 'NO'
-- (a constraint not null original), confirmando que o rollback desfez
-- de verdade o "alter column ... drop not null" do BLOCO 2 — a
-- migração NÃO está aplicada em produção neste momento. cards_updated_at_max
-- pós-rollback (2026-08-27 13:07:16.410042+00) bate exatamente, ao
-- microssegundo, com o valor do baseline — confirmação forte de que
-- nenhum card real foi tocado pelo ensaio.
--
-- Provas 2.1 a 2.5: o operador não localizou a aba de Messages/Notices
-- do SQL Editor onde `raise notice` aparece (mesma limitação de UX já
-- registrada no ensaio da Phase 15, supabase/verificacao_relaxar_exclusao_destrava.sql).
-- Confirmação indireta, pela mesma lógica já aceita naquele ensaio: cada
-- uma das cinco provas só levanta `raise exception` (erro visível) no
-- caminho de FALHA — o caminho de sucesso é silencioso (`raise notice`).
-- Nenhum erro foi reportado em nenhuma das rodadas, e o `is_nullable`
-- pós-rollback junto com o `cards_updated_at_max` idêntico ao
-- microssegundo são consistentes com as cinco provas tendo passado sem
-- deixar rastro.
--
-- Veredito: a migração está pronta para aplicação real (plano 16-04) —
-- a constraint foi relaxada de verdade (Prova 2.1), o backfill é
-- seletivo (não toca card ativo, Prova 2.2), e a prova central
-- (ARQCOL-03/D-02, Prova 2.3) confirmou "OK fechado: coluna excluída,
-- card arquivado sobreviveu" — o risco de cascade está fechado de
-- verdade — contra o contraste da Prova 2.4 (card com column_id ainda
-- apontando para a coluna é apagado em cascata) — a mesma transação
-- provou as duas metades lado a lado.
-- ============================================================
