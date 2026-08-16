-- ============================================================
-- Fundação do módulo financeiro — Kanban Aluguel
--
-- Cria a base de dados do módulo financeiro: a flag cards.ativo,
-- a tabela parcelas (uma cobrança mensal por contrato) e a tabela
-- parcela_lancamentos (livro-razão append-only de pagamentos,
-- acréscimos, descontos e destravas).
--
-- ESTA MIGRAÇÃO É ESTRITAMENTE ADITIVA. O app está em produção no
-- Vercel + Supabase com ~46 imóveis reais e nenhum ambiente de
-- staging. Nada aqui apaga coluna, apaga tabela, renomeia ou troca
-- tipo de coluna existente — só cria coluna nova (com default) e
-- tabelas novas.
--
-- Também é REEXECUTÁVEL: toda criação usa "if not exists" e toda
-- constraint/policy é derrubada com "if exists" antes de ser
-- recriada, no mesmo padrão de 20260811000000_security_hardening.sql.
--
-- Runbook operacional que prova estas regras, com ensaio em
-- transação e verificação pós-push: supabase/verificacao_financeiro.sql
-- ============================================================


-- ------------------------------------------------------------
-- Seção 1 — cards.ativo: flag manual de contrato ativo
--
-- Controla se o contrato participa da geração automática de
-- parcelas (Phase 5). Default true para não quebrar nenhum dos
-- ~46 imóveis já cadastrados.
-- ------------------------------------------------------------

alter table public.cards
  add column if not exists ativo boolean not null default true;

-- O Postgres 11+ preenche as linhas existentes com o valor default
-- sem reescrever a tabela inteira (fast default) e sem disparar o
-- trigger cards_set_updated_at — por isso não é preciso nenhum
-- UPDATE de backfill separado aqui.


-- ------------------------------------------------------------
-- Seção 2 — parcelas: uma cobrança por contrato por mês de referência
-- ------------------------------------------------------------

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

-- status é text + CHECK, não enum do Postgres: adicionar um valor a
-- um enum exige DDL própria (ALTER TYPE ... ADD VALUE), enquanto o
-- CHECK nomeado abaixo é derrubável/recriável no mesmo padrão já
-- usado em cards. competencia é sempre date (dia 1 do mês de
-- referência, ex: 2026-08-01), nunca uma string "MM/AAAA".


-- ------------------------------------------------------------
-- Seção 3 — constraints de parcelas
-- ------------------------------------------------------------

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

-- parcelas_conciliada_rastreada vai além do piso de "recusar valor
-- inválido": exige que toda parcela travada tenha registrado quem
-- e quando travou. Sem esta constraint seria possível existir uma
-- parcela status='conciliada' sem nenhum rastro de autor — e a
-- Phase 7 (conciliação/destrava) depende dessa garantia existir a
-- nível de banco, não só de Server Action.
--
-- Não existe constraint relacionando vencimento a competencia:
-- aluguel pago adiantado (vencimento no mês anterior à competência)
-- é um arranjo real do negócio. Uma regra de coerência aqui
-- quebraria cenários válidos que a Phase 5 precisa suportar.
-- Decisão deliberada, não esquecimento — não "consertar" depois.


-- ------------------------------------------------------------
-- Seção 4 — índices de parcelas
-- ------------------------------------------------------------

create unique index if not exists parcelas_unica_por_competencia
  on public.parcelas (card_id, competencia);
-- Espelha alerts_unique_per_trigger (20260728000000_init_schema.sql):
-- nunca duas parcelas do mesmo contrato no mesmo mês de referência.

create index if not exists parcelas_vencimento_idx
  on public.parcelas (vencimento);
-- "Vencida" não é armazenado: é derivado na leitura comparando
-- vencimento com a data de hoje (mesmo padrão de
-- web/src/lib/kanban/alerts.ts), e os relatórios da Phase 8
-- filtram por esta coluna.

