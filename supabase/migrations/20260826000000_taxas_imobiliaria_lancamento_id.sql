-- ============================================================
-- Ligação taxa <-> lançamento — Kanban Aluguel (Phase 14)
--
-- Adiciona a public.taxas_imobiliaria uma coluna nova,
-- lancamento_id, FK para public.parcela_lancamentos(id) com
-- "on delete cascade", mais um índice sobre ela. Nada mais.
--
-- ESTRITAMENTE ADITIVA. O app está em produção no Vercel +
-- Supabase com ~46 imóveis reais e nenhum ambiente de staging.
-- Nada aqui apaga coluna, apaga tabela, renomeia ou troca tipo de
-- coluna existente, e nenhuma FK existente muda de "on delete
-- cascade" para outra coisa — só nasce uma coluna nova (nullable,
-- sem default) e um índice novo.
--
-- Também é REEXECUTÁVEL: o "add column" usa "if not exists" e o
-- "create index" usa "if not exists" — rodar esta migração uma
-- segunda vez não erra e não muda nada.
--
-- Alvo real: produção, sem staging.
--
-- Runbook operacional que ensaia e prova estas regras contra o
-- banco real, com ensaio em transação revertida e verificação
-- pós-push: supabase/verificacao_taxas_imobiliaria_lancamento_id.sql
-- ============================================================


-- ------------------------------------------------------------
-- Comentário-guarda obrigatório (Pitfall 1, 14-RESEARCH.md)
--
-- D-03 (14-CONTEXT.md) reabre PONTUALMENTE o isolamento
-- estrutural descrito em 20260824000000_dinheiro_imobiliaria.sql
-- (linhas 89-96, D-04, 13-CONTEXT.md) — esta coluna existe SÓ
-- para "on delete cascade" (limpar a taxa quando o pagamento que
-- a gerou é cancelado, CANIMOB-03), NUNCA para join de cálculo de
-- status. somarLancamentos/statusDeParcela
-- (web/src/lib/kanban/parcelas.ts) continuam nunca lendo
-- taxas_imobiliaria; nenhuma escrita nesta tabela aciona
-- recalcularEGravarStatus.
--
-- Se algum dia esta coluna parecer útil para "juntar" as duas
-- tabelas num cálculo de valor/status, isso é o sinal de que D-04
-- está sendo violado — pare e releia 13-CONTEXT.md e 14-CONTEXT.md
-- antes de prosseguir.
-- ------------------------------------------------------------

alter table public.taxas_imobiliaria
  add column if not exists lancamento_id uuid
    references public.parcela_lancamentos(id) on delete cascade;

-- Nullable, sem default, sem backfill (mesmo padrão de
-- cards.arquivado_em, docs/data-model.md) — linhas de taxa
-- geradas antes desta fase (inclusive as de teste da Phase 13)
-- ficam com lancamento_id nulo para sempre; não há como inferir
-- retroativamente qual pagamento gerou qual taxa quando uma
-- parcela paga em partes acumulou mais de uma (D-03, 14-CONTEXT.md).

create index if not exists taxas_imobiliaria_lancamento_id_idx
  on public.taxas_imobiliaria (lancamento_id);

-- Mesmo padrão dos outros dois índices já existentes nesta tabela
-- (taxas_imobiliaria_card_id_idx, taxas_imobiliaria_parcela_id_idx).


-- ------------------------------------------------------------
-- RLS — nenhuma linha de policy nesta migração.
--
-- A policy "team full access taxas_imobiliaria" (já existente
-- desde 20260824000000_dinheiro_imobiliaria.sql) usa "for all",
-- que já cobre a coluna nova automaticamente — mesma tabela,
-- mesma policy, nenhum predicado novo a declarar.
-- ------------------------------------------------------------
