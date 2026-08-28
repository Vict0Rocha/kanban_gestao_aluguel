# Phase 19: Filtro suspenso e exportação em PDF no relatório da imobiliária - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning

<domain>
## Phase Boundary

`/relatorios/imobiliaria` ("Dinheiro da imobiliária") hoje só tem um campo solto de "Período" (mês) — filtra ao vivo, mas não está dentro de nenhum painel, e não existe nenhum outro filtro nem exportação. Esta fase adiciona: (1) um painel suspenso (colapsável, abre/fecha) com os campos Imóvel/Proprietário/Inquilino/ID do contrato, com o campo Período movido pra dentro do mesmo painel; e (2) um botão "Exportar PDF" espelhando a estrutura do PDF já existente no Relatório Financeiro dedicado (Phase 10). Nenhuma mudança de schema — a única mudança de dado é ampliar a `.select()` de `buscarReconciliacaoAction` para incluir `inquilino` (campo que já existe em `cards`, só não era buscado por esta consulta).

</domain>

<decisions>
## Implementation Decisions

### Padrão do filtro suspenso
- **D-01:** O painel é **suspenso/colapsável visualmente** (mesmo shell `Collapsible`/`CollapsibleTrigger`/`CollapsiblePanel` já usado em `web/src/components/financeiro/filtro-parcelas.tsx` e em `FiltroRelatorioFinanceiro`), mas o **comportamento é ao vivo** — cada campo atualiza a tela na hora, sem botão "Consultar"/"Gerar relatório". Isso é uma composição nova, não um reuso 1:1 de nenhum dos dois padrões suspensos existentes: usa a casca visual dos dois (`FiltroParcelas`/`FiltroRelatorioFinanceiro`), mas o comportamento reativo de `FiltroRelatorioFinanceiroLive`. Confirmado explicitamente pelo usuário depois de eu apresentar as duas opções (suspenso-com-botão vs. suspenso-ao-vivo) — ele escolheu a segunda.
- **D-02:** Toda a filtragem continua 100% client-side sobre o dado já carregado por `buscarReconciliacaoAction` (nenhuma mudança na forma como a página busca dado — só amplia o que a consulta já busca, ver D-04) — mesmo padrão já usado hoje pelo campo "Período".

### Campos do filtro
- **D-03:** O painel tem cinco campos: **Imóvel** (texto livre, endereço), **Proprietário** (texto livre), **Inquilino** (texto livre), **ID do contrato** (número), e **Período** (mês — já existe hoje, só muda de posição, comportamento inalterado).
- **D-04:** `buscarReconciliacaoAction` (`web/src/lib/kanban/actions.ts`) precisa ampliar as duas consultas (`taxas_imobiliaria` e `caucao_eventos`) para incluir `inquilino` no embed `cards(...)` — hoje busca só `endereco, proprietario, numero`. Confirmado explicitamente pelo usuário depois de eu apontar que "Inquilino" não é buscado hoje por esta tela — mudança pequena e aditiva (mais um campo num `.select()` já existente), sem migração de banco. `TaxaImobiliariaRelatorio`/`CaucaoEventoRelatorio` (`web/src/lib/kanban/reconciliacao.ts`) precisam do campo `inquilino` no tipo do embed `cards`. ID do contrato (`numero`) já é buscado hoje — nenhuma mudança de consulta necessária para esse campo.

### PDF
- **D-05:** O PDF exportado espelha a estrutura do PDF já existente do Relatório Financeiro (`web/src/components/reports/relatorio-financeiro-pdf.ts`, gerado com `jsPDF`+`jspdf-autotable`, import dinâmico dentro da função — nunca no topo do módulo, mesmo pitfall documentado lá): cabeçalho com os filtros ativos (Imóvel/Proprietário/Inquilino/ID do contrato/Período — "Todos" quando vazio, mesmo padrão), um bloco com os totais (os mesmos 6 valores já mostrados pelos `StatTile` em tela: Administração, Comissão 1º aluguel, Total recebido, Caução recebida/devolvida/usada), e a lista completa (taxas+caução unificada, já ordenada) em tabela — mesmas cores/fontes/rodapé do "PDF Export Layout Contract" já em uso. Confirmado explicitamente pelo usuário.
- **D-06:** Botão "Exportar PDF" (mesmo texto/posição relativa do botão já existente em `relatorio-financeiro-dedicado.tsx`), estado `exportando`/"Exportando..." durante a geração — mesmo padrão.

