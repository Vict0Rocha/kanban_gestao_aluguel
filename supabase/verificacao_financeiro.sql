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

create table if not exists public.parcela_lancamentos (
  id uuid primary key default gen_random_uuid(),
  parcela_id uuid not null references public.parcelas(id) on delete cascade,
  tipo text not null,
  valor numeric(12,2) not null default 0,
  data date not null default current_date,
  observacao text,
  motivo text,
  criado_por uuid references public.profiles(id),
  criado_em timestamptz not null default now()
);

alter table public.parcela_lancamentos drop constraint if exists parcela_lancamentos_tipo_valido;
alter table public.parcela_lancamentos drop constraint if exists parcela_lancamentos_valor_nao_negativo;
alter table public.parcela_lancamentos drop constraint if exists parcela_lancamentos_valor_exigido;
alter table public.parcela_lancamentos drop constraint if exists parcela_lancamentos_destrava_exige_motivo;
alter table public.parcela_lancamentos drop constraint if exists parcela_lancamentos_motivo_tamanho;
alter table public.parcela_lancamentos drop constraint if exists parcela_lancamentos_observacao_tamanho;

alter table public.parcela_lancamentos
  add constraint parcela_lancamentos_tipo_valido
    check (tipo in ('pagamento', 'acrescimo', 'desconto', 'destrava')),
  add constraint parcela_lancamentos_valor_nao_negativo
    check (valor >= 0 and valor < 10000000),
  add constraint parcela_lancamentos_valor_exigido
    check (tipo = 'destrava' or valor > 0),
  add constraint parcela_lancamentos_destrava_exige_motivo
    check (tipo <> 'destrava' or (motivo is not null and length(btrim(motivo)) >= 1)),
  add constraint parcela_lancamentos_motivo_tamanho
    check (motivo is null or length(motivo) <= 500),
  add constraint parcela_lancamentos_observacao_tamanho
    check (observacao is null or length(observacao) <= 2000);

create index if not exists parcela_lancamentos_parcela_id_idx
  on public.parcela_lancamentos (parcela_id);

alter table public.parcela_lancamentos enable row level security;
drop policy if exists "team full access parcela_lancamentos" on public.parcela_lancamentos;
create policy "team full access parcela_lancamentos"
  on public.parcela_lancamentos for all to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

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

create table if not exists public.parcela_lancamentos (
  id uuid primary key default gen_random_uuid(),
  parcela_id uuid not null references public.parcelas(id) on delete cascade,
  tipo text not null,
  valor numeric(12,2) not null default 0,
  data date not null default current_date,
  observacao text,
  motivo text,
  criado_por uuid references public.profiles(id),
  criado_em timestamptz not null default now()
);

alter table public.parcela_lancamentos drop constraint if exists parcela_lancamentos_tipo_valido;
alter table public.parcela_lancamentos drop constraint if exists parcela_lancamentos_valor_nao_negativo;
alter table public.parcela_lancamentos drop constraint if exists parcela_lancamentos_valor_exigido;
alter table public.parcela_lancamentos drop constraint if exists parcela_lancamentos_destrava_exige_motivo;
alter table public.parcela_lancamentos drop constraint if exists parcela_lancamentos_motivo_tamanho;
alter table public.parcela_lancamentos drop constraint if exists parcela_lancamentos_observacao_tamanho;

alter table public.parcela_lancamentos
  add constraint parcela_lancamentos_tipo_valido
    check (tipo in ('pagamento', 'acrescimo', 'desconto', 'destrava')),
  add constraint parcela_lancamentos_valor_nao_negativo
    check (valor >= 0 and valor < 10000000),
  add constraint parcela_lancamentos_valor_exigido
    check (tipo = 'destrava' or valor > 0),
  add constraint parcela_lancamentos_destrava_exige_motivo
    check (tipo <> 'destrava' or (motivo is not null and length(btrim(motivo)) >= 1)),
  add constraint parcela_lancamentos_motivo_tamanho
    check (motivo is null or length(motivo) <= 500),
  add constraint parcela_lancamentos_observacao_tamanho
    check (observacao is null or length(observacao) <= 2000);

create index if not exists parcela_lancamentos_parcela_id_idx
  on public.parcela_lancamentos (parcela_id);

alter table public.parcela_lancamentos enable row level security;
drop policy if exists "team full access parcela_lancamentos" on public.parcela_lancamentos;
create policy "team full access parcela_lancamentos"
  on public.parcela_lancamentos for all to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

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

  -- guarda o id numa GUC para os BLOCOS 6/7 (RLS): depois da troca
  -- de papel para "authenticated" com claims de intruso, um SELECT
  -- direto nesta parcela seria filtrado pelo próprio RLS que os
  -- blocos estão tentando provar
  perform set_config('app.parcela_teste', v_parcela_id::text, true);

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


