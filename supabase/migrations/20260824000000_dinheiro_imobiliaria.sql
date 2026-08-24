-- ============================================================
-- Dinheiro da imobiliária — Kanban Aluguel (Phase 13)
--
-- Cria a base de dados do dinheiro que a PRÓPRIA imobiliária
-- recebe (não o proprietário): os dois percentuais configuráveis
-- por contrato em public.cards (administração e comissão do
-- primeiro aluguel), o livro-razão paralelo public.taxas_imobiliaria
-- (uma linha por taxa gerada numa baixa de pagamento) e o histórico
-- append-only public.caucao_eventos (recebido/devolvido/usado).
-- Também amplia o backstop de exclusão já existente
-- (public.impedir_exclusao_de_card_com_lancamento(), criado em
-- 20260819000000_cards_arquivado_em.sql) para também recusar a
-- exclusão de um card com qualquer linha nas duas tabelas novas.
--
-- ESTA MIGRAÇÃO É ESTRITAMENTE ADITIVA. O app está em produção no
-- Vercel + Supabase com ~46 imóveis reais e nenhum ambiente de
-- staging. Nada aqui apaga coluna, apaga tabela, renomeia ou troca
-- tipo de coluna existente, e nenhuma FK muda de "on delete cascade"
-- para outra coisa — só cria colunas novas (com default), tabelas
-- novas, e amplia (via "create or replace") o corpo de uma função
-- de trigger já existente.
--
-- Também é REEXECUTÁVEL: todo "create table"/"add column" usa
-- "if not exists", toda constraint é derrubada com "drop ... if
-- exists" antes de ser recriada, e a função de trigger usa
-- "create or replace function" — rodar esta migração uma segunda
-- vez não erra e não muda nada.
--
-- Runbook operacional que ensaia e prova estas regras contra o
-- banco real, com ensaio em transação revertida e verificação
-- pós-push: supabase/verificacao_dinheiro_imobiliaria.sql
-- ============================================================


-- ------------------------------------------------------------
-- Seção 1 — os dois percentuais em public.cards (D-01/D-02,
-- IMOB-01)
--
-- Configuráveis por contrato: percentual_administracao (cobrado a
-- partir do segundo mês em diante) e percentual_comissao_primeiro_
-- aluguel (substitui, não soma, o percentual de administração no
-- mês da primeira competência do contrato — D-01). Os defaults
-- 10/50 são literalmente os valores-padrão do negócio (D-01), não
-- um placeholder técnico.
--
-- not null default preenche as ~46 linhas existentes via fast
-- default (Postgres 11+, A-05) sem reescrever a tabela inteira,
-- sem UPDATE de backfill explícito e sem disparar
-- cards_set_updated_at — mesmo padrão já usado por cards.ativo na
-- Phase 4 (20260816000000_financeiro_schema.sql, Seção 1).
-- ------------------------------------------------------------

alter table public.cards
  add column if not exists percentual_administracao numeric(5,2) not null default 10,
  add column if not exists percentual_comissao_primeiro_aluguel numeric(5,2) not null default 50;

-- numeric(5,2) cobre 0.00-100.00 sem margem de sobra desperdiçada:
-- três dígitos inteiros seriam suficientes para 100, mas o quinto
-- dígito de precisão total é a folga padrão já usada neste projeto
-- para colunas de valor (numeric(12,2) em parcelas/lançamentos usa
-- a mesma lógica de "caber confortavelmente", só numa escala maior
-- porque ali o valor é dinheiro, aqui é percentual).

alter table public.cards drop constraint if exists cards_percentual_administracao_valido;
alter table public.cards drop constraint if exists cards_percentual_comissao_valido;

alter table public.cards
  add constraint cards_percentual_administracao_valido
    check (percentual_administracao >= 0 and percentual_administracao <= 100),
  add constraint cards_percentual_comissao_valido
    check (percentual_comissao_primeiro_aluguel >= 0 and percentual_comissao_primeiro_aluguel <= 100);

