# Phase 13: Dinheiro da imobiliária - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-22
**Phase:** 13-dinheiro-da-imobili-ria
**Areas discussed:** Mecânica do negócio (aberta), Regra do primeiro mês, Geração da taxa, Impacto em telas existentes, Retroatividade, Onde ficam os percentuais, Fluxo de baixa, Caução

---

## Mecânica do negócio (pergunta aberta, texto livre)

Não foi uma escolha entre opções — pergunta aberta pedindo para o usuário explicar como taxa de administração, primeiro aluguel, caução e taxas de gestão funcionam na prática, e o que "controlar" deveria significar (só visibilidade, ou também mudar telas existentes).

**Resposta do usuário:** 10% de administração na maioria dos casos (com exceções por cliente), 50% do primeiro aluguel (também com exceções). Caução: quer ciclo completo (recebido/devolvido/usado). Taxas de gestão: raras, sem necessidade de funcionalidade dedicada — usa "Ajustar" existente. O mais importante é prestar contas e bater com o extrato bancário — "deve mudar/acrescentar no que já existe".

---

## Regra do primeiro mês — soma ou substitui?

| Option | Description | Selected |
|--------|-------------|----------|
| Somam (60% no mês 1) | 10% de administração todo mês + 50% de primeiro aluguel só no mês 1 | |
| Substitui (50% no mês 1) | Primeiro aluguel já é a comissão do mês 1; administração normal só a partir do mês 2 | ✓ |

**User's choice:** Substitui (50% no mês 1, sem os 10% extra)

---

## Geração da taxa — automática ou ação separada?

| Option | Description | Selected |
|--------|-------------|----------|
| Automático na baixa (recomendado) | Calcula e registra junto com o pagamento | ✓ (com ajuste) |
| Ação separada | Usuário aciona quando quiser | |

**User's choice:** Automático na baixa — **mas** com uma ressalva importante: deve ser possível editar o valor sugerido para qualquer número, não só ajustar o percentual — cobre exceções e imprevistos ("o sistema precisa estar adaptado a imprevistos e exceções").
**Notes:** Essa ressalva virou D-03 em CONTEXT.md — o campo no diálogo de pagamento é um valor livre, pré-preenchido pela sugestão calculada, não um seletor de percentual travado.

---

## Impacto em telas existentes

| Option | Description | Selected |
|--------|-------------|----------|
| Aditivo, não mexe (recomendado) | Financeiro/Relatórios continuam mostrando valor bruto; área nova mostra o dinheiro da imobiliária | ✓ |
| Muda telas existentes | Financeiro/Relatórios passam a mostrar valor líquido do proprietário | |

**User's choice:** Aditivo (recomendado)
**Notes:** Esta escolha determinou a decisão estrutural D-04 — a taxa não pode ser um `tipo` novo em `parcela_lancamentos`, porque isso entraria automaticamente nos cálculos existentes de status/valor da parcela.

---

## Retroatividade

| Option | Description | Selected |
|--------|-------------|----------|
| Só daí pra frente (recomendado) | Configurar percentual e calcular só a partir dali | ✓ (reformulado) |
| Retroativo também | Gerar lançamentos de taxa para pagamentos já registrados | |

**User's choice:** Nenhuma das duas exatamente — o usuário esclareceu que as baixas existentes em produção são todas de teste e serão canceladas antes de usar de verdade. A funcionalidade deve cobrir **todas** as parcelas do sistema (não só contratos novos), mas sem gerar nada retroativo para pagamentos já feitos — o cálculo só passa a valer a partir do momento em que uma baixa acontecer depois desta fase existir.
**Notes:** Registrado como D-05 em CONTEXT.md, com a reformulação exata do usuário.

---

## Onde ficam os percentuais do contrato

| Option | Description | Selected |
|--------|-------------|----------|
| Dentro da edição do card (recomendado) | Dois campos novos no modal já existente | |
| Tela separada de configuração financeira | Nova seção só para taxas | ✓ |

**User's choice:** Tela separada de configuração financeira

---

## Fluxo de baixa — mesmo diálogo ou passo separado?

| Option | Description | Selected |
|--------|-------------|----------|
| No mesmo diálogo de pagamento (recomendado) | Campo a mais em "Registrar pagamento" | ✓ |
| Passo separado depois | Segunda tela após confirmar o pagamento | |

**User's choice:** No mesmo diálogo de pagamento (recomendado)

---

## Caução — quando e onde

| Option | Description | Selected |
|--------|-------------|----------|
| Ação à parte, ligada ao contrato (recomendado) | Botão/ação no card ou Financeiro para registrar recebido/devolvido/usado quando o dinheiro se move | ✓ |
| Parte da criação do contrato | Pergunta ao criar/editar o card | |

**User's choice:** Ação à parte, ligada ao contrato (recomendado)
**Notes:** O usuário corrigiu a grafia — é "Caução", não "Cação" (erro de digitação do orquestrador na pergunta).

---

## Claude's Discretion

- Nome das novas tabelas/entidades (taxa da imobiliária, caução)
- Layout exato da tela de "Configuração financeira"
- Formato exato do relatório de reconciliação
- Onde exatamente a ação de Caução aparece na tela (card do Board, linha do Financeiro, ou ambos)
- Definição estrutural de "primeira parcela" = menor `competencia` para o `card_id` (inferência de Claude, não uma pergunta feita ao usuário — decorre diretamente da geração retroativa já existente desde a Phase 6.1)

## Deferred Ideas

- Refinamento do relatório de reconciliação — o usuário avisou explicitamente, ao encerrar a discussão, que depois desta entrega inicial vai querer ajustar/refazer partes do relatório "para se comunicar com o sistema todo". Não especificado, não bloqueia esta fase.