-- ============================================================
-- BLOCO 4 — REGRAS DE `parcela_lancamentos` (mesma transação —
-- não rode `begin;` de novo)
--
-- Insere uma parcela de apoio, prova o caminho feliz (pagamento
-- válido, destrava com motivo preenchido) e testa, uma a uma, que
-- cada regra proibida é recusada pelo banco.
-- ============================================================

do $$
declare
  v_card_id uuid;
  v_parcela_id uuid;
begin
  v_card_id := current_setting('app.card_teste')::uuid;

  -- parcela de apoio para os lançamentos deste bloco
  insert into public.parcelas (card_id, competencia, vencimento, valor_original)
  values (v_card_id, (date_trunc('month', current_date) + interval '5 months')::date, current_date, 1500.00)
  returning id into v_parcela_id;

  -- caminho feliz: pagamento válido
  insert into public.parcela_lancamentos (parcela_id, tipo, valor)
  values (v_parcela_id, 'pagamento', 500.00);

  -- caminho feliz: destrava com motivo preenchido
  insert into public.parcela_lancamentos (parcela_id, tipo, valor, motivo)
  values (v_parcela_id, 'destrava', 0, 'correção de teste do ensaio');

  -- ---- tipo fora do conjunto permitido -----------------------------
  begin
    insert into public.parcela_lancamentos (parcela_id, tipo, valor)
    values (v_parcela_id, 'estorno', 100.00);
    raise exception 'FALHOU: parcela_lancamentos_tipo_valido deveria ter recusado tipo estorno';
  exception when check_violation then
    raise notice 'OK recusado: parcela_lancamentos_tipo_valido';
  end;

  -- ---- valor negativo num pagamento ----------------------------------
  begin
    insert into public.parcela_lancamentos (parcela_id, tipo, valor)
    values (v_parcela_id, 'pagamento', -50.00);
    raise exception 'FALHOU: parcela_lancamentos_valor_nao_negativo deveria ter recusado valor negativo';
  exception when check_violation then
    raise notice 'OK recusado: parcela_lancamentos_valor_nao_negativo';
  end;

  -- ---- valor zero num pagamento ----------------------------------------
  begin
    insert into public.parcela_lancamentos (parcela_id, tipo, valor)
    values (v_parcela_id, 'pagamento', 0);
    raise exception 'FALHOU: parcela_lancamentos_valor_exigido deveria ter recusado pagamento de valor 0';
  exception when check_violation then
    raise notice 'OK recusado: parcela_lancamentos_valor_exigido';
  end;

  -- ---- destrava com motivo nulo -------------------------------------------
  begin
    insert into public.parcela_lancamentos (parcela_id, tipo, valor, motivo)
    values (v_parcela_id, 'destrava', 0, null);
    raise exception 'FALHOU: parcela_lancamentos_destrava_exige_motivo deveria ter recusado motivo nulo';
  exception when check_violation then
    raise notice 'OK recusado: parcela_lancamentos_destrava_exige_motivo (nulo)';
  end;

  -- ---- destrava com motivo só espaços --------------------------------------
  begin
    insert into public.parcela_lancamentos (parcela_id, tipo, valor, motivo)
    values (v_parcela_id, 'destrava', 0, '   ');
    raise exception 'FALHOU: parcela_lancamentos_destrava_exige_motivo deveria ter recusado motivo em branco';
  exception when check_violation then
    raise notice 'OK recusado: parcela_lancamentos_destrava_exige_motivo (em branco)';
  end;

end $$;


-- ============================================================
-- BLOCO 5 — PRIVILÉGIOS DE TABELA (mesma transação do BLOCO 2 —
-- não rode `begin;` de novo)
--
-- "permission denied for table" e "new row violates row-level
-- security policy" compartilham o mesmo SQLSTATE 42501. Sem
-- confirmar que o papel authenticated tem os grants nas tabelas
-- novas, um count(*) = 0 no BLOCO 6 poderia ser falta de
-- permissão em vez de RLS funcionando.
--
-- Se este SELECT vier vazio, falta acrescentar ao arquivo de
-- migração:
--   grant select, insert, update, delete on public.parcelas to authenticated;
--   grant select, insert, update, delete on public.parcela_lancamentos to authenticated;
-- (registrando o desvio em comentário — cards, columns etc.
-- dependem do default privileges do Supabase e não declaram
-- grants explícitos, então a ausência aqui seria uma surpresa).
-- ============================================================

