-- ============================================================
-- Verificação da ligação taxa <-> lançamento — Kanban Aluguel (Phase 14)
--
-- Este runbook prova, em duas partes, que a migração
-- 20260826000000_taxas_imobiliaria_lancamento_id.sql funciona como
-- pretendido antes e depois de ser aplicada em produção (~46 imóveis
-- reais, sem ambiente de staging) — em particular, que apagar o
-- lançamento de um pagamento remove automaticamente, via banco, a
-- taxa da imobiliária que aquele pagamento gerou (CANIMOB-03).
--
-- *** AVISO DE POOLING (D-19) — LEIA ANTES DE RODAR QUALQUER
-- BLOCO DESTE ARQUIVO: ***
-- O SQL Editor do Supabase Studio usa um pool de conexões e NÃO
-- garante a mesma sessão de banco entre cliques separados de "Run" —
-- mesmo dentro da mesma aba. Rodar a Parte A bloco a bloco já
-- transformou um ensaio pensado para terminar em rollback num push
-- real numa fase anterior deste projeto (ver
-- supabase/verificacao_cards_numero.sql e
-- supabase/verificacao_cards_arquivado_em.sql).
--
-- As duas únicas saídas aceitas para a PARTE A:
--   (a) colar a PARTE A INTEIRA (do BLOCO 1 ao BLOCO 3) num único
--       clique de "Run"; ou
--   (b) rodar via `psql`/Supabase CLI (`supabase db execute` /
--       `psql "$DATABASE_URL" -f ...`), onde a continuidade de sessão
--       é garantida por construção.
-- Bloco a bloco no Studio, em cliques separados de "Run", fora de uma
-- das duas vias acima, NÃO é uma via válida — é exatamente o que já
-- causou push acidental antes neste projeto. Se nenhuma das duas for
-- prática no momento do ensaio, use a via (c) já documentada em
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
--
-- ATENÇÃO: este bloco NÃO PODE citar a coluna nova de
-- taxas_imobiliaria criada por esta migração — ela ainda não existe
-- neste ponto do ensaio. Foi exatamente este tipo de erro (coluna
-- inexistente referenciada no baseline) que já quebrou um ensaio
-- anterior neste projeto (Fase 6.1, `column "numero" does not
-- exist`). NÃO "consertar" este bloco acrescentando uma referência a
-- essa coluna antes dela nascer.
-- ============================================================

select count(*) as taxas_total from public.taxas_imobiliaria;

select count(*) as lancamentos_total from public.parcela_lancamentos;

select
  count(*)         as cards_total,
  max(updated_at)  as cards_updated_at_max
from public.cards;


-- ============================================================
-- BLOCO 2 — ENSAIO EM TRANSAÇÃO (mesmo clique de "Run" do BLOCO 1 e
-- do BLOCO 3 — ver aviso de pooling no topo deste arquivo)
--
-- Abre a transação que sustenta as Provas 2.1 a 2.6 abaixo. Dentro:
-- (a) uma cópia literal da DDL da migração; (b) a MESMA DDL de novo,
-- para provar reexecutabilidade; (c) as seis provas. A transação só
-- fecha no BLOCO 3, com `rollback;`.
-- ============================================================

begin;

-- ---- (a) DDL da migração — primeira passagem --------------------

alter table public.taxas_imobiliaria
  add column if not exists lancamento_id uuid
    references public.parcela_lancamentos(id) on delete cascade;

create index if not exists taxas_imobiliaria_lancamento_id_idx
  on public.taxas_imobiliaria (lancamento_id);

-- ---- (b) DDL da migração — segunda passagem (prova de idempotência) ----

alter table public.taxas_imobiliaria
  add column if not exists lancamento_id uuid
    references public.parcela_lancamentos(id) on delete cascade;

create index if not exists taxas_imobiliaria_lancamento_id_idx
  on public.taxas_imobiliaria (lancamento_id);

