# Phase 17: Exclusão de coluna sem cascade para cards ativos - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-27
**Phase:** 17-exclusão-de-coluna-sem-cascade-para-cards-ativos
**Areas discussed:** Mecanismo, Sem outra coluna

---

## Mecanismo

| Option | Description | Selected |
|--------|-------------|----------|
| O diálogo de excluir já oferece pra onde mover (Recomendado) | Em vez do aviso atual, aparece um seletor de coluna de destino (mesmo padrão do Reordenar) — escolhe, confirma, move e exclui numa ação só | ✓ |
| Só bloquear — usuário move manualmente antes | Botão de excluir desabilitado/recusado enquanto a coluna tiver qualquer card; usuário arrasta um por um antes | |

**User's choice:** O diálogo já oferece pra onde mover
**Notes:** Achado real durante a verificação da Phase 16 — o diálogo atual já avisa explicitamente "Os N imóveis dessa coluna também serão excluídos", um comportamento deliberado desde o schema inicial do projeto, não um bug escondido.

## Sem outra coluna

| Option | Description | Selected |
|--------|-------------|----------|
| Bloquear com mensagem clara (Recomendado) | "Crie outra coluna antes de excluir esta" — nunca deixa o board sem nenhuma coluna enquanto ainda tem card | ✓ |
| Permitir excluir mesmo assim, cards ficam sem coluna | column_id nulo, mas card não está arquivado — ficaria invisível no Board | |

**User's choice:** Bloquear com mensagem clara

---

## Claude's Discretion

- Reusar `reordenarCardsAction` diretamente vs. uma Server Action nova que combina mover+excluir
- Copy exato do diálogo
- Janela de corrida entre mover os cards e excluir a coluna (tolerância já estabelecida no projeto para casos equivalentes)

## Deferred Ideas

None — discussão ficou dentro do escopo da fase.