select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('parcelas', 'parcela_lancamentos')
  and grantee = 'authenticated'
order by table_name, privilege_type;


-- ============================================================
-- BLOCO 6 — RLS NEGATIVA (mesma transação — não rode `begin;`
-- de novo)
--
-- Simula alguém autenticado no Supabase mas ausente de
-- public.allowed_members. Para este papel, as duas tabelas novas
-- devem se comportar como se estivessem vazias — mesmo com as
-- linhas dos BLOCOS 3 e 4 ainda vivas na transação — e nenhum
-- INSERT deve completar.
-- ============================================================

set local role authenticated;
set local request.jwt.claims to '{"email":"intruso-teste@exemplo.invalid","role":"authenticated"}';

select count(*) from public.parcelas;
-- deve devolver 0

select count(*) from public.parcela_lancamentos;
-- deve devolver 0

do $$
begin
  begin
    insert into public.parcelas (card_id, competencia, vencimento, valor_original)
    values (
      current_setting('app.card_teste')::uuid,
      (date_trunc('month', current_date) + interval '6 months')::date,
      current_date,
      1500.00
    );
    raise exception 'FALHOU: RLS deixou passar insert em parcelas';
  exception when insufficient_privilege then
    raise notice 'OK recusado pelo RLS: insert em parcelas';
  end;

  begin
    insert into public.parcela_lancamentos (parcela_id, tipo, valor)
    values (current_setting('app.parcela_teste')::uuid, 'pagamento', 100.00);
    raise exception 'FALHOU: RLS deixou passar insert em parcela_lancamentos';
  exception when insufficient_privilege then
    raise notice 'OK recusado pelo RLS: insert em parcela_lancamentos';
  end;
end $$;


-- ============================================================
-- BLOCO 7 — RLS POSITIVA, controle (mesma transação — não rode
-- `begin;` de novo)
--
-- Sem este bloco, o BLOCO 6 não prova nada: um count(*) = 0
-- poderia ser falta de grant (BLOCO 5) em vez de RLS funcionando.
-- Este bloco troca para um e-mail real da allowlist e confirma que
-- as mesmas operações que o BLOCO 6 recusou agora completam.
--
-- TROQUE o e-mail abaixo pelo seu, o mesmo cadastrado em
-- public.allowed_members, antes de rodar.
-- ============================================================

reset role;
set local request.jwt.claims to '{"email":"SEU-EMAIL-DA-ALLOWLIST@exemplo.com","role":"authenticated"}';
set local role authenticated;

select count(*) from public.parcelas;
-- deve devolver as linhas inseridas nos BLOCOS 3 e 6 (>= 2)

select count(*) from public.parcela_lancamentos;
-- deve devolver as linhas inseridas no BLOCO 4 (>= 2)

insert into public.parcelas (card_id, competencia, vencimento, valor_original)
values (
  current_setting('app.card_teste')::uuid,
  (date_trunc('month', current_date) + interval '7 months')::date,
  current_date,
  1500.00
);
-- deve completar sem erro — prova positiva de que o papel da
-- allowlist tem acesso de escrita


-- ============================================================
-- Fim da PARTE A. Nada do que rodou acima persiste: o ROLLBACK
-- abaixo desfaz a DDL de teste dos BLOCOS 2-4 e as linhas de prova
-- dos BLOCOS 3, 4, 6 e 7 de uma vez só. Rodar `commit` no lugar
-- deste ROLLBACK gravaria linhas de teste — inclusive a tentativa
-- do "intruso" — no banco de produção.
-- ============================================================

rollback;


-- ============================================================
-- PARTE B — VERIFICAÇÃO PÓS-PUSH
--
-- Blocos independentes. Rodam DEPOIS de `supabase db push` aplicar
-- a migração de verdade — não fazem parte da transação da Parte A
-- acima, cada um pode ser rodado sozinho.
-- ============================================================


-- ============================================================
-- BLOCO 8 — INVENTÁRIO (rode sozinho, não altera nada)
--
-- Esperado: 10 CHECKs (4 em parcelas, 6 em parcela_lancamentos) e
-- 2 policies, ambas citando is_team_member nas duas expressões
-- (qual e with_check).
-- ============================================================

select
  conrelid::regclass        as tabela,
  conname                   as regra,
  pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid in ('public.parcelas'::regclass, 'public.parcela_lancamentos'::regclass)
  and contype = 'c'
order by conrelid::regclass::text, conname;

