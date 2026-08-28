# Phase 21: Redesenho do modelo de PDF dos relatórios financeiros - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-28
**Phase:** 21-redesenho-do-modelo-de-pdf-dos-relat-rios-financeiros
**Areas discussed:** Escopo (um ou dois PDFs), Paleta de cores, Bordas da lista, Linha de Total, Blocos estruturais, Zebra

---

## Escopo

**User's free-text request:** pediu o redesenho "para os PDF gerados" (plural), com detalhe de colunas específico só para Dinheiro da imobiliária.

| Option | Description | Selected |
|--------|-------------|----------|
| Os dois PDFs | Relatório Financeiro dedicado e Dinheiro da imobiliária ganham o mesmo visual, cada um mantendo suas colunas | ✓ |
| Só Dinheiro da imobiliária | Relatório Financeiro continua como está | |

**User's choice:** Os dois PDFs (Recomendado)

---

## Paleta de cores

**Claude's proposal:** texto `#262626`, fundo cabeçalho/total `#f2f2f2`, bordas `#d9d9d9`, zero cor viva.

**User's choice:** "Sim, essa direção funciona (Recomendado)"

---

## Bordas da lista (duas rodadas — usuário mudou de ideia)

**Primeira pergunta:**

| Option | Description | Selected (1ª rodada) |
|--------|-------------|----------------------|
| Grade completa em toda célula | Bordas em volta de cada célula, igual ao print | ✓ (inicial) |
| Só linha embaixo de cada linha | Sem borda vertical, só horizontal | |

**Segunda pergunta (zebra), resposta trouxe a mudança:** "Alternar branco/cinza clarinho (zebra). Porém eu mudei de ideia não precisa de grade completa, somente uma linha sutil separando cada movimento."

**Confirmação final:** linha horizontal sutil (sem borda vertical) + zebra (branco/cinza claro alternando). Confirmado explicitamente numa pergunta de fechamento.

---

## Linha de Total

| Option | Description | Selected |
|--------|-------------|----------|
| Uma linha "Total" no final, somando Valor | Última linha, negrito, fundo cinza igual ao cabeçalho, respeitando os filtros aplicados | ✓ |
| Descrever diferente | — | |

**User's choice:** Uma linha "Total" no final, somando a coluna Valor (Recomendado)

---

## Blocos estruturais

| Option | Description | Selected |
|--------|-------------|----------|
| Mantém os 3, só troca o visual | Título, filtros aplicados e totais continuam, só mudam de cor | ✓ |
| Simplificar/cortar algum bloco | — | |

**User's choice:** Mantém os 3, só troca o visual (Recomendado)

---

## Claude's Discretion

- Tom exato do cinza de texto mudo.
- Tamanhos de fonte/margens exatos para a versão paisagem.
- Mecanismo exato do `jspdf-autotable` para produzir o estilo final (linha horizontal sutil, sem grade vertical, zebra).
- Onde documentar o novo contrato de layout (`10-UI-SPEC.md` atualizado in-place vs. novo documento).

## Deferred Ideas

Nenhuma — a discussão ficou dentro do escopo da fase.
