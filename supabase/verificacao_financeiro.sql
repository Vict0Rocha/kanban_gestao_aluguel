-- ============================================================
-- Verificação do módulo financeiro — Kanban Aluguel
--
-- Este runbook prova, em duas partes, que a migração
-- 20260816000000_financeiro_schema.sql funciona como pretendido
-- antes e depois de ser aplicada em produção (~46 imóveis reais,
-- sem ambiente de staging).
--
-- PARTE A — ENSAIO: roda ANTES do `supabase db push`, dentro de
-- uma única transação que só termina em ROLLBACK. Nada do que
-- acontece aqui persiste no banco — é seguro rodar quantas vezes
-- for preciso.
--
-- PARTE B — VERIFICAÇÃO PÓS-PUSH: blocos independentes, rodam
-- DEPOIS que a migração foi aplicada de verdade com
-- `supabase db push`.
--
-- RODE UM BLOCO DE CADA VEZ, na ordem, na MESMA aba do SQL Editor
-- (sem abrir "New query" no meio), porque o BEGIN do BLOCO 2 e o
-- ROLLBACK que fecha a Parte A precisam estar na mesma sessão —
-- assim como a GUC app.card_teste guardada no BLOCO 2, usada pelos
-- blocos seguintes.
-- ============================================================


-- ============================================================
-- PARTE A — ENSAIO (roda antes do push)
-- ============================================================


-- ============================================================
-- BLOCO 1 — PRÉ-VOO (rode sozinho, só leitura, não altera nada)
--
-- Anote os dois números abaixo. O BLOCO 9 (Parte B) confere que
-- eles não mudaram depois do push.
-- ============================================================

select
  count(*)        as cards_total,
  max(updated_at) as updated_at_max
from public.cards;


-- ============================================================
-- BLOCO 2 — ENSAIO EM TRANSAÇÃO
--
-- Abre a transação que os BLOCOS 3, 4, 6 e 7 (ainda nesta mesma
-- aba do SQL Editor) vão usar. Dentro, nesta ordem: (a) uma cópia
-- literal da DDL da migração; (b) a MESMA DDL de novo, para provar
-- que o arquivo é reexecutável — se a segunda passagem der erro, a
-- migração não é idempotente; (c) confere que os cards existentes
-- continuam intactos; (d) guarda um card_id real numa GUC de
-- transação, para os blocos seguintes usarem.
--
-- A transação só fecha no fim da Parte A (BLOCO 7), com ROLLBACK —
-- por isso a GUC sobrevive à troca de papel dos BLOCOS 6/7 (RLS),
-- ao contrário de um `select` direto, que o RLS filtraria.
-- ============================================================

begin;

-- ---- (a) DDL da migração — primeira passagem ------------------

alter table public.cards
  add column if not exists ativo boolean not null default true;