create index if not exists parcelas_competencia_idx
  on public.parcelas (competencia);
-- As duas visões da aba Financeiro (Phase 5) — "mês atual" e
-- "próximo mês" — são filtros por competencia.

-- Não existe índice separado só em card_id: o índice único acima
-- já tem card_id como prefixo esquerdo e serve as buscas por
-- contrato sem duplicar estrutura. alerts tem os dois índices
-- porque sua chave única inclui uma terceira coluna (type); aqui a
-- ausência é intencional, não esquecimento.


-- ------------------------------------------------------------
-- Seção 5 — RLS de parcelas
-- ------------------------------------------------------------

alter table public.parcelas enable row level security;

drop policy if exists "team full access parcelas" on public.parcelas;

create policy "team full access parcelas"
  on public.parcelas for all to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- Nenhum outro predicado de autorização entra aqui. auth.role() =
-- 'authenticated' era exatamente o buraco fechado pela migration
-- 20260811000000_security_hardening.sql — reabri-lo numa tabela
-- financeira nova seria pior que nunca ter fechado.
--
-- Os grant execute de public.is_team_member() não são tocados
-- aqui: a migration 20260811010000_security_advisor_fixes.sql já
-- os ajustou (revogado de public/anon, mantido em authenticated),
-- e regravá-los poderia reabrir o acesso à função para o papel anon.


-- ------------------------------------------------------------
-- Seção 6 — parcela_lancamentos: livro-razão append-only
--
-- Baixa parcial, acréscimo, desconto e correção pós-conciliação
-- são todos o mesmo INSERT — nunca um UPDATE na parcela. O valor
-- devido e o valor pago de uma parcela são somas dos lançamentos,
-- jamais colunas mutáveis que poderiam divergir do livro-razão.
-- É por isso que não existe (e não deve existir) uma tabela de
-- auditoria paralela: o histórico é o próprio dado.
-- ------------------------------------------------------------

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


-- ------------------------------------------------------------
-- Seção 7 — constraints de parcela_lancamentos
-- ------------------------------------------------------------

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

-- parcela_lancamentos_valor_nao_negativo usa >= 0 (e não > 0, como
-- em parcelas.valor_original) porque um lançamento tipo='destrava'
-- é um evento de estado, não financeiro, e carrega valor 0.
--
-- parcela_lancamentos_valor_exigido vai além do piso do desenho
-- original: um lançamento pagamento/acrescimo/desconto de valor
-- zero não representa nenhum evento financeiro real — é lixo no
-- livro-razão. Só destrava tem permissão de valor 0, e isso já é
-- coberto pela outra constraint.
--
-- parcela_lancamentos_destrava_exige_motivo é a constraint da qual
-- a Phase 7 (conciliação/destrava, CONCIL-03) depende: o motivo
-- obrigatório de um destrava é garantia de banco, não regra de
-- formulário — btrim faz um motivo só com espaços em branco contar
-- como vazio.
--
-- parcela_lancamentos_observacao_tamanho espelha
-- cards_observacoes_tamanho (20260811000000_security_hardening.sql).


-- ------------------------------------------------------------
-- Seção 8 — índice de parcela_lancamentos
-- ------------------------------------------------------------

create index if not exists parcela_lancamentos_parcela_id_idx
  on public.parcela_lancamentos (parcela_id);
-- O livro-razão é sempre lido por parcela (histórico de uma
-- parcela específica); nenhum índice único cobre esta coluna
-- sozinha.


-- ------------------------------------------------------------
-- Seção 9 — RLS de parcela_lancamentos
-- ------------------------------------------------------------

alter table public.parcela_lancamentos enable row level security;

drop policy if exists "team full access parcela_lancamentos" on public.parcela_lancamentos;

create policy "team full access parcela_lancamentos"
  on public.parcela_lancamentos for all to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- Mesma forma da Seção 5 — nenhum outro predicado de autorização.
