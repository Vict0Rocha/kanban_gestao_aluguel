-- ============================================================
-- Verificação do dinheiro da imobiliária — Kanban Aluguel (Phase 13)
--
-- Este runbook prova, em duas partes, que a migração
-- 20260824000000_dinheiro_imobiliaria.sql funciona como pretendido
-- antes e depois de ser aplicada em produção (~46 imóveis reais,
-- sem ambiente de staging).
--
-- *** AVISO DE POOLING (D-19) — LEIA ANTES DE RODAR QUALQUER
-- BLOCO DESTE ARQUIVO: ***
-- O SQL Editor do Supabase Studio usa um pool de conexões e NÃO
-- garante a mesma sessão de banco entre cliques separados de
-- "Run" — mesmo dentro da mesma aba. Rodar a Parte A bloco a bloco
-- já transformou um ensaio pensado para terminar em rollback num
-- push real na Fase 6.1, só percebido comparando `updated_at_max`
-- antes e depois (ver supabase/verificacao_cards_numero.sql).
--
-- As duas únicas saídas aceitas para a PARTE A:
--   (a) colar a PARTE A INTEIRA (do BLOCO 1 ao BLOCO 3) num único
--       clique de "Run"; ou
--   (b) rodar via `psql`/Supabase CLI (`supabase db execute` /
--       `psql "$DATABASE_URL" -f ...`), onde a continuidade de
--       sessão é garantida por construção.
-- Bloco a bloco no Studio, em cliques separados de "Run", fora de
-- uma das duas vias acima, NÃO é uma via válida — é exatamente o
-- que já causou push acidental antes neste projeto (ver também
-- supabase/verificacao_cards_arquivado_em.sql, que documenta uma
-- terceira técnica — via (c), um único bloco `do $$ ... $$;`
-- terminando em `raise exception` proposital — descoberta na Fase
-- 6.2 para o mesmo tipo de ensaio; use-a se (a)/(b) não forem
-- práticas no momento do ensaio real).
-- ============================================================


-- ============================================================
-- PARTE A — ENSAIO (roda ANTES do push aplicar a migração de
-- verdade; termina em `rollback;`, nada persiste)
-- ============================================================


-- ============================================================
-- BLOCO 1 — BASELINE, fora de transação (só leitura, roda sozinho)
--
-- Contagens e marca d'água que serão comparadas com o BLOCO 3,
-- depois do rollback da Parte A.
--
-- ATENÇÃO: este bloco NÃO PODE citar nenhuma das quatro adições
-- desta migração (os dois percentuais novos de public.cards, nem
-- as duas tabelas novas) — nenhuma das quatro existe ainda neste
-- ponto do ensaio. Foi exatamente este tipo de erro (coluna/tabela
-- inexistente referenciada no baseline) que já quebrou um ensaio
-- anterior neste projeto (Fase 6.1, `column "numero" does not
-- exist`). NÃO "consertar" este bloco acrescentando uma referência
-- a qualquer uma das quatro adições antes delas nascerem.
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
-- Abre a transação que sustenta as Provas 2.1 a 2.8 abaixo. Dentro:
-- (a) uma cópia literal da DDL da migração; (b) a MESMA DDL de
-- novo, para provar reexecutabilidade; (c) as oito provas. A
-- transação só fecha no BLOCO 3, com `rollback;`.
-- ============================================================

begin;

-- ---- (a) DDL da migração — primeira passagem --------------------

alter table public.cards
  add column if not exists percentual_administracao numeric(5,2) not null default 10,
  add column if not exists percentual_comissao_primeiro_aluguel numeric(5,2) not null default 50;

alter table public.cards drop constraint if exists cards_percentual_administracao_valido;
alter table public.cards drop constraint if exists cards_percentual_comissao_valido;

alter table public.cards
  add constraint cards_percentual_administracao_valido
    check (percentual_administracao >= 0 and percentual_administracao <= 100),
  add constraint cards_percentual_comissao_valido
    check (percentual_comissao_primeiro_aluguel >= 0 and percentual_comissao_primeiro_aluguel <= 100);