### Claude's Discretion
- Nome exato do novo módulo de exportação PDF (ex.: `reconciliacao-pdf.ts`, espelhando `relatorio-financeiro-pdf.ts`) e da função exportada.
- Posicionamento exato do painel suspenso na tela (canto superior esquerdo, como em `reports-view.tsx`, vs. outra posição que faça mais sentido no layout atual de `dinheiro-imobiliaria-view.tsx`, que hoje só tem o campo Período solto no canto direito).
- Se o filtro por "ID do contrato" aceita só dígitos (mesmo padrão de `FiltroParcelas`) ou texto livre comparado contra `numero` convertido pra string.
- Nome exato do arquivo do PDF gerado (mirar `relatorio-financeiro-${hojeISO}.pdf` — algo como `dinheiro-imobiliaria-${hojeISO}.pdf` ou `reconciliacao-${hojeISO}.pdf`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Componentes de filtro suspenso existentes
- `web/src/components/financeiro/filtro-parcelas.tsx` — o `Collapsible`/`CollapsibleTrigger`/`CollapsiblePanel` a reusar para a casca visual do painel (D-01).
- `web/src/components/reports/filtro-relatorio-financeiro.tsx` — segundo precedente do padrão suspenso, dentro de `/relatorios` (não ao vivo — botão "Gerar relatório"). Referência de layout/campos, não de comportamento (D-01 escolheu ao vivo).
- `web/src/components/reports/filtro-relatorio-financeiro-live.tsx` — precedente do comportamento ao vivo (sem botão, `onChange` direto) a reusar para o comportamento dos campos, mesmo não sendo suspenso visualmente.

### PDF a espelhar
- `web/src/components/reports/relatorio-financeiro-pdf.ts` — módulo completo a espelhar (D-05): estrutura de cabeçalho/totais/lista/rodapé, import dinâmico de `jspdf`/`jspdf-autotable`, cores/fontes do layout contract, pitfalls já documentados (import de topo de módulo quebra SSR; `getNumberOfPages()` é método de `doc`, não de `doc.internal`; `showHead: "everyPage"` em vez de `headerRows`).
- `web/src/components/reports/relatorio-financeiro-dedicado.tsx` (linhas ~109-153) — como o botão "Exportar PDF" é wireado (`handleExportarPDF`, estado `exportando`, posição do botão).
- `.planning/phases/10-relat-rio-financeiro-dedicado/10-UI-SPEC.md` (se existir) — "PDF Export Layout Contract" citado nos comentários de `relatorio-financeiro-pdf.ts`.

### Tela e dados afetados
- `web/src/app/(app)/relatorios/imobiliaria/page.tsx` — Server Component, chama `buscarReconciliacaoAction()`.
- `web/src/components/reports/dinheiro-imobiliaria-view.tsx` — componente client a modificar (painel suspenso + botão PDF); já tem `periodo` como único filtro ao vivo hoje, `usePagination(linhas, periodo)`.
- `web/src/lib/kanban/actions.ts` (`buscarReconciliacaoAction`, linha ~1976) — Server Action a ampliar (D-04).
- `web/src/lib/kanban/reconciliacao.ts` — `TaxaImobiliariaRelatorio`/`CaucaoEventoRelatorio`/`calcularReconciliacao`/`passaFiltroPeriodoReconciliacao` — tipos e funções puras já usadas, tipo do embed `cards` precisa do campo `inquilino` (D-04).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Collapsible`/`CollapsibleTrigger`/`CollapsiblePanel` (`web/src/components/ui/collapsible.tsx`) — já usado por `filtro-parcelas.tsx`.
- `jsPDF`/`jspdf-autotable` — já instalados e em uso; zero dependência nova.
- `StatTile` — já usado tanto na tela quanto (em espírito, como fonte dos totais) no PDF do Relatório Financeiro.

### Established Patterns
- Filtro client-side sobre dado já carregado (sem round-trip) — mesmo padrão já usado por "Período" nesta mesma tela.
- Paginação com `resetKey` — hoje `usePagination(linhas, periodo)`; precisa virar uma composição de todos os campos do filtro (mesmo cuidado de `reports-view.tsx`'s `contractsResetKey`, que compõe `query`+filtros numa única string).
- PDF gerado 100% client-side, import dinâmico, nunca no topo do módulo (pitfall já documentado e a evitar de novo).

### Integration Points
- `DinheiroImobiliariaView` recebe `taxas`/`caucaoEventos` já carregados — o filtro e o PDF operam inteiramente depois dessa fronteira, sem tocar `page.tsx` além da ampliação do `.select()` em `buscarReconciliacaoAction` (D-04).

</code_context>

<specifics>
## Specific Ideas

O usuário pediu: "Adicione um filtro nessa página, o mesmo filtro suspenso igual já temos nas outras páginas. E adicione um botão para fazer o download em pdf igual do 'relatório financeiro', porém na página de dinheiros da imobiliária." — identificado "filtro suspenso" como o termo já usado no projeto (`08-CONTEXT.md` D-02) para o painel colapsável `Collapsible`. Confirmou explicitamente: comportamento ao vivo (não botão "Gerar"), campos Imóvel/Proprietário/Inquilino/ID do contrato além do Período existente, e PDF espelhando exatamente a estrutura do PDF do Relatório Financeiro.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)
None — nenhum todo pendente encontrado para esta fase.

</deferred>

---

*Phase: 19-Filtro suspenso e exportação em PDF no relatório da imobiliária*
*Context gathered: 2026-08-28*
