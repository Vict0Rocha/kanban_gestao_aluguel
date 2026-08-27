-- ============================================================
-- Relaxar exclusão de card com destrava — Kanban Aluguel (Phase 15)
--
-- Muda o predicado de public.impedir_exclusao_de_card_com_
-- lancamento() para parar de contar um lançamento
-- parcela_lancamentos.tipo = 'destrava' como impeditivo da exclusão
-- do card (CANDEST-01, D-01/D-03 de 15-CONTEXT.md). Um card cujo
-- único histórico financeiro é um ou mais registros de destrava
-- passa a poder ser excluído; um card com pagamento, acréscimo ou
-- desconto real (ou taxa da imobiliária, ou evento de caução)
-- continua bloqueado exatamente como hoje.
--
-- ESTA MIGRAÇÃO É ESTRITAMENTE ADITIVA. O app está em produção no
-- Vercel + Supabase com ~46 imóveis reais e nenhum ambiente de
-- staging. Nada aqui apaga coluna, apaga tabela, renomeia ou troca
-- tipo de coluna existente, nenhuma FK muda de "on delete cascade"
-- para outra coisa, e nenhuma policy de RLS é criada ou derrubada —
-- só o corpo de uma função de trigger já existente muda, via
-- "create or replace function".
--
-- Também é REEXECUTÁVEL: "create or replace function" é idempotente
-- por natureza — rodar esta migração uma segunda vez não erra e não
-- muda nada além do que já mudou da primeira vez.
--
-- Runbook operacional que ensaia e prova esta mudança contra o banco
-- real, com ensaio em transação revertida e verificação pós-push:
-- supabase/verificacao_relaxar_exclusao_destrava.sql
-- ============================================================


-- ------------------------------------------------------------
-- Comentário-guarda — esta migração reabre PONTUALMENTE D-14
-- (06.2-CONTEXT.md: "qualquer lançamento de qualquer tipo trava a
-- exclusão"), autorizada por D-01/D-03 de 15-CONTEXT.md. A exceção é
-- estreita e deliberada: 'destrava' nunca soma valor (D-01 de
-- 12-CONTEXT.md já o excluiu do cancelamento de lançamentos por essa
-- mesma razão — é um registro de auditoria de que uma parcela foi
-- destravada, não dinheiro se movendo) — logo não há perda de rastro
-- financeiro em permitir a exclusão do card quando ele é o único
-- histórico existente.
--
-- public.taxas_imobiliaria e public.caucao_eventos NÃO têm coluna
-- `tipo` equivalente a 'destrava' — cada linha dessas duas tabelas JÁ
-- É, por definição, dinheiro de verdade (uma taxa cobrada ou um
-- evento de caução). Os dois `exists` que as checam continuam
-- byte-a-byte como estão hoje, sem nenhum filtro de tipo. Só o
-- `exists` sobre public.parcela_lancamentos ganha o filtro
-- `pl.tipo in ('pagamento', 'acrescimo', 'desconto')` — a mesma
-- trinca que já representa dinheiro de verdade em
-- cancelarLancamentoAction (Phase 11/12,
-- web/src/lib/kanban/actions.ts).
--
-- Se algum dia parecer útil remover também o filtro dos outros dois
-- `exists` (taxas_imobiliaria/caucao_eventos), isso é o sinal de que
-- D-01/D-03 (15-CONTEXT.md) está sendo mal-entendido — taxa e caução
-- continuam sendo dinheiro de verdade, nunca um registro de
-- auditoria como destrava.
-- ------------------------------------------------------------

create or replace function public.impedir_exclusao_de_card_com_lancamento()
returns trigger
language plpgsql
set search_path = ''
-- security invoker continua implícito (o default do Postgres), pela
-- mesma razão já documentada nas duas versões anteriores desta
-- função (Phase 6.2, Phase 13): o modificador oposto (definer,
-- deliberadamente não escrito aqui) vazaria "existe lançamento/taxa/
-- caução" para quem não pode nem ver o card que está tentando
-- apagar. Com security invoker, quem não é public.is_team_member()
-- não consegue nem ver o card para apagar — o trigger nunca chega a
-- rodar para essa pessoa.
--
-- set search_path = '' exige nomes de tabela totalmente qualificados
-- no corpo abaixo (public.parcela_lancamentos, não
-- parcela_lancamentos) — mesma blindagem contra schema malicioso no
-- path já usada nas duas versões anteriores desta função.
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
    -- O raise exception continua sem SQLSTATE customizado (ainda o
    -- único do schema, P0001) — deleteCardAction/deleteColumnAction
    -- (web/src/lib/kanban/actions.ts) não precisam de nenhuma mudança
    -- de mapeamento por causa deste relaxamento; só a
    -- cardTemLancamento() do lado do app precisa ser ampliada
    -- (plano 15-06, depois desta migração estar de verdade em
    -- produção) para o pré-voo do diálogo continuar coerente com o
    -- que o banco de fato recusa.
    raise exception 'Contrato com lançamento financeiro registrado não pode ser excluído. Arquive o contrato em vez de excluir.';
  end if;

  return old;
end;
$$;

-- O trigger cards_impede_exclusao_com_lancamento em si (before delete
-- on public.cards for each row) NÃO é recriado por esta migração —
-- ele já aponta para esta função por nome
-- (20260819000000_cards_arquivado_em.sql), e "create or replace
-- function" troca só o corpo da função sem tocar o trigger. Nenhuma
-- instrução DDL de trigger (nem para criar, nem para derrubar)
-- aparece neste arquivo.


-- ------------------------------------------------------------
-- RLS — nenhuma linha de policy nesta migração.
--
-- public.impedir_exclusao_de_card_com_lancamento() é uma função de
-- trigger, não uma tabela — não tem (e nunca teve) policy própria.
-- Nenhuma tabela existente (public.cards, public.parcelas,
-- public.parcela_lancamentos, public.taxas_imobiliaria,
-- public.caucao_eventos) muda de RLS por esta migração; nenhuma
-- policy é criada nem derrubada.
-- ------------------------------------------------------------
