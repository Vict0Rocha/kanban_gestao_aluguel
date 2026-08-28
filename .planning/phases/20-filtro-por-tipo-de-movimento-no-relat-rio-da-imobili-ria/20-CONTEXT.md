# Phase 20: Filtro por tipo de movimento no relatório da imobiliária - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning

<domain>
## Phase Boundary

`/relatorios/imobiliaria` ("Dinheiro da imobiliária") ganhou na Phase 19 um painel suspenso com 5 campos de texto/período. Esta fase adiciona um sexto controle ao mesmo painel — um seletor de tipo de movimento (Administração/Comissão 1º aluguel/Caução) — e ajusta as colunas da lista embaixo (troca endereço por proprietário na célula "Contrato", acrescenta uma coluna "Inquilino"). O PDF (Phase 19) passa a respeitar o filtro de tipo (menos linhas exportadas), mas suas colunas **não mudam** nesta fase — o usuário vai trazer um modelo novo de PDF numa fase futura.

</domain>

<decisions>
## Implementation Decisions

### Seletor de tipo de movimento
- **D-01:** Chips clicáveis multi-select, mesmo componente `FilterChip`/`toggle` (`reports-view.tsx`) já usado pela "Situação" no Relatório Financeiro dedicado (`FiltroRelatorioFinanceiroLive`) — três chips (**Administração**, **Comissão 1º aluguel**, **Caução**) mais um chip **"Todos"**. Nenhum chip de tipo selecionado (`tipos.size === 0`) significa "mostra tudo", mesma semântica de `situacoes` — não é preciso marcar "Todos" manualmente, é o estado vazio.
- **D-02:** "Caução" é **um único chip**, cobrindo os três subtipos já existentes (recebida/devolvida/usada) juntos — não há chip separado por subtipo. Confirmado explicitamente pelo usuário depois de eu apresentar as duas opções.
- **D-03:** O filtro de tipo afeta **tudo**: a lista embaixo, os 6 `StatTile` em cima (Administração/Comissão/Total recebido/Caução recebida/devolvida/usada) e o PDF exportado — desmarcar "Comissão", por exemplo, zera o `StatTile` de Comissão e para de somá-la em "Total recebido", além de remover essas linhas da lista e do PDF. Confirmado explicitamente pelo usuário ("Afeta tudo: lista + totais + PDF").
- **D-04 (Claude's Discretion, recomendação):** Quando um tipo é desmarcado, o `StatTile` correspondente mostra R$ 0,00 — não desaparece do grid. Não há precedente neste projeto de esconder um `StatTile` condicionalmente, e escondê-lo mudaria o layout do grid de forma inconsistente entre estados do filtro; zerar é o comportamento mais simples e mais consistente com o resto da tela.

### Colunas da lista
- **D-05:** A célula "Contrato" (hoje `IdPill` + endereço, lado a lado) **mantém exatamente esse formato visual** — só troca o texto ao lado do `IdPill` de endereço para **proprietário**. Não vira duas colunas separadas (ID / Proprietário) — o usuário foi explícito sobre isso depois de eu propor errado da primeira vez ("ao invés de adicionar um novo campo para ID e proprietário, pode fazer um campo contrato com id e nome do proprietário, igual já tem hoje, só troca o endereço por proprietário").
- **D-06:** Uma coluna nova, separada, **"Inquilino"** — depois da coluna "Contrato". Colunas finais da tabela: **Data, Contrato (IdPill + proprietário), Inquilino, Tipo, Valor, Observação** — Tipo/Valor/Observação inalteradas.
- **D-07:** Endereço **sai completamente** da tela — não fica em tooltip nem em nenhum outro lugar da linha.

### PDF (Phase 19, não revisitar o layout agora)
- **D-08:** O PDF continua com as mesmas colunas de hoje (`Data/Contrato ("#numero endereco")/Tipo/Valor/Observação`, sem Proprietário/Inquilino separados) — **nenhuma mudança de layout do PDF nesta fase**. A única mudança no PDF é que ele passa a receber `linhas` já filtradas pelo tipo (D-03) — menos linhas quando um filtro de tipo está ativo, mesmo mecanismo que já filtra por Imóvel/Proprietário/Inquilino/ID/Período desde a Phase 19 (o PDF já consome `linhas` do jeito que a tela filtrou, então isso "só funciona" se a filtragem de tipo acontecer no mesmo `useMemo` de `linhas` que já alimenta o PDF — não precisa de nenhuma mudança em `reconciliacao-pdf.ts`).
- **D-09 (explícito, fora de escopo):** O usuário disse que o PDF "não está como eu gostaria" e vai trazer um modelo (template) numa fase futura — **não redesenhar o PDF agora**, nem tentar adivinhar o que ele quer. Registrar como ideia adiada.

### Claude's Discretion
- Nome exato do novo tipo TypeScript pra representar os 3 valores do chip de tipo (ex.: `"administracao" | "comissao_primeiro_aluguel" | "caucao"`) — precisa mapear `taxa.origem` (`administracao`/`comissao_primeiro_aluguel`, já existe) e os três `evento.tipo` de caução (`recebido`/`devolvido`/`usado`, já existem) para uma única categoria "caucao" na hora de filtrar.
- Como compor o `resetKey` de `usePagination` — agora precisa incluir também o novo estado de tipos selecionados (um `Set`), não só os 5 campos de texto/período já existentes desde a Phase 19. `relatorio-financeiro-dedicado.tsx` já resolve exatamente esse problema (resetKey com `Set` dentro, via `JSON.stringify` ou `[...set].sort().join(",")`) — mirar esse precedente.
- Onde exatamente os chips ficam posicionados dentro do painel suspenso, relativo aos 5 campos já existentes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Componente de chip já existente
- `web/src/components/reports/reports-view.tsx` — `FilterChip`/`toggle()`, o componente e a função de toggle de `Set` já usados pela "Situação" no Relatório Financeiro dedicado (D-01).
- `web/src/components/reports/filtro-relatorio-financeiro-live.tsx` — uso de referência de `FilterChip`/`toggle` dentro de um filtro ao vivo (linhas ~83-109), incluindo o chip "Todas" e a semântica de Set vazio = sem filtro.
- `web/src/components/reports/relatorio-financeiro-dedicado.tsx` — como o `resetKey` de `usePagination` compõe um campo `Set` (`situacoes`) junto com os campos de texto — precedente direto para D-03/Claude's Discretion.

### Tela, dados e PDF afetados (Phase 19, já em produção)
- `web/src/components/reports/dinheiro-imobiliaria-view.tsx` — componente principal a modificar: `LinhaLista`/`filtro`/`linhas` (useMemo)/`resetKey`/render das colunas da tabela.
- `web/src/lib/kanban/reconciliacao.ts` — `FiltroReconciliacaoValores` (precisa ganhar o campo de tipos selecionados), `passaFiltroCardsReconciliacao`, `calcularReconciliacao` (precisa aceitar o filtro de tipo para zerar StatTiles corretamente, D-04), `TaxaImobiliariaRelatorio.origem`/`CaucaoEventoRelatorio.tipo` (os campos-fonte da categorização).
- `web/src/components/financeiro/taxa-origem-label.tsx` — `TAXA_ORIGEM` (administracao/comissao_primeiro_aluguel).
- `web/src/components/financeiro/caucao-evento-label.tsx` — `CAUCAO_TIPO` (recebido/devolvido/usado) — os três precisam mapear para a categoria única "caução" (D-02).
- `web/src/components/reports/reconciliacao-pdf.ts` — **não modificar o layout** (D-08/D-09), só se beneficia automaticamente de `linhas` já filtrada, sem nenhuma mudança de código aqui.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FilterChip`/`toggle()` (`reports-view.tsx`) — pronto, sem alteração necessária.
- `passaFiltroCardsReconciliacao`/`FiltroReconciliacaoValores` (Phase 19, `reconciliacao.ts`) — extensível com mais um campo (tipos) e mais uma checagem.

### Established Patterns
- Filtro client-side sobre dado já carregado (sem round-trip) — mesmo padrão de todo o resto da tela desde a Phase 19.
- Chips multi-select com Set vazio = "sem filtro" — mesmo padrão de `situacoes` no Relatório Financeiro dedicado.
- `resetKey` como identidade pura do filtro (nunca dos dados) — estabelecido desde a Phase 15, reconfirmado na Phase 19 para este mesmo componente.

### Integration Points
- O filtro de tipo entra no mesmo `useMemo` de `linhas` que já filtra por Imóvel/Proprietário/Inquilino/ID/Período (Phase 19) — uma checagem a mais na mesma cadeia de `.filter()`.
- `calcularReconciliacao` precisa do filtro de tipo além do `periodo` que já recebe, para D-04 (StatTiles zerados) funcionar.

</code_context>

<specifics>
## Specific Ideas

O usuário pediu, em duas mensagens: (1) "Selecionar somente administração, comissão 1° aluguel e caução" — um seletor de tipo no mesmo painel suspenso da Phase 19; (2) durante a discussão, pediu também para trocar a coluna de endereço por proprietário na célula "Contrato" (mantendo o mesmo formato ID+nome) e acrescentar uma coluna Inquilino separada; e (3) confirmou que o PDF não muda de layout agora — só passa a respeitar os filtros aplicados — porque ele mesmo vai trazer um modelo (template) de como quer o PDF numa fase futura.

</specifics>

<deferred>
## Deferred Ideas

- **Redesenho do layout do PDF de Dinheiro da imobiliária** — o usuário disse explicitamente que o PDF atual "não está como eu gostaria" e que vai trazer um modelo próprio depois desta fase. Não é escopo desta fase (D-09) — vira uma fase futura quando o usuário trouxer o modelo.

### Reviewed Todos (not folded)
None — nenhum todo pendente encontrado para esta fase.

</deferred>

---

*Phase: 20-Filtro por tipo de movimento no relatório da imobiliária*
*Context gathered: 2026-08-28*