select
  tablename,
  policyname,
  qual,
  with_check
from pg_policies
where tablename in ('parcelas', 'parcela_lancamentos')
order by tablename, policyname;


-- ============================================================
-- BLOCO 9 — INTEGRIDADE DOS DADOS DE PRODUÇÃO (rode sozinho, só
-- leitura)
--
-- Esperado: cards_total e updated_at_max idênticos aos anotados no
-- BLOCO 1, e sem_ativo igual a 0 — a coluna nova não deixou nenhum
-- card existente sem valor.
-- ============================================================

select
  count(*)                                  as cards_total,
  count(*) filter (where ativo is not true) as sem_ativo,
  max(updated_at)                           as updated_at_max
from public.cards;


-- ============================================================
-- BLOCO 10 — REPETIÇÃO DAS PROVAS CONTRA O SCHEMA REAL
--
-- Reexecuta os harnesses dos BLOCOS 3, 4, 6 e 7 sem a DDL — as
-- tabelas já existem de verdade depois do push. Termina em
-- ROLLBACK: CONFIRA que a última linha antes do BLOCO 11 diz
-- `rollback;`, não `commit;`, antes de rodar este bloco inteiro.
-- ============================================================

begin;

select set_config(
  'app.card_teste',
  (select id::text from public.cards limit 1),
  true
);

do $$
declare
  v_card_id uuid;
  v_parcela_id uuid;
begin
  v_card_id := current_setting('app.card_teste')::uuid;

  if v_card_id is null then
    raise exception 'FALHOU: verificação pós-push precisa de pelo menos um card em public.cards';
  end if;

  -- ---- regras de parcelas (reprova o BLOCO 3) ------------------------

  insert into public.parcelas (card_id, competencia, vencimento, valor_original)
  values (v_card_id, (date_trunc('month', current_date) + interval '11 months')::date, current_date, 1500.00)
  returning id into v_parcela_id;

  perform set_config('app.parcela_teste', v_parcela_id::text, true);

  begin
    insert into public.parcelas (card_id, competencia, vencimento, valor_original)
    values (v_card_id, (date_trunc('month', current_date) + interval '12 months')::date, current_date, -100.00);
    raise exception 'FALHOU: parcelas_valor_original_positivo deveria ter recusado valor negativo';
  exception when check_violation then
    raise notice 'OK recusado: parcelas_valor_original_positivo';
  end;

  begin
    insert into public.parcelas (card_id, competencia, vencimento, valor_original, status)
    values (v_card_id, (date_trunc('month', current_date) + interval '13 months')::date, current_date, 1500.00, 'pendente');
    raise exception 'FALHOU: parcelas_status_valido deveria ter recusado status pendente';
  exception when check_violation then
    raise notice 'OK recusado: parcelas_status_valido';
  end;

  begin
    insert into public.parcelas (card_id, competencia, vencimento, valor_original)
    values (v_card_id, (date_trunc('month', current_date) + interval '14 months' + interval '14 days')::date, current_date, 1500.00);
    raise exception 'FALHOU: parcelas_competencia_dia_1 deveria ter recusado dia 15';
  exception when check_violation then
    raise notice 'OK recusado: parcelas_competencia_dia_1';
  end;

  begin
    insert into public.parcelas (card_id, competencia, vencimento, valor_original, status)
    values (v_card_id, (date_trunc('month', current_date) + interval '15 months')::date, current_date, 1500.00, 'conciliada');
    raise exception 'FALHOU: parcelas_conciliada_rastreada deveria ter recusado conciliada sem rastro';
  exception when check_violation then
    raise notice 'OK recusado: parcelas_conciliada_rastreada';
  end;

  begin
    insert into public.parcelas (card_id, competencia, vencimento, valor_original)
    values (v_card_id, (date_trunc('month', current_date) + interval '11 months')::date, current_date, 999.00);
    raise exception 'FALHOU: parcelas_unica_por_competencia deveria ter recusado duplicata';
  exception when unique_violation then
    raise notice 'OK recusado: parcelas_unica_por_competencia';
  end;

  -- ---- regras de parcela_lancamentos (reprova o BLOCO 4) --------------

  insert into public.parcela_lancamentos (parcela_id, tipo, valor)
  values (v_parcela_id, 'pagamento', 500.00);

  insert into public.parcela_lancamentos (parcela_id, tipo, valor, motivo)
  values (v_parcela_id, 'destrava', 0, 'correção de teste da verificação pós-push');

  begin
    insert into public.parcela_lancamentos (parcela_id, tipo, valor)
    values (v_parcela_id, 'estorno', 100.00);
    raise exception 'FALHOU: parcela_lancamentos_tipo_valido deveria ter recusado tipo estorno';
  exception when check_violation then
    raise notice 'OK recusado: parcela_lancamentos_tipo_valido';
  end;

  begin
    insert into public.parcela_lancamentos (parcela_id, tipo, valor)
    values (v_parcela_id, 'pagamento', -50.00);
    raise exception 'FALHOU: parcela_lancamentos_valor_nao_negativo deveria ter recusado valor negativo';
  exception when check_violation then
    raise notice 'OK recusado: parcela_lancamentos_valor_nao_negativo';
  end;

  begin
    insert into public.parcela_lancamentos (parcela_id, tipo, valor)
    values (v_parcela_id, 'pagamento', 0);
    raise exception 'FALHOU: parcela_lancamentos_valor_exigido deveria ter recusado pagamento de valor 0';
  exception when check_violation then
    raise notice 'OK recusado: parcela_lancamentos_valor_exigido';
  end;

  begin
    insert into public.parcela_lancamentos (parcela_id, tipo, valor, motivo)
    values (v_parcela_id, 'destrava', 0, null);
    raise exception 'FALHOU: parcela_lancamentos_destrava_exige_motivo deveria ter recusado motivo nulo';
  exception when check_violation then
    raise notice 'OK recusado: parcela_lancamentos_destrava_exige_motivo (nulo)';
  end;

  begin
    insert into public.parcela_lancamentos (parcela_id, tipo, valor, motivo)
    values (v_parcela_id, 'destrava', 0, '   ');
    raise exception 'FALHOU: parcela_lancamentos_destrava_exige_motivo deveria ter recusado motivo em branco';
  exception when check_violation then
    raise notice 'OK recusado: parcela_lancamentos_destrava_exige_motivo (em branco)';
  end;
