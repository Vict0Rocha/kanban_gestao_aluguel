# Phase 18: Filtro na Configuração financeira - Context

**Gathered:** 2026-08-27
**Status:** Ready for planning

<domain>
## Phase Boundary

`/financeiro/configuracao` lista todos os contratos (percentuais de administração/comissão + status de caução), com paginação desde a Phase 15, mas sem nenhum jeito de filtrar. Esta fase adiciona um campo de busca à tabela — nada além disso: sem novos campos de configuração, sem mudança nos diálogos de editar percentuais/caução, sem mudança na query do servidor (a tela já carrega todos os contratos de uma vez, sem filtro de visibilidade — A-02, decisão deliberada que continua valendo).

</domain>

<decisions>
## Implementation Decisions

### Padrão do filtro
- **D-01:** Reusar o componente `SearchField` (`web/src/components/search-field.tsx`) exatamente como já é usado no Board e em `/relatorios` (relatório "Situação dos contratos", via `ReportsView`/`reports-view.tsx`) — busca ao vivo, sem botão de submit, cada tecla atualiza a lista na hora, filtragem inteiramente no cliente sobre os dados já carregados. Não é o padrão do drawer colapsável de `FiltroParcelas` (Financeiro) nem o painel sempre-visível de `FiltroRelatorioFinanceiroLive` (Relatório Financeiro dedicado) — o usuário pediu especificamente "o mesmo input onde do relatório", identificado como o `SearchField` do relatório de Situação dos contratos.
- **D-02:** A busca filtra a lista de verdade (remove linhas que não batem), não apenas realça — mesmo comportamento dos relatórios (`matchingIds`/filtro real), diferente do Board (que só realça para não atrapalhar o drag-and-drop, D-doc em `search.ts`). Não existe conceito de arrastar nesta tela, então filtrar de verdade é o comportamento certo e mais simples.

### Campos da busca
- **D-03:** A busca olha três campos, os mesmos já visíveis nas colunas da tabela: **número do contrato** (ID), **endereço** e **proprietário**. Confirmado explicitamente pelo usuário depois de eu apontar que `ContratoConfig` (o tipo desta tela) não tem `inquilino`/`telefone`/`observacoes` como o `Card` completo do Board — o `buildMatcher`/`searchableText` existentes em `search.ts` são tipados para `Card` e não se aplicam diretamente a `ContratoConfig`; a implementação precisa de um matcher próprio (ou uma adaptação) para os três campos desta tela. Mesma UX esperada: sem distinção de acento, múltiplos termos (cada termo precisa bater em algum dos três campos, mesmo espírito de `buildMatcher`).

### Claude's Discretion
- Onde exatamente a `SearchField` fica posicionada na tela (acima da tabela, ao lado do título, etc.) — mirar o posicionamento já usado em `reports-view.tsx` para consistência visual, mas o researcher/planner decide o detalhe.
- Texto do estado vazio quando a busca não encontra nada (hoje `ConfiguracaoFinanceiraView` só trata `erro` e `linhas.length === 0` "Nenhum contrato cadastrado ainda." — precisa de uma terceira mensagem para "filtrou e não achou nada", mirando o padrão já usado nos relatórios).
- Como a paginação (`usePagination`, resetKey hoje é a string constante `"config"` — D-PAGIN-03) precisa mudar para resetar a página quando o termo de busca muda, sem resetar quando o usuário só edita percentuais/caução (`router.refresh()`) — mesmo cuidado do Pitfall 3 documentado em `15-RESEARCH.md`, que o researcher desta fase deve reconfirmar contra o código atual.
- Se a busca deve rodar dentro do próprio `ConfiguracaoFinanceiraView` (componente client já existente) ou precisa de um componente novo — decisão de implementação, não de produto.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Componentes de busca/filtro existentes
- `web/src/components/search-field.tsx` — o componente a reutilizar (D-01). Já documenta no próprio comentário que a filtragem é sempre no cliente.
- `web/src/lib/kanban/search.ts` — `normalizeText`, `buildMatcher`, `matchingIds`, `isSearching`. `buildMatcher`/`searchableText` são tipados para `Card` (D-03) — não reutilizáveis direto para `ContratoConfig`, mas `normalizeText` (acento-insensível) é genérico e reutilizável.
- `web/src/components/reports/reports-view.tsx` (linha ~156) — uso de referência do `SearchField` num relatório, incluindo o comentário sobre resetar página quando a busca muda (linha ~130).

### Tela e componente afetados
- `web/src/app/(app)/financeiro/configuracao/page.tsx` — Server Component, carrega todos os contratos sem filtro de visibilidade (A-02) — não deve mudar nesta fase, a busca é 100% client-side sobre dado já carregado.
- `web/src/components/financeiro/configuracao-financeira-view.tsx` — componente client a modificar; já usa `usePagination`/`Pagination` (`web/src/components/pagination.tsx`) com `resetKey` constante `"config"` (comentário citando PAGIN-03).

### Decisões de fases anteriores relevantes
- `15-CONTEXT.md`/`15-RESEARCH.md` (Pitfall 3) — cuidado já documentado sobre resetKey de paginação não poder resetar em refreshes que não são de filtro.
- `16-CONTEXT.md`/`17-CONTEXT.md` — não têm decisões diretamente relevantes para esta fase; revisados e descartados.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SearchField` (`web/src/components/search-field.tsx`) — componente pronto, sem alteração necessária; só precisa de um estado `query` e uma função de matching no componente pai.
- `normalizeText` (`web/src/lib/kanban/search.ts`) — reutilizável para normalizar acento/caixa nos três campos de `ContratoConfig`.

### Established Patterns
- Filtro client-side sobre dado já carregado (sem round-trip ao servidor) — mesmo padrão de `reports-view.tsx` e `FiltroRelatorioFinanceiroLive`; `financeiro/configuracao` já se encaixa nesse padrão porque a página já carrega tudo de uma vez.
- Paginação com `resetKey` (`usePagination`, `web/src/components/pagination.tsx`) — mudar o filtro deve resetar para a página 1 (convenção estabelecida na Phase 15, PAGIN-01), mas ações que só editam um contrato (percentuais/caução) não devem resetar a página do usuário.

### Integration Points
- `ConfiguracaoFinanceiraView` recebe `linhas: ContratoConfig[]` já carregado — a busca filtra esse array em memória antes de passar para `usePagination`, sem tocar `page.tsx` (Server Component).

</code_context>

<specifics>
## Specific Ideas

O usuário pediu explicitamente: "Quero um campo de busca! O mesmo input onde do relatório onde o usuário digita alguma informação do contrato e é filtrado." — identificado como o `SearchField` já usado em `/relatorios` (relatório "Situação dos contratos"). Confirmou que os três campos certos são número do contrato, endereço e proprietário — os mesmos já visíveis nas colunas da tabela desta tela.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)
None — nenhum todo pendente encontrado para esta fase.

</deferred>

---

*Phase: 18-Filtro na Configuração financeira*
*Context gathered: 2026-08-27*
