# Phase 20: Filtro por tipo de movimento no relatório da imobiliária - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-28
**Phase:** 20-filtro-por-tipo-de-movimento-no-relat-rio-da-imobili-ria
**Areas discussed:** Mecânica do seletor, Agrupamento de Caução, Escopo do filtro, Colunas da lista, PDF

---

## Mecânica do seletor

| Option | Description | Selected |
|--------|-------------|----------|
| Mesmo padrão de chips | Chips clicáveis Administração/Comissão/Caução + Todos, multi-select, `FilterChip` já usado no Relatório Financeiro | ✓ |
| Outro formato | Dropdown, radio, checkboxes tradicionais | |

**User's choice:** Mesmo padrão de chips (Recomendado)

---

## Agrupamento de Caução

| Option | Description | Selected |
|--------|-------------|----------|
| Um único chip "Caução" | Cobre os 3 subtipos (recebida/devolvida/usada) juntos | ✓ |
| Chip separado por subtipo | Recebida/Devolvida/Usada cada um com seu próprio chip | |

**User's choice:** Um único chip "Caução" (Recomendado)

---

## Escopo do filtro

| Option | Description | Selected |
|--------|-------------|----------|
| Afeta tudo: lista + totais + PDF | Desmarcar um tipo zera o StatTile correspondente e some da lista/PDF | ✓ |
| Só afeta a lista | StatTiles sempre mostram os totais completos | |

**User's choice:** Afeta tudo: lista + totais + PDF (Recomendado)

---

## Colunas da lista

**User's free-text request (primeira rodada):** "Adicione na lista que aparece em baixo o nome do proprietário e inquilino, Pode tirar o campo de endereço do imóvel. Deixando somente data, contrato mas ao invez de endereço coloca nome do proprietário e adicione o nome do inquilino."

**Claude's proposed reading (rejeitado):** ID e Proprietário como duas colunas separadas.

**User's correction:** "Sim, quase isso. Mas ao invés de adicione um novo campo para ID e proprietário, pode fazer um campo contrato com id e nome do proprietário, igual já tem hoje, só troca o endereço por proprietário e adiciona uma coluna para o inquilino."

**Final decision:** A célula "Contrato" mantém o formato atual (`IdPill` + nome ao lado) — só troca endereço por proprietário. Inquilino vira uma coluna nova e separada. Colunas finais: Data, Contrato (ID+proprietário), Inquilino, Tipo, Valor, Observação.

---

## PDF

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, o PDF acompanha | Mesmas colunas da tela também no PDF | |
| Não, deixa o PDF como está hoje | Só a tabela em tela muda | ✓ (com nuance) |

**User's choice:** "O PDF não está como eu gostaria, teríamos que mudar muita coisa, mas não precisa alterar nada no pdf por enquanto, pode deixar como está, só faça ele respeitar os filtros aplicado. Depois que vc terminar essa implementação vou trazer um modelo de como eu quero meu PDF."

**Notes:** O PDF não muda de layout nesta fase, mas precisa respeitar o novo filtro de tipo (menos linhas exportadas quando um tipo é desmarcado) — mecanismo automático, já que o PDF consome a mesma `linhas` filtrada que a tela. Redesenho do PDF vira uma fase futura, quando o usuário trouxer um modelo.

---

## Claude's Discretion

- Nome exato do tipo TypeScript para a categoria de movimento selecionada.
- Composição exata do `resetKey` de `usePagination` incluindo o novo Set de tipos.
- Posicionamento visual dos chips dentro do painel suspenso.
- Comportamento do StatTile quando um tipo é desmarcado: zerar (recomendado), não esconder — sem objeção do usuário quando apresentado.

## Deferred Ideas

- Redesenho do layout do PDF de Dinheiro da imobiliária — usuário vai trazer um modelo próprio numa fase futura.