-- A faixa é 0-100, não um teto mais estreito: D-03 pede
-- flexibilidade explícita para exceções — 0% (a imobiliária abre
-- mão da taxa naquele contrato) e 100% (caso extremo, mas não
-- impossível de negociar) são ambos estados de negócio legítimos,
-- não erro de digitação a bloquear.
--
-- Nenhuma policy nova nem índice novo é necessário aqui: as duas
-- colunas herdam "team full access cards" (20260811000000_security_
-- hardening.sql) automaticamente, e o volume de public.cards
-- (~46 linhas) não justifica índice numa coluna de configuração.


-- ------------------------------------------------------------
-- Seção 2 — public.taxas_imobiliaria: livro-razão paralelo da taxa
-- da imobiliária (D-03/D-04, IMOB-02/IMOB-03)
--
-- Esta tabela é ESTRUTURALMENTE PARALELA a parcela_lancamentos —
-- NENHUMA FK, trigger, view ou coluna liga as duas. O cálculo de
-- valorDevido/valorPago/status de uma parcela (somarLancamentos/
-- statusDeParcela, web/src/lib/kanban/parcelas.ts) nunca lê esta
-- tabela, e nenhuma escrita aqui aciona recalcularEGravarStatus.
-- Se algum dia uma coluna ou índice parecer útil para "juntar" as
-- duas tabelas, isso é o sinal de que D-04 está sendo violado —
-- pare e releia 13-CONTEXT.md antes de prosseguir.
--
-- parcela_id é not null (A-02): a taxa SEMPRE nasce junto com um
-- pagamento (D-03), nunca como ação isolada — sem parcela_id não
-- haveria como ligar a taxa à parcela nem calcular a origem
-- (a regra de D-08/primeiro-aluguel depende de saber a competencia
-- da parcela).
--
-- card_id é denormalizado a partir de parcela_id -> parcelas.
-- card_id (nunca muda depois de gravado, já que uma parcela não
-- troca de contrato) — existe para que o relatório de reconciliação
-- (plano 13-07) e o backstop de exclusão (Seção 4 abaixo) não
-- precisem fazer join com parcelas a cada consulta.
-- ------------------------------------------------------------

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

-- taxas_imobiliaria_valor_nao_negativo usa >= 0 (não > 0, ao
-- contrário de caucao_eventos_valor_positivo abaixo): D-03 permite
-- explicitamente R$ 0,00 como valor legítimo de taxa — "cobre
-- exceções e imprevistos", inclusive o caso em que a imobiliária
-- opta por não cobrar taxa naquele pagamento específico. Isso é uma
-- escolha de negócio registrada, não um lançamento vazio a recusar.

create index if not exists taxas_imobiliaria_card_id_idx
  on public.taxas_imobiliaria (card_id);
create index if not exists taxas_imobiliaria_parcela_id_idx
  on public.taxas_imobiliaria (parcela_id);

-- Livro-razão sempre lido por contrato (relatório de reconciliação,
-- plano 13-07) ou por parcela (nenhuma tela lista isso ainda, mas o
-- índice é barato e simétrico ao de parcela_lancamentos_parcela_id_
-- idx).

alter table public.taxas_imobiliaria enable row level security;
drop policy if exists "team full access taxas_imobiliaria" on public.taxas_imobiliaria;
create policy "team full access taxas_imobiliaria"
  on public.taxas_imobiliaria for all to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- Nenhum outro predicado de autorização entra aqui. auth.role() =
-- 'authenticated' era exatamente o buraco fechado pela migration
-- 20260811000000_security_hardening.sql — reabri-lo numa tabela
-- financeira nova seria pior que nunca ter fechado.


-- ------------------------------------------------------------
-- Seção 3 — public.caucao_eventos: histórico append-only do ciclo
-- de caução (D-06, IMOB-04)
--
-- Cada evento (recebido/devolvido/usado) é uma linha nova — nunca
-- um UPDATE. O saldo do contrato é sempre a soma dos eventos
-- (recebido − devolvido − usado), nunca uma coluna gravada — mesmo
-- princípio de parcelas.valor_pago não existir como coluna
-- (docs/data-model.md § livro-razão append-only). Não existe (e não
-- deve existir) uma coluna editado_em ou qualquer mecanismo de
-- correção in-place aqui.
-- ------------------------------------------------------------

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

