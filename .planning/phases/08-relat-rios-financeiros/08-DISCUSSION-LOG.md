# Phase 8: Relatórios financeiros - Discussion Log

**Date:** 2026-08-20

## Round 1

**Question 1 — Localização:** Onde o relatório financeiro deve morar na navegação?

**Options presented:**
- Nova seção dentro de Financeiro (recomendado)
- Dentro de Relatórios (rota atual)
- Rota nova, item novo no menu

**User's answer (verbatim):** "Dentro de relatórios (rota atual) - Adicione um filtro igual do financeiro 'ocultar e aparecer'. Ai nele vamos ter alguns filtros, quero fazer filtros e gerar relatórios de forma avançada e eficiente. Mantenha a pagina de relatórios como já está, só adicione o filtro suspenso, no canto superior esquerdo, em abaixo do texto 'Uma visão geral da carteira para apoiar a decisão do dia'."

**Resolution:** D-01/D-02 em CONTEXT.md — rota `/relatorios` existente, painel colapsável no canto superior esquerdo, abaixo do subtítulo. Página atual intocada.

**Question 2 — Arquivados:** Contratos arquivados/inativos entram nos totais?

**Options presented:**
- Sim, sempre entram (recomendado)
- Não, mesma regra do Financeiro/Board

**User's answer:** Sim, sempre entram (recomendado)

**Resolution:** D-05 em CONTEXT.md — exceção deliberada à regra de visibilidade da Phase 6.2, documentada com destaque no código.

## Round 2 (follow-up para resolver a resposta aberta da pergunta 1)

**Question 1 — Interação:** Filtro atualiza ao vivo ou precisa de botão "Gerar relatório"?

**Options presented:**
- Atualiza na hora (recomendado)
- Botão "Gerar relatório"

**User's answer:** Botão "Gerar relatório"

**Resolution:** D-04 em CONTEXT.md — diferente deliberadamente do padrão ao-vivo do Financeiro.

**Question 2 — Filtro de situação:** Além de imóvel/proprietário/período, filtrar por situação (chips)?

**Options presented:**
- Sim, com chips de situação (recomendado)
- Não, só os três do roadmap

**User's answer:** Sim, com chips de situação (recomendado)

**Resolution:** D-03 em CONTEXT.md — mesmo padrão visual dos chips de status de contrato já existentes em `reports-view.tsx`.

## Claude's Discretion (não perguntado, resolvido por precedente de código)

- Cálculo das quatro categorias e dos totais em dinheiro (D-06/D-07) — reusa `situacaoDaParcela`/`somarLancamentos` já existentes.
- Filtro de período aplica sobre `competencia`, não `vencimento` (D-08) — consistência com o Financeiro.
- Layout exato dos quatro totais e estratégia de query — UI-SPEC/planejamento.

## Deferred Ideas

None — nenhuma ideia de escopo novo (ex: exportação) surgiu; a exclusão de exportação já estava confirmada na spec original e não foi revisitada.
