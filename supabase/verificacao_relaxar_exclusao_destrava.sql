-- ============================================================
-- Verificação do relaxamento de exclusão de card com destrava —
-- Kanban Aluguel (Phase 15)
--
-- Este runbook prova, em duas partes, que a migração
-- 20260826010000_relaxar_exclusao_destrava.sql funciona como
-- pretendido antes e depois de ser aplicada em produção (~46 imóveis
-- reais, sem ambiente de staging) — em particular, que um card cujo
-- único histórico financeiro é um lançamento tipo='destrava' passa a
-- poder ser excluído (CANDEST-01), enquanto um card com pagamento/
-- acréscimo/desconto real (ou taxa da imobiliária, ou evento de
-- caução) continua bloqueado exatamente como hoje.
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
-- supabase/verificacao_taxas_imobiliaria_lancamento_id.sql — colar
-- só a DDL, sem o `begin;` acima dela no mesmo clique, já é
-- aplicação real).
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
-- ============================================================

select count(*) as cards_total from public.cards;

select count(*) as parcelas_total from public.parcelas;

select count(*) as lancamentos_total from public.parcela_lancamentos;

select max(updated_at) as cards_updated_at_max from public.cards;


-- ============================================================
-- BLOCO 2 — ENSAIO EM TRANSAÇÃO (mesmo clique de "Run" do BLOCO 1 e
-- do BLOCO 3 — ver aviso de pooling no topo deste arquivo)
--
-- Abre a transação que sustenta as Provas 2.1 a 2.4 abaixo. Dentro:
-- a DDL completa da migração colada, seguida das quatro provas, e só
-- então `rollback;`. Tudo num único "Run".
-- ============================================================

begin;

-- ---- DDL da migração (idêntica a 20260826010000_relaxar_exclusao_
-- destrava.sql) ---------------------------------------------------

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
      and pl.tipo in ('pagamento', 'acrescimo', 'desconto')
  ) or exists (
    select 1 from public.taxas_imobiliaria t where t.card_id = old.id
  ) or exists (
    select 1 from public.caucao_eventos ce where ce.card_id = old.id
  ) then
    raise exception 'Contrato com lançamento financeiro registrado não pode ser excluído. Arquive o contrato em vez de excluir.';
  end if;

  return old;
end;
$$;

-- ---- Prova 2.1 — a prova central desta fase: um card só-destrava
-- passa a poder ser excluído -----------------------------------------
--
-- Cria um card de teste com uma parcela e um único
-- parcela_lancamentos tipo='destrava' (valor=0, motivo obrigatório
-- preenchido) — nenhum outro lançamento, nenhuma taxa, nenhuma
-- caução ligados a este card. Tenta excluir o card; se a exclusão
-- levantar exceção, o relaxamento falhou.

do $$
declare
  v_column_id uuid;
  v_card_id uuid;
  v_parcela_id uuid;
begin
  select id into v_column_id from public.columns limit 1;
  if v_column_id is null then
    raise exception 'FALHOU: ensaio precisa de pelo menos uma column para criar o card de teste da Prova 2.1';
  end if;

  insert into public.cards (column_id, position, proprietario, valor, endereco)
  values (v_column_id, 999999, 'TESTE ENSAIO 15-01 SO DESTRAVA', 1.00, 'TESTE ENSAIO 15-01 SO DESTRAVA')
  returning id into v_card_id;

  insert into public.parcelas (card_id, competencia, vencimento, valor_original)
  values (v_card_id, date_trunc('month', current_date)::date, current_date, 1500.00)
  returning id into v_parcela_id;

  insert into public.parcela_lancamentos (parcela_id, tipo, valor, data, motivo)
  values (v_parcela_id, 'destrava', 0, current_date, 'TESTE ENSAIO 15-01 — motivo de destrava para prova de relaxamento');

  begin
    delete from public.cards where id = v_card_id;
  exception when others then
    raise exception 'RELAXAMENTO FALHOU: card so-destrava continua bloqueado (%): %', v_card_id, sqlerrm;
  end;

  raise notice 'OK relaxado: card so-destrava excluido com sucesso (%)', v_card_id;
end $$;

-- ---- Prova 2.2 — a proteção que TEM que continuar: um card com
-- pagamento ainda bloqueia --------------------------------------------
--
-- Mesmo molde da Prova 2.1, outro card de teste, agora com um
-- parcela_lancamentos tipo='pagamento' (valor > 0). A exclusão TEM
-- que continuar recusada — se não recusar, a proteção quebrou.

do $$
declare
  v_column_id uuid;
  v_card_id uuid;
  v_parcela_id uuid;
  v_excluiu_sem_erro boolean := false;