-- ---- Prova 2.1 — a coluna nasceu certa: uuid, nulável, sem default ----

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'taxas_imobiliaria'
  and column_name = 'lancamento_id';
-- esperado: data_type = 'uuid', is_nullable = 'YES', column_default
-- is null

-- ---- Prova 2.2 — o índice existe -------------------------------------

select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'taxas_imobiliaria'
  and indexname = 'taxas_imobiliaria_lancamento_id_idx';
-- esperado: uma linha

-- ---- Prova 2.3 — a CASCATA de verdade, a prova central desta fase -----
--
-- Cria um card/parcela/lançamento/taxa de teste dentro desta mesma
-- transação, apaga o lançamento e confirma que a taxa ligada a ele
-- some junto, via ON DELETE CASCADE do banco — não presumido,
-- observado.

do $$
declare
  v_column_id uuid;
  v_card_id uuid;
  v_parcela_id uuid;
  v_lancamento_id uuid;
  v_taxa_id uuid;
  v_taxas_restantes integer;
begin
  select id into v_column_id from public.columns limit 1;
  if v_column_id is null then
    raise exception 'FALHOU: ensaio precisa de pelo menos uma column para criar o card de teste da Prova 2.3';
  end if;

  insert into public.cards (column_id, position, proprietario, valor, endereco)
  values (v_column_id, 999999, 'TESTE ENSAIO 14-01', 1.00, 'TESTE ENSAIO 14-01')
  returning id into v_card_id;

  insert into public.parcelas (card_id, competencia, vencimento, valor_original)
  values (v_card_id, date_trunc('month', current_date)::date, current_date, 1500.00)
  returning id into v_parcela_id;

  insert into public.parcela_lancamentos (parcela_id, tipo, valor, data)
  values (v_parcela_id, 'pagamento', 1500.00, current_date)
  returning id into v_lancamento_id;

  insert into public.taxas_imobiliaria (parcela_id, card_id, origem, valor, lancamento_id)
  values (v_parcela_id, v_card_id, 'administracao', 150.00, v_lancamento_id)
  returning id into v_taxa_id;

  -- apaga o lançamento de teste — se a FK/cascade estiver certa, a
  -- taxa ligada a ele desaparece sozinha, sem nenhum DELETE explícito
  -- em taxas_imobiliaria.
  delete from public.parcela_lancamentos where id = v_lancamento_id;

  select count(*) into v_taxas_restantes
  from public.taxas_imobiliaria
  where id = v_taxa_id;

  if v_taxas_restantes <> 0 then
    raise exception 'CASCATA FALHOU: a taxa % sobreviveu ao lançamento % apagado', v_taxa_id, v_lancamento_id;
  end if;

  raise notice 'OK cascata: taxa % foi removida automaticamente ao apagar o lançamento %', v_taxa_id, v_lancamento_id;
end $$;

-- ---- Prova 2.4 — lancamento_id nulo continua aceito --------------------
--
-- Um segundo INSERT em taxas_imobiliaria, desta vez SEM lancamento_id,
-- usando uma parcela real qualquer via subselect — o caso de toda
-- linha pré-existente e de qualquer taxa futura sem pagamento
-- vinculado identificável.

do $$
declare
  v_parcela_id uuid;
  v_card_id uuid;
  v_taxa_id uuid;
begin
  select p.id, p.card_id into v_parcela_id, v_card_id
  from public.parcelas p
  limit 1;

  if v_parcela_id is null then
    raise exception 'FALHOU: ensaio precisa de pelo menos uma parcela em public.parcelas para a Prova 2.4';
  end if;

  insert into public.taxas_imobiliaria (parcela_id, card_id, origem, valor)
  values (v_parcela_id, v_card_id, 'administracao', 100.00)
  returning id into v_taxa_id;

  if v_taxa_id is null then
    raise exception 'FALHOU: insert em taxas_imobiliaria sem lancamento_id deveria ter sido aceito';
  end if;

  raise notice 'OK lancamento_id nulo aceito: taxa % inserida sem lancamento_id', v_taxa_id;
