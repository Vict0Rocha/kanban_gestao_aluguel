-- ============================================================
-- Limpeza pontual de parcelas órfãs — Kanban Aluguel
--
-- Script de limpeza PONTUAL (D-08, Phase 9), não repetível como
-- parte normal do fluxo do sistema. Remove as parcelas órfãs que já
-- existiam em produção ANTES da Phase 9 existir — geradas por
-- edições de período que aconteceram quando o sistema ainda só
-- "escondia" parcela fora do período (D-03, Phase 6.2), nunca
-- apagava de verdade. Confirmadas numa sessão de SQL anterior:
-- ~27 linhas, concentradas em 2 contratos de teste ("A" e "outro").
--
-- Depois de rodado uma vez, a poda síncrona da Phase 9 (plano 09-01,
-- dentro de updateCardAction) passa a apagar toda órfã nova no
-- instante em que ela nasceria — então este script nunca precisa
-- rodar de novo. Não é um runbook de rotina.
--
-- Ao contrário de todo outro runbook deste projeto
-- (verificacao_financeiro.sql, hardening_seguranca.sql,
-- verificacao_cards_arquivado_em.sql), o BLOCO 2 abaixo NÃO termina
-- em `rollback`. A intenção aqui é gravar de verdade, depois de
-- revisão humana do BLOCO 1 — não ensaiar (D-08).
--
-- Vive fora de `supabase/migrations/` de propósito: o operador
-- precisa ver a lista exata antes de qualquer exclusão. Nunca um
-- DELETE disparado direto por uma migração.
--
-- RODE UM BLOCO DE CADA VEZ, na ordem, na MESMA aba do SQL Editor
-- (sem abrir "New query" no meio) — mesmo cuidado documentado em
-- verificacao_cards_arquivado_em.sql contra connection-hopping do
-- pool do Supabase entre abas/sessões diferentes.
-- ============================================================


-- ============================================================
-- BLOCO 1 — PRÉ-VOO (só leitura, não altera nada)
--
-- Rode isto sozinho primeiro. O predicado abaixo é a tradução
-- direta, em SQL, do critério de D-02: pertence a um card, status
-- 'aberta', ZERO lançamento em parcela_lancamentos, E fora do
-- período atual do card (nas duas direções — antes de
-- periodo_inicio ou depois de periodo_fim, D-03 do CONTEXT.md desta
-- fase). Mesma lógica de competenciaNoPeriodo
-- (web/src/lib/kanban/parcelas.ts:156), negada e escrita em SQL
-- puro.
--
-- Confira a lista contra o que já se sabe de uma sessão anterior:
-- ~27 linhas, 2 contratos de teste ("A" e "outro"). Só depois de
-- conferir, decida se segue para o BLOCO 2 — essa decisão é o
-- checkpoint da Task 2 do plano 09-02.
-- ============================================================

select
  p.id,
  c.numero,
  c.endereco,
  p.competencia,
  p.status,
  p.vencimento,
  p.valor_original
from public.parcelas p
join public.cards c on c.id = p.card_id
where p.status = 'aberta'
  and not exists (
    select 1 from public.parcela_lancamentos pl where pl.parcela_id = p.id
  )
  and (
    (c.periodo_inicio is not null and p.competencia < date_trunc('month', c.periodo_inicio)::date)
    or
    (c.periodo_fim is not null and p.competencia > date_trunc('month', c.periodo_fim)::date)
  )
order by c.numero, p.competencia;


-- ============================================================
-- BLOCO 2 — ATENÇÃO: BLOCO DESTRUTIVO.
--
-- Rode só depois de revisar o BLOCO 1 e ter autorização explícita
-- (checkpoint:decision da Task 2 do plano 09-02, opção
-- "aplicar-agora"). Este DELETE não tem `rollback` — comita de
-- verdade contra produção, sem staging, sem backup automático
-- (plano gratuito do Supabase). As linhas apagadas não voltam.
--
-- MESMO predicado do BLOCO 1, palavra por palavra — nenhum drift
-- entre o que foi mostrado e o que é apagado (T-09-06 do
-- threat_model do plano).
-- ============================================================

delete from public.parcelas p
using public.cards c
where c.id = p.card_id
  and p.status = 'aberta'
  and not exists (
    select 1 from public.parcela_lancamentos pl where pl.parcela_id = p.id
  )
  and (
    (c.periodo_inicio is not null and p.competencia < date_trunc('month', c.periodo_inicio)::date)
    or
    (c.periodo_fim is not null and p.competencia > date_trunc('month', c.periodo_fim)::date)
  )
returning p.id, c.numero, p.competencia;


-- ============================================================
-- BLOCO 3 — CONFERÊNCIA PÓS-EXCLUSÃO (só leitura)
--
-- Rode depois do BLOCO 2, na mesma aba. Cole aqui o número de
-- cards_total_parcelas anotado ANTES do BLOCO 2 (ou consulte de
-- outra aba antes de rodar o BLOCO 2, se preferir) e compare com o
-- total abaixo — a diferença deve bater exatamente com o número de
-- linhas que o `returning` do BLOCO 2 devolveu.
-- ============================================================

select count(*) as parcelas_total_depois from public.parcelas;

-- Repetição do select do BLOCO 1 — deve devolver ZERO linhas se a
-- exclusão funcionou (nenhuma órfã do critério de D-02 sobrou).
select
  p.id,
  c.numero,
  c.endereco,
  p.competencia,
  p.status,
  p.vencimento,
  p.valor_original
from public.parcelas p
join public.cards c on c.id = p.card_id
where p.status = 'aberta'
  and not exists (
    select 1 from public.parcela_lancamentos pl where pl.parcela_id = p.id
  )
  and (
    (c.periodo_inicio is not null and p.competencia < date_trunc('month', c.periodo_inicio)::date)
    or
    (c.periodo_fim is not null and p.competencia > date_trunc('month', c.periodo_fim)::date)
  )
order by c.numero, p.competencia;