-- caucao_eventos_valor_positivo usa > 0 (A-03), diferente de
-- taxas_imobiliaria_valor_nao_negativo (>= 0): um evento de caução
-- SEMPRE representa dinheiro se movendo de verdade — não existe
-- "recebi/devolvi/usei zero de caução" como registro legítimo.
-- Mesma régua já estabelecida por parcela_lancamentos_valor_exigido
-- para pagamento/acréscimo/desconto (valor > 0) versus destrava
-- (valor = 0, evento de estado, não financeiro).

create index if not exists caucao_eventos_card_id_idx
  on public.caucao_eventos (card_id);

alter table public.caucao_eventos enable row level security;
drop policy if exists "team full access caucao_eventos" on public.caucao_eventos;
create policy "team full access caucao_eventos"
  on public.caucao_eventos for all to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- Mesma forma da Seção 2 — nenhum outro predicado de autorização.


-- ------------------------------------------------------------
-- Seção 4 — ampliar o backstop de exclusão (A-04)
--
-- create or replace function sobre o mesmo nome já existente
-- (public.impedir_exclusao_de_card_com_lancamento(), criado em
-- 20260819000000_cards_arquivado_em.sql) — NUNCA create function de
-- novo, NUNCA um segundo trigger. taxas_imobiliaria/caucao_eventos
-- não caíam automaticamente sob o predicado antigo porque são
-- tabelas NOVAS, não um "tipo" novo dentro de parcela_lancamentos —
-- ao contrário de destrava/conciliação, que "entraram de graça" por
-- reusarem parcela_lancamentos. Sem esta ampliação, excluir um
-- contrato que já recebeu uma caução real (dinheiro de verdade
-- guardado pela imobiliária) apagaria esse registro em cascata sem
-- nenhuma trava — o mesmo tipo de risco que motivou a Phase 6.2
-- inteira para parcela_lancamentos.
-- ------------------------------------------------------------

create or replace function public.impedir_exclusao_de_card_com_lancamento()
returns trigger
language plpgsql
set search_path = ''
-- security invoker continua implícito (o default do Postgres), pela
-- mesma razão já documentada na Phase 6.2: "security definer"
-- vazaria "existe lançamento/taxa/caução" para quem não pode nem
-- ver o card que está tentando apagar. Com security invoker, quem
-- não é public.is_team_member() não consegue nem ver o card para
-- apagar — o trigger nunca chega a rodar para essa pessoa.
--
-- set search_path = '' exige nomes de tabela totalmente
-- qualificados no corpo abaixo (public.taxas_imobiliaria, não
-- taxas_imobiliaria) — mesma blindagem contra schema malicioso no
-- path já usada em public.set_updated_at()
-- (20260811010000_security_advisor_fixes.sql) e na versão original
-- desta função.
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
    -- O raise exception continua sem SQLSTATE customizado (ainda o
    -- único do schema, P0001) — deleteCardAction/deleteColumnAction
    -- (web/src/lib/kanban/actions.ts) não precisam de nenhuma
    -- mudança de mapeamento por causa desta ampliação; só a
    -- cardTemLancamento() do lado do app precisa ser ampliada
    -- (plano 13-04) para o pré-voo do diálogo continuar coerente
    -- com o que o banco de fato recusa.
    raise exception 'Contrato com lançamento financeiro registrado não pode ser excluído. Arquive o contrato em vez de excluir.';
  end if;

  return old;
end;
$$;

-- O trigger cards_impede_exclusao_com_lancamento em si (before
-- delete on public.cards for each row) NÃO precisa ser recriado —
-- ele já aponta para esta função por nome
-- (20260819000000_cards_arquivado_em.sql), e create or replace
-- troca o corpo da função sem tocar o trigger. Nenhum create
-- trigger/drop trigger aparece nesta migração.


-- ------------------------------------------------------------
-- Seção 5 — declaração de RLS, bloco de comentário final
--
-- Nenhuma policy de public.cards, public.parcelas ou
-- public.parcela_lancamentos é tocada por esta migração. As duas
-- tabelas novas (taxas_imobiliaria, caucao_eventos) recebem
-- exatamente uma policy cada, via public.is_team_member(), nenhum
-- outro predicado — mesma forma de toda tabela financeira já
-- existente neste projeto (parcelas, parcela_lancamentos).
-- ------------------------------------------------------------
