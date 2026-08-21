# Phase 12: Cancelamento de ajustes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-21
**Phase:** 12-cancelamento-de-ajustes
**Areas discussed:** Escopo (destrava), Diálogo de confirmação

---

## Escopo — destrava também?

| Option | Description | Selected |
|--------|-------------|----------|
| Só acréscimo/desconto | Mesmo escopo pedido por nome; destrava é auditoria, não valor lançado por engano | ✓ |
| Incluir destrava também | Todo lançamento ganha o botão, sem exceção — mas enfraquece CONCIL-04 | |

**User's choice:** Só acréscimo/desconto (recomendado)
**Notes:** O usuário havia dito "tudo que é adicionado para uma parcela precisa ter a opção de excluir" de forma genérica. Ao ser confrontado especificamente com o caso de destrava (registro de auditoria, não um valor lançado por engano, e cuja exclusão enfraqueceria a garantia de CONCIL-04 de que o histórico de destravas fica sempre visível), confirmou que a frase original se referia a pagamento/acréscimo/desconto — não a destrava.

---

## Diálogo de confirmação — generalizar ou duplicar?

| Option | Description | Selected |
|--------|-------------|----------|
| Generalizar num só | Um componente único recebe o tipo e monta o texto certo, reusando `LancamentoTipoLabel` | ✓ |
| Diálogos irmãos separados | Copiar o padrão em dois arquivos novos, um por tipo | |

**User's choice:** Generalizar num só (recomendado)
**Notes:** Nenhuma objeção — o usuário havia pedido "mesma maneira que foi feito para os pagamentos", e generalizar o componente existente é a leitura mais direta disso.

---

## Claude's Discretion

- Nome do componente/Server Action generalizados (manter `cancelarPagamentoAction`/`CancelarPagamentoDialog` ou renomear para algo genérico como `cancelarLancamentoAction`/`CancelarLancamentoDialog`)
- Texto exato de cada variante da confirmação (fica para a UI-SPEC)

## Deferred Ideas

- Cancelar lançamentos `tipo='destrava'` — decidido como fora de escopo nesta discussão, não apenas adiado por falta de tempo
- Rastrear dinheiro recebido pela imobiliária (taxa de administração, primeiro aluguel, caução, taxas de gestão) — já registrado em fases anteriores, ainda não retomado