create table if not exists public.parcelas (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  competencia date not null,
  vencimento date not null,
  valor_original numeric(12,2) not null,
  status text not null default 'aberta',
  conciliada_em timestamptz,
  conciliada_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.parcelas drop constraint if exists parcelas_valor_original_positivo;
alter table public.parcelas drop constraint if exists parcelas_status_valido;
alter table public.parcelas drop constraint if exists parcelas_competencia_dia_1;
alter table public.parcelas drop constraint if exists parcelas_conciliada_rastreada;

alter table public.parcelas
  add constraint parcelas_valor_original_positivo
    check (valor_original > 0 and valor_original < 10000000),
  add constraint parcelas_status_valido
    check (status in ('aberta', 'parcial', 'paga', 'conciliada')),
  add constraint parcelas_competencia_dia_1
    check (extract(day from competencia) = 1),
  add constraint parcelas_conciliada_rastreada
    check (status <> 'conciliada' or (conciliada_em is not null and conciliada_by is not null));

create unique index if not exists parcelas_unica_por_competencia
  on public.parcelas (card_id, competencia);
create index if not exists parcelas_vencimento_idx on public.parcelas (vencimento);
create index if not exists parcelas_competencia_idx on public.parcelas (competencia);

alter table public.parcelas enable row level security;
drop policy if exists "team full access parcelas" on public.parcelas;
create policy "team full access parcelas"
  on public.parcelas for all to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- >>> SEÇÕES 6-9 (parcela_lancamentos, primeira passagem) entram aqui na Task 2 <<<

-- ---- (b) DDL da migração — segunda passagem (prova de idempotência) ----

alter table public.cards
  add column if not exists ativo boolean not null default true;

create table if not exists public.parcelas (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  competencia date not null,
  vencimento date not null,
  valor_original numeric(12,2) not null,
  status text not null default 'aberta',
  conciliada_em timestamptz,
  conciliada_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.parcelas drop constraint if exists parcelas_valor_original_positivo;
alter table public.parcelas drop constraint if exists parcelas_status_valido;
alter table public.parcelas drop constraint if exists parcelas_competencia_dia_1;
alter table public.parcelas drop constraint if exists parcelas_conciliada_rastreada;

alter table public.parcelas
  add constraint parcelas_valor_original_positivo
    check (valor_original > 0 and valor_original < 10000000),
  add constraint parcelas_status_valido
    check (status in ('aberta', 'parcial', 'paga', 'conciliada')),
  add constraint parcelas_competencia_dia_1
    check (extract(day from competencia) = 1),
  add constraint parcelas_conciliada_rastreada
    check (status <> 'conciliada' or (conciliada_em is not null and conciliada_by is not null));

create unique index if not exists parcelas_unica_por_competencia
  on public.parcelas (card_id, competencia);
create index if not exists parcelas_vencimento_idx on public.parcelas (vencimento);
create index if not exists parcelas_competencia_idx on public.parcelas (competencia);

alter table public.parcelas enable row level security;
drop policy if exists "team full access parcelas" on public.parcelas;
create policy "team full access parcelas"
  on public.parcelas for all to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- >>> SEÇÕES 6-9 (parcela_lancamentos, segunda passagem) entram aqui na Task 2 <<<

-- ---- (c) cards existentes continuam intactos --------------------

select count(*) from public.cards;
-- deve devolver o mesmo cards_total anotado no BLOCO 1

select count(*) from public.cards where ativo is not true;
-- deve devolver 0 — a coluna nova não deixou nenhum card sem valor

-- ---- (d) guarda um card_id real para os próximos blocos ---------

select set_config(
  'app.card_teste',
  (select id::text from public.cards limit 1),
  true
);
-- GUC local à transação (terceiro argumento = true). Sobrevive até
-- o ROLLBACK que fecha a Parte A no fim do BLOCO 7.


-- ============================================================
-- BLOCO 3 — REGRAS DE `parcelas` (mesma transação do BLOCO 2 —
-- não rode `begin;` de novo)
--
-- Insere uma parcela válida e testa, uma a uma, que cada regra
-- proibida é recusada pelo banco.
-- ============================================================

do $$
declare
  v_card_id uuid;
  v_parcela_id uuid;
begin
  v_card_id := current_setting('app.card_teste')::uuid;

  if v_card_id is null then
    raise exception 'FALHOU: ensaio precisa de pelo menos um card em public.cards';
  end if;

  -- parcela válida (linha de controle usada pelo BLOCO 4 também)
  insert into public.parcelas (card_id, competencia, vencimento, valor_original)
  values (v_card_id, date_trunc('month', current_date)::date, current_date, 1500.00)
  returning id into v_parcela_id;

  -- ---- valor_original negativo -----------------------------------
  begin
    insert into public.parcelas (card_id, competencia, vencimento, valor_original)
    values (v_card_id, (date_trunc('month', current_date) + interval '1 month')::date, current_date, -100.00);
    raise exception 'FALHOU: parcelas_valor_original_positivo deveria ter recusado valor negativo';
  exception when check_violation then
    raise notice 'OK recusado: parcelas_valor_original_positivo';
  end;

  -- ---- status fora do conjunto permitido ---------------------------
  begin
    insert into public.parcelas (card_id, competencia, vencimento, valor_original, status)
    values (v_card_id, (date_trunc('month', current_date) + interval '2 months')::date, current_date, 1500.00, 'pendente');
    raise exception 'FALHOU: parcelas_status_valido deveria ter recusado status pendente';
  exception when check_violation then
    raise notice 'OK recusado: parcelas_status_valido';
  end;

  -- ---- competencia fora do dia 1 -----------------------------------
  begin
    insert into public.parcelas (card_id, competencia, vencimento, valor_original)
    values (v_card_id, (date_trunc('month', current_date) + interval '3 months' + interval '14 days')::date, current_date, 1500.00);
    raise exception 'FALHOU: parcelas_competencia_dia_1 deveria ter recusado dia 15';
  exception when check_violation then
    raise notice 'OK recusado: parcelas_competencia_dia_1';
  end;

  -- ---- conciliada sem conciliada_em/conciliada_by --------------------
  begin
    insert into public.parcelas (card_id, competencia, vencimento, valor_original, status)
    values (v_card_id, (date_trunc('month', current_date) + interval '4 months')::date, current_date, 1500.00, 'conciliada');
    raise exception 'FALHOU: parcelas_conciliada_rastreada deveria ter recusado conciliada sem rastro';
  exception when check_violation then
    raise notice 'OK recusado: parcelas_conciliada_rastreada';
  end;

  -- ---- parcela duplicada no mesmo (card_id, competencia) --------------
  begin
    insert into public.parcelas (card_id, competencia, vencimento, valor_original)
    values (v_card_id, date_trunc('month', current_date)::date, current_date, 999.00);
    raise exception 'FALHOU: parcelas_unica_por_competencia deveria ter recusado duplicata';
  exception when unique_violation then
    raise notice 'OK recusado: parcelas_unica_por_competencia';
  end;

end $$;


-- >>> Os BLOCOS de parcela_lancamentos, os BLOCOS de RLS e a
-- >>> PARTE B chegam nas próximas tasks deste plano. Este arquivo
-- >>> ainda não está completo.
