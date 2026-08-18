---
name: sketch-findings-kanban-para-aluguel
description: Validated design decisions, CSS patterns, and visual direction from sketch experiments. Auto-loaded during UI implementation on kanban-para-aluguel.
---

<context>
## Project: Kanban Aluguel

Extensão da aba Financeiro (Phases 5/6, já em produção) com uma camada de consulta/filtros inspirada em ERPs profissionais (referência: Sienge — telas de "Consulta de parcelas"), mantendo o design system já aprovado do app (tokens reais de `web/src/app/globals.css`, não um sistema visual novo).

Sketch sessions wrapped: 2026-08-18
</context>

<design_direction>
## Overall Direction

Trocar o "mostra tudo de cara" (seletor Mês atual/Próximo mês da Phase 5) por uma visão padrão enxuta ("Vencendo hoje") com um painel de filtro colapsável atrás de um botão — não uma barra de filtro sempre visível. Zero token novo de cor, tipografia ou espaçamento: tudo reusa o que já está em produção. A única peça visual nova é a pílula de ID sequencial do contrato.
</design_direction>

<findings_index>
## Design Areas

| Area | Reference | Key Decision |
|------|-----------|--------------|
| Consulta e Filtros Financeiro | `references/consulta-e-filtros-financeiro.md` | Filtros atrás de um botão (variante B); padrão "Vencendo hoje" substitui o seletor de mês; 4 campos opcionais em AND lógico; nova pílula de ID |

## Theme

O tema vencedor está em `sources/themes/default.css` — espelha 1:1 `web/src/app/globals.css`, não introduz nada novo.

## Source Files

O sketch original (com as duas variantes, A rejeitada e B vencedora, interativo) está preservado em `sources/001-consulta-financeiro/index.html`.
</findings_index>

<metadata>
## Processed Sketches

- 001-consulta-financeiro
</metadata>
