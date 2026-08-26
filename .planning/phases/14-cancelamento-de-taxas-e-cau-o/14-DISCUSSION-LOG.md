# Phase 14: Cancelamento de taxas e caução - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-26
**Phase:** 14-cancelamento-de-taxas-e-cau-o
**Areas discussed:** Layout do histórico, Trava conciliada, Cancelar caução, Confirmação, Cascata pagamento→taxa

---

## Layout do histórico

| Option | Description | Selected |
|--------|-------------|----------|
| Lista única, cronológica | Taxa entra na mesma lista, ordenada por data junto com os outros lançamentos — visualmente é só mais um item com seu próprio rótulo (ex.: "Taxa · Administração"). | ✓ |
| Seção separada | Uma segunda lista, abaixo dos lançamentos normais, só com as taxas daquela parcela. Mais parecido com o Sheet de Caução, que é uma tela à parte. | |

**User's choice:** Lista única, cronológica
**Notes:** Nenhuma nota adicional — escolha direta.

---

## Trava conciliada

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, mesma trava (Recomendado) | Parcela conciliada trava qualquer alteração ligada a ela, inclusive a taxa — consistente com CONCIL-02 e com o que já existe para os outros três tipos. | ✓ |
| Não, independente | A taxa é dinheiro da imobiliária, não do proprietário — cancelar não muda nada na parcela (D-04), então não precisaria da mesma trava. | |

**User's choice:** Sim, mesma trava (Recomendado)
**Notes:** Nenhuma nota adicional.

---

## Cancelar caução

| Option | Description | Selected |
|--------|-------------|----------|
| Só o mais recente (Recomendado) | Evita saldo/status incoerente — sempre desfaz o último passo do ciclo, igual "desfazer" em vez de apagar do meio do histórico. | ✓ |
| Qualquer evento | Mais flexível, mas pode gerar um saldo que não bate mais com a leitura de devolvida/usada — precisaria recalcular esse status com mais cuidado. | |

**User's choice:** Só o mais recente (Recomendado)
**Notes:** "Porém deve ser possível excluir tudo o histórico vindo do mais recente." — a trava é sempre "o topo atual", aplicada repetidamente: depois de cancelar o mais recente, o evento que sobra no topo passa a ser cancelável, e assim por diante. Nunca um cancelamento pulando para o meio do histórico. Documentado como D-05 em CONTEXT.md.

---

## Confirmação

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, mesmo diálogo (Recomendado) | Mesma UX já validada em produção (CancelarLancamentoDialog): mostra valor e tipo, confirma, apaga de verdade. Consistência para o usuário que já conhece o padrão. | ✓ |
| Pedir motivo | Diferente do padrão atual — adicionaria fricção que os outros cancelamentos não têm. | |

**User's choice:** Sim, mesmo diálogo (Recomendado)
**Notes:** Nenhuma nota adicional.

---

## Cascata pagamento → taxa

Este ponto não foi apresentado como uma das quatro opções originais — surgiu da análise do código
durante o discuss-phase (achado real: `taxas_imobiliaria` só guarda `parcela_id`, não qual
`parcela_lancamentos.id` a gerou, então cancelar um pagamento hoje deixa a taxa órfã). Levantado como
pergunta de acompanhamento direta, sem múltipla escolha formal.

**Pergunta:** "Fica junto automaticamente" ou a taxa deveria sobreviver ao cancelamento do pagamento
que a gerou?

**User's choice:** "Fica junto automaticamente."
**Notes:** Exige uma coluna nova de ligação em `taxas_imobiliaria` (hoje inexistente) — migração
aditiva. Documentado como D-03 em CONTEXT.md, com D-04 registrando que a taxa também mantém um botão de
cancelamento independente (não só via cascata).

---

## Claude's Discretion

- Nome exato da coluna nova em `taxas_imobiliaria` (ex.: `lancamento_id`) e se tem `on delete cascade`
- Implementação da cascata: DELETE explícito em código vs. constraint do banco
- Componentização exata do rótulo de origem de taxa (promover `TAXA_ORIGEM`/`TaxaOrigemBadge` para um
  arquivo compartilhado)
- Como o botão "Cancelar" do evento mais recente de caução determina "sou eu o mais recente" no
  servidor

## Deferred Ideas

Nenhuma nova — o refinamento mais amplo do relatório de reconciliação continua adiado desde
`13-CONTEXT.md § Deferred`, fora do escopo desta fase.