create table if not exists public.taxas_imobiliaria (
  id uuid primary key default gen_random_uuid(),
  parcela_id uuid not null references public.parcelas(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  origem text not null,
  valor numeric(12,2) not null default 0,
  data date not null default current_date,
  observacao text,
  criado_por uuid references public.profiles(id),
  criado_em timestamptz not null default now()
);

alter table public.taxas_imobiliaria drop constraint if exists taxas_imobiliaria_origem_valida;
alter table public.taxas_imobiliaria drop constraint if exists taxas_imobiliaria_valor_nao_negativo;
alter table public.taxas_imobiliaria drop constraint if exists taxas_imobiliaria_observacao_tamanho;

alter table public.taxas_imobiliaria
  add constraint taxas_imobiliaria_origem_valida
    check (origem in ('administracao', 'comissao_primeiro_aluguel')),
  add constraint taxas_imobiliaria_valor_nao_negativo
    check (valor >= 0 and valor < 10000000),
  add constraint taxas_imobiliaria_observacao_tamanho
    check (observacao is null or length(observacao) <= 2000);

create index if not exists taxas_imobiliaria_card_id_idx
  on public.taxas_imobiliaria (card_id);
create index if not exists taxas_imobiliaria_parcela_id_idx
  on public.taxas_imobiliaria (parcela_id);

alter table public.taxas_imobiliaria enable row level security;
drop policy if exists "team full access taxas_imobiliaria" on public.taxas_imobiliaria;
create policy "team full access taxas_imobiliaria"
  on public.taxas_imobiliaria for all to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create table if not exists public.caucao_eventos (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  tipo text not null,
  valor numeric(12,2) not null,
  data date not null default current_date,
  observacao text,
  criado_por uuid references public.profiles(id),
  criado_em timestamptz not null default now()
);

alter table public.caucao_eventos drop constraint if exists caucao_eventos_tipo_valido;
alter table public.caucao_eventos drop constraint if exists caucao_eventos_valor_positivo;
alter table public.caucao_eventos drop constraint if exists caucao_eventos_observacao_tamanho;

alter table public.caucao_eventos
  add constraint caucao_eventos_tipo_valido
    check (tipo in ('recebido', 'devolvido', 'usado')),
  add constraint caucao_eventos_valor_positivo
    check (valor > 0 and valor < 10000000),
  add constraint caucao_eventos_observacao_tamanho
    check (observacao is null or length(observacao) <= 2000);

create index if not exists caucao_eventos_card_id_idx
  on public.caucao_eventos (card_id);

alter table public.caucao_eventos enable row level security;
drop policy if exists "team full access caucao_eventos" on public.caucao_eventos;
create policy "team full access caucao_eventos"
  on public.caucao_eventos for all to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

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

-- ---- (b) DDL da migração — segunda passagem (prova de idempotência) ----

alter table public.cards
  add column if not exists percentual_administracao numeric(5,2) not null default 10,
  add column if not exists percentual_comissao_primeiro_aluguel numeric(5,2) not null default 50;

alter table public.cards drop constraint if exists cards_percentual_administracao_valido;
alter table public.cards drop constraint if exists cards_percentual_comissao_valido;

alter table public.cards
  add constraint cards_percentual_administracao_valido
    check (percentual_administracao >= 0 and percentual_administracao <= 100),
  add constraint cards_percentual_comissao_valido
    check (percentual_comissao_primeiro_aluguel >= 0 and percentual_comissao_primeiro_aluguel <= 100);

create table if not exists public.taxas_imobiliaria (
  id uuid primary key default gen_random_uuid(),
  parcela_id uuid not null references public.parcelas(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  origem text not null,
  valor numeric(12,2) not null default 0,
  data date not null default current_date,
  observacao text,
  criado_por uuid references public.profiles(id),
  criado_em timestamptz not null default now()
);

alter table public.taxas_imobiliaria drop constraint if exists taxas_imobiliaria_origem_valida;
alter table public.taxas_imobiliaria drop constraint if exists taxas_imobiliaria_valor_nao_negativo;
alter table public.taxas_imobiliaria drop constraint if exists taxas_imobiliaria_observacao_tamanho;

alter table public.taxas_imobiliaria
  add constraint taxas_imobiliaria_origem_valida
    check (origem in ('administracao', 'comissao_primeiro_aluguel')),
  add constraint taxas_imobiliaria_valor_nao_negativo
    check (valor >= 0 and valor < 10000000),
  add constraint taxas_imobiliaria_observacao_tamanho
    check (observacao is null or length(observacao) <= 2000);

create index if not exists taxas_imobiliaria_card_id_idx
  on public.taxas_imobiliaria (card_id);
create index if not exists taxas_imobiliaria_parcela_id_idx
  on public.taxas_imobiliaria (parcela_id);

alter table public.taxas_imobiliaria enable row level security;
drop policy if exists "team full access taxas_imobiliaria" on public.taxas_imobiliaria;
create policy "team full access taxas_imobiliaria"
  on public.taxas_imobiliaria for all to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create table if not exists public.caucao_eventos (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  tipo text not null,
  valor numeric(12,2) not null,
  data date not null default current_date,
  observacao text,
  criado_por uuid references public.profiles(id),
  criado_em timestamptz not null default now()
);

alter table public.caucao_eventos drop constraint if exists caucao_eventos_tipo_valido;
alter table public.caucao_eventos drop constraint if exists caucao_eventos_valor_positivo;
alter table public.caucao_eventos drop constraint if exists caucao_eventos_observacao_tamanho;

alter table public.caucao_eventos
  add constraint caucao_eventos_tipo_valido
    check (tipo in ('recebido', 'devolvido', 'usado')),
  add constraint caucao_eventos_valor_positivo
    check (valor > 0 and valor < 10000000),
  add constraint caucao_eventos_observacao_tamanho
    check (observacao is null or length(observacao) <= 2000);

create index if not exists caucao_eventos_card_id_idx
  on public.caucao_eventos (card_id);

alter table public.caucao_eventos enable row level security;
drop policy if exists "team full access caucao_eventos" on public.caucao_eventos;
create policy "team full access caucao_eventos"
  on public.caucao_eventos for all to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

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

-- ---- Prova 2.1 — as duas colunas nasceram certas -----------------------

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cards'
  and column_name in ('percentual_administracao', 'percentual_comissao_primeiro_aluguel')
order by column_name;
-- esperado: as duas linhas com data_type = 'numeric', is_nullable =
-- 'NO', column_default citando 10/50

-- ---- Prova 2.2 — todo card existente recebeu o default certo ----------

select count(*) as cards_com_percentual_diferente_do_default
from public.cards
where percentual_administracao <> 10
   or percentual_comissao_primeiro_aluguel <> 50;
-- esperado: 0 — nenhum card existente ficou nulo ou com valor
-- diferente do default logo após o alter table

-- ---- Prova 2.3 — taxas_imobiliaria nasceu com as 8 colunas certas -----

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'taxas_imobiliaria'
order by ordinal_position;
-- esperado: id, parcela_id, card_id, origem, valor, data,
-- observacao, criado_por, criado_em (9 linhas, incluindo id)

-- ---- Prova 2.4 — caucao_eventos nasceu com as colunas certas ----------

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'caucao_eventos'
order by ordinal_position;
-- esperado: id, card_id, tipo, valor, data, observacao, criado_por,
-- criado_em (8 linhas, incluindo id)

-- ---- Prova 2.5 — as CHECK/FK recusam, uma por uma ----------------------
--
-- Usa um parcela_id/card_id real (escolhido por subselect, sem
-- hardcode de UUID). Nove recusas de CHECK + uma recusa de FK.

do $$
declare
  v_card_id uuid;
  v_parcela_id uuid;
begin
  select p.card_id, p.id into v_card_id, v_parcela_id
  from public.parcelas p
  limit 1;

  if v_parcela_id is null then
    raise exception 'FALHOU: ensaio precisa de pelo menos uma parcela em public.parcelas';
  end if;

  -- ---- taxas_imobiliaria.origem inválida ------------------------------
  begin
    insert into public.taxas_imobiliaria (parcela_id, card_id, origem, valor)
    values (v_parcela_id, v_card_id, 'invalida', 100.00);
    raise exception 'FALHOU: taxas_imobiliaria_origem_valida deveria ter recusado origem invalida';
  exception when check_violation then
    raise notice 'OK recusado: taxas_imobiliaria_origem_valida';
  end;

  -- ---- taxas_imobiliaria.valor negativo --------------------------------
  begin
    insert into public.taxas_imobiliaria (parcela_id, card_id, origem, valor)
    values (v_parcela_id, v_card_id, 'administracao', -50.00);
    raise exception 'FALHOU: taxas_imobiliaria_valor_nao_negativo deveria ter recusado valor negativo';
  exception when check_violation then
    raise notice 'OK recusado: taxas_imobiliaria_valor_nao_negativo';
  end;

  -- ---- taxas_imobiliaria.valor >= 10000000 -----------------------------
  begin
    insert into public.taxas_imobiliaria (parcela_id, card_id, origem, valor)
    values (v_parcela_id, v_card_id, 'administracao', 10000000.00);
    raise exception 'FALHOU: taxas_imobiliaria_valor_nao_negativo deveria ter recusado valor >= 10000000';
  exception when check_violation then
    raise notice 'OK recusado: taxas_imobiliaria_valor_nao_negativo (teto)';
  end;

  -- ---- taxas_imobiliaria.observacao acima de 2000 caracteres -----------
  begin
    insert into public.taxas_imobiliaria (parcela_id, card_id, origem, valor, observacao)
    values (v_parcela_id, v_card_id, 'administracao', 100.00, repeat('x', 2001));
    raise exception 'FALHOU: taxas_imobiliaria_observacao_tamanho deveria ter recusado observacao > 2000';
  exception when check_violation then
    raise notice 'OK recusado: taxas_imobiliaria_observacao_tamanho';
  end;

  -- ---- taxas_imobiliaria.parcela_id inexistente (FK) --------------------
  begin
    insert into public.taxas_imobiliaria (parcela_id, card_id, origem, valor)
    values (gen_random_uuid(), v_card_id, 'administracao', 100.00);
    raise exception 'FALHOU: FK de parcela_id deveria ter recusado parcela_id inexistente';
  exception when foreign_key_violation then
    raise notice 'OK recusado (FK): taxas_imobiliaria.parcela_id inexistente';
  end;

  -- ---- caucao_eventos.tipo inválido -------------------------------------
  begin
    insert into public.caucao_eventos (card_id, tipo, valor)
    values (v_card_id, 'invalido', 100.00);
    raise exception 'FALHOU: caucao_eventos_tipo_valido deveria ter recusado tipo invalido';
  exception when check_violation then
    raise notice 'OK recusado: caucao_eventos_tipo_valido';
  end;

  -- ---- caucao_eventos.valor <= 0 (zero também é recusado, A-03) ---------
  begin
    insert into public.caucao_eventos (card_id, tipo, valor)
    values (v_card_id, 'recebido', 0);
    raise exception 'FALHOU: caucao_eventos_valor_positivo deveria ter recusado valor zero';
  exception when check_violation then
    raise notice 'OK recusado: caucao_eventos_valor_positivo (zero, diferente de taxas_imobiliaria)';
  end;

  -- ---- caucao_eventos.valor >= 10000000 ----------------------------------
  begin
    insert into public.caucao_eventos (card_id, tipo, valor)
    values (v_card_id, 'recebido', 10000000.00);
    raise exception 'FALHOU: caucao_eventos_valor_positivo deveria ter recusado valor >= 10000000';
  exception when check_violation then
    raise notice 'OK recusado: caucao_eventos_valor_positivo (teto)';
  end;

  -- ---- cards.percentual_administracao negativo ---------------------------
  begin
    update public.cards set percentual_administracao = -1 where id = v_card_id;
    raise exception 'FALHOU: cards_percentual_administracao_valido deveria ter recusado percentual negativo';
  exception when check_violation then
    raise notice 'OK recusado: cards_percentual_administracao_valido (negativo)';
  end;

  -- ---- cards.percentual_administracao > 100 --------------------------------
  begin
    update public.cards set percentual_administracao = 101 where id = v_card_id;
    raise exception 'FALHOU: cards_percentual_administracao_valido deveria ter recusado percentual > 100';
  exception when check_violation then
    raise notice 'OK recusado: cards_percentual_administracao_valido (acima de 100)';
  end;

end $$;

-- ---- Prova 2.6 — RLS negativa/positiva ----------------------------------
--
-- Simula alguém autenticado no Supabase mas ausente de
-- public.allowed_members. Para este papel, as duas tabelas novas
-- devem se comportar como se estivessem vazias, e nenhum insert
-- deve completar.

set local role authenticated;
set local request.jwt.claims to '{"email":"intruso-teste@exemplo.invalid","role":"authenticated"}';

select count(*) as taxas_imobiliaria_vistas_pelo_intruso from public.taxas_imobiliaria;
-- esperado: 0

select count(*) as caucao_eventos_vistos_pelo_intruso from public.caucao_eventos;
-- esperado: 0

do $$
begin
  begin
    insert into public.caucao_eventos (card_id, tipo, valor)
    values ((select id from public.cards limit 1), 'recebido', 500.00);
    raise exception 'FALHOU: RLS deixou passar insert em caucao_eventos para o intruso';
  exception when insufficient_privilege then
    raise notice 'OK recusado pelo RLS: insert em caucao_eventos (intruso)';
  end;
end $$;

reset role;
-- TROQUE o e-mail abaixo pelo seu, o mesmo cadastrado em
-- public.allowed_members, antes de rodar.
set local request.jwt.claims to '{"email":"SEU-EMAIL-DA-ALLOWLIST@exemplo.com","role":"authenticated"}';
set local role authenticated;

select count(*) as taxas_imobiliaria_vistas_pela_allowlist from public.taxas_imobiliaria;
-- esperado: >= 1 (as linhas de teste da Prova 2.5, se alguma sobreviveu ao erro/rollback interno)

insert into public.caucao_eventos (card_id, tipo, valor)
values ((select id from public.cards limit 1), 'recebido', 500.00);
-- deve completar sem erro — prova positiva de que o papel da
-- allowlist tem acesso de escrita

reset role;

-- ---- Prova 2.7 — o backstop ampliado, os quatro lados -------------------
--
-- (1) bloqueia por taxa, (2) bloqueia por caução, (3) continua
-- bloqueando por pagamento (regressão da Phase 6.2), (4) libera
-- quando nenhum dos três existe.

do $$
declare
  v_column_id uuid;
  v_card_taxa uuid;
  v_parcela_apoio uuid;
  v_card_id_qualquer uuid;
  v_card_caucao uuid;
  v_card_pagamento uuid;
  v_card_livre uuid;
  v_afetadas integer;
begin
  select id into v_column_id from public.columns limit 1;
  if v_column_id is null then
    raise exception 'FALHOU: ensaio precisa de pelo menos uma column para criar cards temporários da Prova 2.7';
  end if;

  select p.card_id into v_card_id_qualquer from public.parcelas p limit 1;

  -- (1) card com evento em taxas_imobiliaria -------------------------------
  insert into public.cards (column_id, position, proprietario, valor, endereco)
  values (v_column_id, 999991, 'ENSAIO TAXA', 1.00, 'ENSAIO TAXA')
  returning id into v_card_taxa;

  insert into public.parcelas (card_id, competencia, vencimento, valor_original)
  values (v_card_taxa, date_trunc('month', current_date)::date, current_date, 1500.00)
  returning id into v_parcela_apoio;

  insert into public.taxas_imobiliaria (parcela_id, card_id, origem, valor)
  values (v_parcela_apoio, v_card_taxa, 'administracao', 150.00);

  begin
    delete from public.cards where id = v_card_taxa;
    raise exception 'FALHOU: card com linha em taxas_imobiliaria deveria ter sido recusado';
  exception when raise_exception then
    raise notice 'OK recusado (taxa): card % com taxa registrada nao pode ser excluido', v_card_taxa;
  end;

  -- (2) card com evento em caucao_eventos ------------------------------------
  insert into public.cards (column_id, position, proprietario, valor, endereco)
  values (v_column_id, 999992, 'ENSAIO CAUCAO', 1.00, 'ENSAIO CAUCAO')
  returning id into v_card_caucao;

  insert into public.caucao_eventos (card_id, tipo, valor)
  values (v_card_caucao, 'recebido', 1200.00);

  begin
    delete from public.cards where id = v_card_caucao;
    raise exception 'FALHOU: card com linha em caucao_eventos deveria ter sido recusado';
  exception when raise_exception then
    raise notice 'OK recusado (caucao): card % com evento de caucao nao pode ser excluido', v_card_caucao;
  end;

  -- (3) regressao: card com lancamento em parcela_lancamentos continua bloqueado --
  if v_card_id_qualquer is not null then
    begin
      delete from public.cards where id = v_card_id_qualquer
        and exists (
          select 1 from public.parcela_lancamentos pl
          join public.parcelas p on p.id = pl.parcela_id
          where p.card_id = v_card_id_qualquer
        );
      raise exception 'FALHOU: card com lancamento em parcela_lancamentos deveria continuar recusado (regressao Phase 6.2)';
    exception when raise_exception then
      raise notice 'OK recusado (regressao parcela_lancamentos): card com lancamento nao pode ser excluido';
    end;
  else
    raise notice 'Prova 2.7 (3): nenhum card com parcela encontrado para reconfirmar a regressao — pulei esta sub-prova';
  end if;

  -- (4) card sem nenhum dos tres eh excluido normalmente ----------------------
  insert into public.cards (column_id, position, proprietario, valor, endereco)
  values (v_column_id, 999993, 'ENSAIO LIVRE', 1.00, 'ENSAIO LIVRE')
  returning id into v_card_livre;

  delete from public.cards where id = v_card_livre;
  get diagnostics v_afetadas = row_count;

  if v_afetadas <> 1 then
    raise exception 'FALHOU: card sem taxa/caucao/lancamento deveria ter sido excluido, afetou %', v_afetadas;
  end if;

  raise notice 'OK excluido sem bloqueio: card % (sem taxa, caucao ou lancamento)', v_card_livre;
end $$;

-- ---- Prova 2.8 — updated_at intocado -------------------------------------

select
  count(*)         as cards_total,
  max(updated_at)  as updated_at_max
from public.cards;
-- esperado: cards_total = cards_total do BLOCO 1 + 1 (o card
-- "ENSAIO TAXA" da Prova 2.7 nao foi excluido, ficou preso pelo
-- backstop de proposito), updated_at_max identico ao do BLOCO 1


-- ============================================================
-- BLOCO 3 — FIM DA PARTE A (mesma transação — não rode `begin;`
-- de novo)
--
-- NUNCA troque este `rollback;` por `commit;`. Nada do que rodou
-- no BLOCO 2 persiste: o rollback desfaz as duas colunas novas, as
-- duas tabelas novas, a função ampliada e todos os cards/parcelas/
-- taxas/eventos temporários de uma vez só.
-- ============================================================

rollback;

-- ---- confirmação pós-rollback, fora de transação (roda sozinho) -------

select
  count(*)         as cards_total,
  max(updated_at)  as updated_at_max
from public.cards;

select count(*) as parcelas_total from public.parcelas;

select count(*) as lancamentos_total from public.parcela_lancamentos;

select count(*) as colunas_novas_em_cards_existem
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cards'
  and column_name in ('percentual_administracao', 'percentual_comissao_primeiro_aluguel');
-- esperado: 0

select count(*) as tabelas_novas_existem
from information_schema.tables
where table_schema = 'public'
  and table_name in ('taxas_imobiliaria', 'caucao_eventos');
-- esperado: 0 — se qualquer um dos quatro sobreviveu, o ensaio
-- virou push. PARE e reporte antes de qualquer outro passo, antes
-- de seguir para o plano 13-02.


-- ============================================================
-- PARTE B — VERIFICAÇÃO PÓS-PUSH (blocos independentes, rodados
-- só depois do plano 13-03 aplicar a migração de verdade)
-- ============================================================


-- ============================================================
-- BLOCO 4 — INVENTÁRIO DAS COLUNAS E TABELAS (rode sozinho, só
-- leitura)
-- ============================================================

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cards'
  and column_name in ('percentual_administracao', 'percentual_comissao_primeiro_aluguel')
order by column_name;

select
  count(*)         as cards_total,
  max(updated_at)  as updated_at_max
from public.cards;
-- esperado: cards_total e updated_at_max idênticos aos anotados no
-- BLOCO 1 da Parte A

select count(*) as cards_com_percentual_diferente_do_default
from public.cards
where percentual_administracao <> 10
   or percentual_comissao_primeiro_aluguel <> 50;
-- esperado: 0 — nenhum contrato real editou o percentual antes
-- deste ponto, já que a tela de edição só nasce no plano 13-05

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'taxas_imobiliaria'
order by ordinal_position;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'caucao_eventos'
order by ordinal_position;


-- ============================================================
-- BLOCO 5 — CONSTRAINTS, POLICIES E FUNÇÃO AMPLIADA (rode sozinho,
-- só leitura)
--
-- Esperado: 8 CHECK constraints novas (2 em cards, 3 em
-- taxas_imobiliaria, 3 em caucao_eventos), 2 policies novas
-- (ambas citando is_team_member em qual e with_check), e a função
-- ampliada citando as três tabelas.
-- ============================================================

select
  conrelid::regclass        as tabela,
  conname                   as regra,
  pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid in (
    'public.cards'::regclass,
    'public.taxas_imobiliaria'::regclass,
    'public.caucao_eventos'::regclass
  )
  and contype = 'c'
  and (conname like '%percentual%' or conname like '%taxas_imobiliaria%' or conname like '%caucao_eventos%')
order by conrelid::regclass::text, conname;

select
  tablename,
  policyname,
  qual,
  with_check
from pg_policies
where tablename in ('taxas_imobiliaria', 'caucao_eventos')
order by tablename, policyname;

select pg_get_functiondef('public.impedir_exclusao_de_card_com_lancamento'::regproc);
-- esperado: o corpo contém as três referências
-- (parcela_lancamentos, taxas_imobiliaria, caucao_eventos)


-- ============================================================
-- BLOCO 6 — OS QUATRO LADOS DO BACKSTOP, CONTRA O BANCO JÁ MIGRADO
-- (mesmo aviso de pooling do topo deste arquivo — cole o BLOCO 6
-- inteiro num único clique de "Run", ou rode via psql/CLI)
-- ============================================================

begin;

do $$
declare
  v_column_id uuid;
  v_card_taxa uuid;
  v_parcela_apoio uuid;
  v_card_id_qualquer uuid;
  v_card_caucao uuid;
  v_card_livre uuid;
  v_afetadas integer;
begin
  select id into v_column_id from public.columns limit 1;
  if v_column_id is null then
    raise notice 'Prova 2.7 (pós-push): nenhuma column encontrada — pulei esta prova';
  else
    select p.card_id into v_card_id_qualquer from public.parcelas p limit 1;

    insert into public.cards (column_id, position, proprietario, valor, endereco)
    values (v_column_id, 999994, 'ENSAIO TAXA PÓS-PUSH', 1.00, 'ENSAIO TAXA PÓS-PUSH')
    returning id into v_card_taxa;

    insert into public.parcelas (card_id, competencia, vencimento, valor_original)
    values (v_card_taxa, (date_trunc('month', current_date) + interval '20 months')::date, current_date, 1500.00)
    returning id into v_parcela_apoio;

    insert into public.taxas_imobiliaria (parcela_id, card_id, origem, valor)
    values (v_parcela_apoio, v_card_taxa, 'administracao', 150.00);

    begin
      delete from public.cards where id = v_card_taxa;
      raise exception 'FALHOU: card com linha em taxas_imobiliaria deveria ter sido recusado';
    exception when raise_exception then
      raise notice 'OK recusado (taxa, pós-push): card % nao pode ser excluido', v_card_taxa;
    end;

    insert into public.cards (column_id, position, proprietario, valor, endereco)
    values (v_column_id, 999995, 'ENSAIO CAUCAO PÓS-PUSH', 1.00, 'ENSAIO CAUCAO PÓS-PUSH')
    returning id into v_card_caucao;

    insert into public.caucao_eventos (card_id, tipo, valor)
    values (v_card_caucao, 'recebido', 1200.00);

    begin
      delete from public.cards where id = v_card_caucao;
      raise exception 'FALHOU: card com linha em caucao_eventos deveria ter sido recusado';
    exception when raise_exception then
      raise notice 'OK recusado (caucao, pós-push): card % nao pode ser excluido', v_card_caucao;
    end;

    if v_card_id_qualquer is not null then
      begin
        delete from public.cards where id = v_card_id_qualquer
          and exists (
            select 1 from public.parcela_lancamentos pl
            join public.parcelas p on p.id = pl.parcela_id
            where p.card_id = v_card_id_qualquer
          );
        raise exception 'FALHOU: card com lancamento em parcela_lancamentos deveria continuar recusado';
      exception when raise_exception then
        raise notice 'OK recusado (regressao parcela_lancamentos, pós-push)';
      end;
    else
      raise notice 'Prova 2.7 (3, pós-push): nenhum card com parcela encontrado — pulei esta sub-prova';
    end if;

    insert into public.cards (column_id, position, proprietario, valor, endereco)
    values (v_column_id, 999996, 'ENSAIO LIVRE PÓS-PUSH', 1.00, 'ENSAIO LIVRE PÓS-PUSH')
    returning id into v_card_livre;

    delete from public.cards where id = v_card_livre;
    get diagnostics v_afetadas = row_count;

    if v_afetadas <> 1 then
      raise exception 'FALHOU: card sem taxa/caucao/lancamento deveria ter sido excluido, afetou %', v_afetadas;
    end if;

    raise notice 'OK excluido sem bloqueio (pós-push): card %', v_card_livre;
  end if;
end $$;

rollback;


-- ============================================================
-- BLOCO 7 — POLICIES DE public.cards, public.parcelas E
-- public.parcela_lancamentos INTOCADAS (rode sozinho, só leitura)
--
-- Esperado: continuam exatamente como antes desta migração — nada
-- acrescentado, alterado ou removido.
-- ============================================================

select
  tablename,
  policyname,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('cards', 'parcelas', 'parcela_lancamentos')
order by tablename, policyname;


-- ============================================================
-- RESULTADO DO ENSAIO — <data>
--
-- Preencher pelo plano 13-02 com: caminho de execução usado
-- ((a)/(b)/(c)), baseline anotado no BLOCO 1, ids reais usados nas
-- provas, resultado observado de cada prova (2.1 a 2.8), e a
-- confirmação pós-rollback do BLOCO 3.
-- ============================================================
