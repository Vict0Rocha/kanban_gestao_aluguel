# Phase 11: Cancelamento de pagamento - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-21
**Phase:** 11-cancelamento-de-pagamento
**Areas discussed:** Apagar vs. lançar um estorno, O que exatamente é cancelado, Confirmação e motivo, Onde o botão aparece

---

## Apagar vs. lançar um estorno

| Option | Description | Selected |
|--------|-------------|----------|
| Lançar um estorno | Lançamento novo tipo 'estorno' que anula o pagamento no cálculo — histórico original preservado, precisa de migração | |
| Apagar a linha de verdade | Remove o lançamento do banco, como se nunca tivesse existido — sem migração, mas perde o histórico | ✓ |

**User's choice:** Apagar a linha de verdade — contra minha recomendação.
**Notes:** Apontei explicitamente o trade-off (perda de rastro de quem pagou/cancelou/quando, quebra do padrão append-only que o resto do sistema segue desde a Phase 4, mais visível em Destravar) antes da pergunta. Usuário confirmou apagar mesmo assim.

---

## O que exatamente é cancelado

| Option | Description | Selected |
|--------|-------------|----------|
| Cada lançamento tem seu próprio cancelar | Botão ao lado de cada lançamento tipo='pagamento' no histórico, apaga só aquele | ✓ |
| Um botão cancela tudo | Um único botão apaga todos os pagamentos da parcela de uma vez | |

**User's choice:** Cada lançamento tem seu próprio cancelar (opção recomendada).
**Notes:** Nenhuma ressalva adicional.

---

## Confirmação e motivo

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmação simples, sem motivo | Diálogo de confirmação mostrando o valor, sem campo de motivo obrigatório | ✓ |
| Motivo obrigatório, como Destravar | Exige digitar por que está cancelando | |

**User's choice:** Confirmação simples, sem motivo (opção recomendada).
**Notes:** Nenhuma ressalva adicional.

---

## Onde o botão aparece

| Option | Description | Selected |
|--------|-------------|----------|
| Dentro do histórico de lançamentos | Ao lado de cada lançamento específico no ParcelaHistoricoSheet | ✓ |
| Botão na linha da tabela do Financeiro | Ao lado de Pagamento/Ajustar/Conciliar | |

**User's choice:** Dentro do histórico de lançamentos (opção recomendada).
**Notes:** Nenhuma ressalva adicional.

---

## Claude's Discretion

- Escopo de quais parcelas mostram o botão: qualquer lançamento tipo='pagamento' existente, independente da parcela estar `paga` ou `parcial` no momento — não restrito só a `paga`.
- Race safety da Server Action nova (reconsultar status + existência do lançamento no momento do DELETE).
- Cópia exata do botão/diálogo e ícone — fica para a UI-SPEC.
- Atualização de `docs/data-model.md` citando esta como a segunda exceção ao princípio append-only (a primeira foi a poda de parcelas órfãs da Phase 9, mas em `parcelas`, não em `parcela_lancamentos`).

## Deferred Ideas

- Cancelar lançamentos de ajuste (acrescimo/desconto) — não pedido, só "pagamento" foi mencionado pelo usuário.
- Rastrear dinheiro recebido pela imobiliária — já registrado em `10-CONTEXT.md` § Deferred.