end $$;

-- ---- RLS negativa contra o schema real (reprova o BLOCO 6) ----------

set local role authenticated;
set local request.jwt.claims to '{"email":"intruso-teste@exemplo.invalid","role":"authenticated"}';

select count(*) from public.parcelas;
-- deve devolver 0

select count(*) from public.parcela_lancamentos;
-- deve devolver 0

do $$
begin
  begin
    insert into public.parcelas (card_id, competencia, vencimento, valor_original)
    values (
      current_setting('app.card_teste')::uuid,
      (date_trunc('month', current_date) + interval '16 months')::date,
      current_date,
      1500.00
    );
    raise exception 'FALHOU: RLS deixou passar insert em parcelas';
  exception when insufficient_privilege then
    raise notice 'OK recusado pelo RLS: insert em parcelas';
  end;

  begin
    insert into public.parcela_lancamentos (parcela_id, tipo, valor)
    values (current_setting('app.parcela_teste')::uuid, 'pagamento', 100.00);
    raise exception 'FALHOU: RLS deixou passar insert em parcela_lancamentos';
  exception when insufficient_privilege then
    raise notice 'OK recusado pelo RLS: insert em parcela_lancamentos';
  end;
end $$;

-- ---- RLS positiva contra o schema real, controle (reprova o BLOCO 7) --
-- TROQUE o e-mail abaixo pelo seu, o mesmo cadastrado em
-- public.allowed_members, antes de rodar.

reset role;
set local request.jwt.claims to '{"email":"SEU-EMAIL-DA-ALLOWLIST@exemplo.com","role":"authenticated"}';
set local role authenticated;

select count(*) from public.parcelas;
-- deve devolver as linhas inseridas acima (>= 2)

select count(*) from public.parcela_lancamentos;
-- deve devolver as linhas inseridas acima (>= 2)

-- CONFIRA que a linha abaixo diz `rollback;` antes de rodar todo o
-- BLOCO 10 — nada aqui deve persistir no banco de produção.
rollback;


-- ============================================================
-- BLOCO 11 — ROLLBACK DE EMERGÊNCIA (só se algo der muito errado)
--
-- *** ATENÇÃO: as três linhas dentro deste comentário APAGAM DADO
-- FINANCEIRO REAL. *** Só descomente e rode isto se o push
-- precisar ser revertido NO MESMO DIA, antes de qualquer parcela
-- verdadeira ter sido criada pelo app. Depois disso, apagar estas
-- tabelas apaga histórico de pagamento real de inquilinos.
-- ============================================================

/*
drop table if exists public.parcela_lancamentos;
drop table if exists public.parcelas;
alter table public.cards drop column if exists ativo;
*/