begin
  select id into v_column_id from public.columns limit 1;
  if v_column_id is null then
    raise exception 'FALHOU: ensaio precisa de pelo menos uma column para criar o card de teste da Prova 2.2';
  end if;

  insert into public.cards (column_id, position, proprietario, valor, endereco)
  values (v_column_id, 999999, 'TESTE ENSAIO 15-01 COM PAGAMENTO', 1.00, 'TESTE ENSAIO 15-01 COM PAGAMENTO')
  returning id into v_card_id;

  insert into public.parcelas (card_id, competencia, vencimento, valor_original)
  values (v_card_id, date_trunc('month', current_date)::date, current_date, 1500.00)
  returning id into v_parcela_id;

  insert into public.parcela_lancamentos (parcela_id, tipo, valor, data)
  values (v_parcela_id, 'pagamento', 1500.00, current_date);

  begin
    delete from public.cards where id = v_card_id;
    v_excluiu_sem_erro := true;
  exception when others then
    raise notice 'OK protegido: card com pagamento continua bloqueado (%): %', v_card_id, sqlerrm;
  end;

  if v_excluiu_sem_erro then
    raise exception 'PROTECAO QUEBROU: card com pagamento deixou de bloquear a exclusao (%)', v_card_id;
  end if;
end $$;

-- ---- Prova 2.3 — taxas/caução continuam bloqueando, sem depender de
-- parcela_lancamentos ---------------------------------------------------
--
-- Um terceiro card de teste, com uma linha em taxas_imobiliaria e
-- NENHUM parcela_lancamentos — confirma que os dois exists que não
-- mudaram continuam recusando a exclusão.

do $$
declare
  v_column_id uuid;
  v_card_id uuid;
  v_parcela_id uuid;
  v_excluiu_sem_erro boolean := false;
begin
  select id into v_column_id from public.columns limit 1;
  if v_column_id is null then
    raise exception 'FALHOU: ensaio precisa de pelo menos uma column para criar o card de teste da Prova 2.3';
  end if;

  insert into public.cards (column_id, position, proprietario, valor, endereco)
  values (v_column_id, 999999, 'TESTE ENSAIO 15-01 COM TAXA', 1.00, 'TESTE ENSAIO 15-01 COM TAXA')
  returning id into v_card_id;

  insert into public.parcelas (card_id, competencia, vencimento, valor_original)
  values (v_card_id, date_trunc('month', current_date)::date, current_date, 1500.00)
  returning id into v_parcela_id;

  insert into public.taxas_imobiliaria (parcela_id, card_id, origem, valor)
  values (v_parcela_id, v_card_id, 'administracao', 150.00);

  begin
    delete from public.cards where id = v_card_id;
    v_excluiu_sem_erro := true;
  exception when others then
    raise notice 'OK protegido: card com taxa continua bloqueado (%): %', v_card_id, sqlerrm;
  end;

  if v_excluiu_sem_erro then
    raise exception 'PROTECAO QUEBROU: card com taxa deixou de bloquear a exclusao (%)', v_card_id;
  end if;
end $$;

-- ---- Prova 2.4 — RLS inalterada (nenhuma policy nova em nenhuma
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
-- BLOCO 2 persiste: o rollback desfaz o corpo novo da função e os
-- três cards/parcelas/lançamentos/taxa de teste de uma vez só.
-- ============================================================

rollback;

-- ---- confirmação pós-rollback, fora de transação (roda sozinho) -------

select count(*) as cards_total from public.cards;

select count(*) as parcelas_total from public.parcelas;

select count(*) as lancamentos_total from public.parcela_lancamentos;

select max(updated_at) as cards_updated_at_max from public.cards;
-- esperado: os quatro números batem exatamente com o BLOCO 1 — os
-- três cards de teste (e suas parcelas/lançamentos/taxa) desapareceram
-- com o rollback

-- Repete a Prova 2.1 fora de transação, só para leitura (sem apagar
-- nada de verdade) — usa pg_get_functiondef para conferir que o corpo
-- da função voltou a ser o antigo, sem o filtro de tipo novo.

select
  pg_get_functiondef('public.impedir_exclusao_de_card_com_lancamento()'::regprocedure) as corpo_atual_da_funcao;
-- esperado: o corpo NÃO contém "pl.tipo in ('pagamento', 'acrescimo',
-- 'desconto')" — se esse filtro ainda estiver presente aqui, fora da
-- transação, o ensaio virou push: o operador deve PARAR e reportar
-- antes de seguir para o plano 15-04.


-- ============================================================
-- PARTE B — VERIFICAÇÃO PÓS-PUSH (blocos independentes, rodados só
-- depois do plano 15-06 aplicar a migração de verdade)
-- ============================================================


-- ============================================================
-- BLOCO 4 — CORPO DA FUNÇÃO EM PRODUÇÃO (rode sozinho, só leitura)
-- ============================================================

select
  pg_get_functiondef('public.impedir_exclusao_de_card_com_lancamento()'::regprocedure) as corpo_atual_da_funcao;
-- esperado: o corpo CONTÉM "pl.tipo in ('pagamento', 'acrescimo',
-- 'desconto')" — o filtro de tipo está de verdade em produção


-- ============================================================
-- BLOCO 5 — REPETIR AS PROVAS 2.1/2.2/2.3 CONTRA O SCHEMA JÁ MIGRADO
-- (rode dentro de um `begin;...rollback;` próprio, ou aceite que os
-- registros de teste ficam se não usar transação)
-- ============================================================
--
-- Copiar os três blocos `do $$ ... $$` das Provas 2.1/2.2/2.3 acima e
-- rodar contra o schema já migrado, de preferência dentro de um novo
-- `begin; ... rollback;` para não deixar dado de teste em produção.


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
-- RESULTADO DO ENSAIO — <preencher no plano 15-04>
-- ============================================================