end $$;

-- ---- Prova 2.5 — RLS inalterada (continua exatamente 1 policy) --------

select count(*) as policies_taxas_imobiliaria
from pg_policies
where schemaname = 'public'
  and tablename = 'taxas_imobiliaria';
-- esperado: 1 — nenhuma policy nova foi criada por esta migração

-- ---- Prova 2.6 — cards pré-existente intocado --------------------------
--
-- Exclui da contagem o card de teste da Prova 2.3 (proprietario/
-- endereco literal 'TESTE ENSAIO 14-01', que desaparece no rollback do
-- BLOCO 3) — o que sobra precisa bater exatamente com o baseline do
-- BLOCO 1.

select
  count(*)         as cards_total,
  max(updated_at)  as cards_updated_at_max
from public.cards
where proprietario <> 'TESTE ENSAIO 14-01';
-- esperado: idêntico a cards_total/cards_updated_at_max do BLOCO 1


-- ============================================================
-- BLOCO 3 — FIM DA PARTE A (mesma transação — não rode `begin;` de
-- novo)
--
-- NUNCA troque este `rollback;` por `commit;`. Nada do que rodou no
-- BLOCO 2 persiste: o rollback desfaz a coluna nova, o índice novo e
-- o card/parcela/lançamento/taxa de teste de uma vez só.
-- ============================================================

rollback;

-- ---- confirmação pós-rollback, fora de transação (roda sozinho) -------

select count(*) as taxas_total from public.taxas_imobiliaria;

select count(*) as lancamentos_total from public.parcela_lancamentos;

select
  count(*)         as cards_total,
  max(updated_at)  as cards_updated_at_max
from public.cards;

select count(*) as coluna_lancamento_id_existe
from information_schema.columns
where table_schema = 'public'
  and table_name = 'taxas_imobiliaria'
  and column_name = 'lancamento_id';
-- esperado: 0

select count(*) as indice_lancamento_id_existe
from pg_indexes
where schemaname = 'public'
  and tablename = 'taxas_imobiliaria'
  and indexname = 'taxas_imobiliaria_lancamento_id_idx';
-- esperado: 0 — se qualquer um dos dois sobreviveu, o ensaio virou
-- push. PARE e reporte antes de qualquer outro passo, antes de seguir
-- para o plano 14-02.


-- ============================================================
-- PARTE B — VERIFICAÇÃO PÓS-PUSH (blocos independentes, rodados só
-- depois do plano 14-03 aplicar a migração de verdade)
-- ============================================================


-- ============================================================
-- BLOCO 4 — INVENTÁRIO DA COLUNA E DO ÍNDICE (rode sozinho, só
-- leitura)
-- ============================================================

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'taxas_imobiliaria'
  and column_name = 'lancamento_id';
-- esperado: data_type = 'uuid', is_nullable = 'YES', column_default
-- is null

select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'taxas_imobiliaria'
  and indexname = 'taxas_imobiliaria_lancamento_id_idx';
-- esperado: uma linha


-- ============================================================
-- BLOCO 5 — NENHUM BACKFILL ACONTECEU (rode sozinho, só leitura)
-- ============================================================

select count(*) as taxas_com_lancamento_id
from public.taxas_imobiliaria
where lancamento_id is not null;
-- esperado: 0 logo após a aplicação (sem backfill, D-03) — só passa a
-- ser diferente de 0 depois que o plano 14-04 (registrarPagamentoAction)
-- começar a gravar taxas novas com lancamento_id preenchido


-- ============================================================
-- BLOCO 6 — RLS DE taxas_imobiliaria INALTERADA (rode sozinho, só
-- leitura)
-- ============================================================

select
  tablename,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'taxas_imobiliaria';
-- esperado: exatamente 1 linha, "team full access taxas_imobiliaria",
-- cmd = ALL, nenhuma mudança de RLS


-- ============================================================
-- RESULTADO DO ENSAIO — <data>
-- ============================================================
