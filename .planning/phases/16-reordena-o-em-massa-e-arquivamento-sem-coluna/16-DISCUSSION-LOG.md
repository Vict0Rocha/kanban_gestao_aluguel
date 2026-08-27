# Phase 16: Reordenação em massa e arquivamento sem coluna - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-27
**Phase:** 16-reordenação-em-massa-e-arquivamento-sem-coluna
**Areas discussed:** Arquivar sem coluna, Qual é a 1ª coluna, Escopo do reordenar, Confirmação extra

---

## Arquivar sem coluna

| Option | Description | Selected |
|--------|-------------|----------|
| Desvincular de verdade no banco (Recomendado) | `column_id` vira nulo ao arquivar (migração de banco); ao desarquivar, sempre recebe a primeira coluna. Fecha o risco de exclusão silenciosa encontrado no código | ✓ |
| Só mudar o comportamento de desarquivar | `column_id` continua sempre preenchido, só o desarquivar sobrescreve para a primeira coluna. Mais simples, mas mantém o risco de exclusão silenciosa | |

**User's choice:** Desvincular de verdade no banco
**Notes:** Motivado por um achado real durante a discussão: hoje excluir uma coluna com um card arquivado (sem histórico financeiro) apontando pra ela apaga esse card em cascata, sem aviso — porque a trava de exclusão só bloqueia com lançamento financeiro real.

## Qual é a 1ª coluna

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, a mais à esquerda (Recomendado) | A coluna com a menor `position` no board | ✓ |
| Outra definição | — | |

**User's choice:** A mais à esquerda (menor `position`)

---

## Escopo do reordenar

| Option | Description | Selected |
|--------|-------------|----------|
| Todos, sempre (Recomendado) | Ignora a busca — move literalmente todos os cards | |
| Só os que estão em destaque na busca | Se houver busca ativa, só move os que batem com ela | Parcial — ver notes |

**User's choice (texto livre):** "Caso tenha alguma busca ativa, move somente os que estão em destaque na busca. Caso não tenha nenhuma busca, move todos os cards por padrão."
**Notes:** Nem uma opção nem outra sozinha — comportamento condicional. Resolvido tecnicamente sem branch extra: `matchingIds(columns, query)` já devolve "todos" quando a busca está vazia (comportamento existente, documentado em `board.tsx`).

---

## Confirmação extra

| Option | Description | Selected |
|--------|-------------|----------|
| Só o popup já basta (Recomendado) | Escolher a coluna + confirmar no mesmo popup | ✓ |
| Quero uma confirmação extra | Um segundo aviso "Isso vai mover N cards, confirma?" | |

**User's choice:** Só o popup já basta

---

## Claude's Discretion

- Se o board não tiver nenhuma coluna ao desarquivar: bloquear com mensagem clara, em vez de desarquivar com `column_id` nulo (evita card ativo invisível no Board)
- Ordem dos cards na coluna de destino depois do bulk move — sugestão: preservar ordem visual atual, posições novas sequenciais
- Desenho visual do popup (Dialog do design system já existente)
- Nome exato da Server Action nova
- Uma query em lote vs. N updates individuais (sem impacto observável)

## Deferred Ideas

None — discussão ficou dentro do escopo da fase.
