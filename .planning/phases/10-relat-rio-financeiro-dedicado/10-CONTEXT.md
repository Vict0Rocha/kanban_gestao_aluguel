# Phase 10: Relatório Financeiro dedicado - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Uma página própria em `/relatorios/financeiro` (nova rota), alcançada por um botão "Relatório financeiro" na página `/relatorios` atual. Reusa o padrão visual e de dados da Phase 8 (painel de filtro suspenso + 4 cards por situação), mas com duas diferenças deliberadas: o filtro roda **ao vivo** (nunca precisa clicar em nada para ver o resultado mudar) e existe uma **lista de parcelas filtradas** abaixo dos cards. O botão que na Phase 8 se chama "Gerar relatório" muda de papel aqui: vira **"Exportar PDF"**, porque a consulta em si já não depende de clique nenhum.

In scope:
- Rota nova `/relatorios/financeiro`, alcançada por um botão "Relatório financeiro" dentro da `/relatorios` atual (mesma aba)
- Painel de filtro suspenso reaproveitado da Phase 8 (imóvel/proprietário/período/situação), mas dinâmico — qualquer mudança nos campos atualiza os cards e a lista imediatamente, sem botão de "aplicar"
- Os mesmos 4 cards de categoria da Phase 8 (pagas/a vencer/vencidas/conciliadas), recalculados ao vivo
- Lista de parcelas abaixo dos cards — uma linha por parcela (não por contrato), sempre em sincronia com o filtro atual
- Botão "Exportar PDF" — gera um PDF com os 4 totais, a lista completa filtrada, e um cabeçalho mostrando os filtros aplicados e a data de geração

Explicitamente fora de escopo:
- Qualquer mudança na página `/relatorios` atual além de acrescentar o botão "Relatório financeiro" — o painel suspenso de filtro-só-por-clique da Phase 8 continua existindo do jeito que está, não é substituído nem migrado
- Rastrear dinheiro recebido pela imobiliária em si (taxa de administração, primeiro aluguel, caução, taxas de gestão) — pedido pelo usuário durante esta discussão, mas é uma capacidade nova de modelo de dados (quem é o beneficiário do lançamento: proprietário vs imobiliária), não uma variação de relatório. Vira fase própria futura — ver `<deferred>`.

Requirements: **RELDED-01 a RELDED-05** (trabalho pós-milestone, mesmo grupo do que INTEG-01..05 da Phase 9 — nenhum requisito de v2.0 cobre esta fase; propostos e adicionados a REQUIREMENTS.md nesta rodada de planejamento)
</domain>

<decisions>
## Implementation Decisions

### Filtro ao vivo e papel do botão — decidido nesta sessão
- **D-01 (usuário, explícito):** O filtro é dinâmico — qualquer mudança em imóvel/proprietário/período/situação recalcula os 4 cards e a lista imediatamente, sem precisar clicar em nada. Diferente deliberadamente do padrão botão-só-dispara da Phase 8 (D-04 de `08-CONTEXT.md`) — não "consertar" essa fase achando que é inconsistência com a Phase 8; ambas foram escolha explícita do usuário, em fases diferentes.
- **D-02 (usuário, explícito):** O botão que na Phase 8 se chama "Gerar relatório" **vira "Exportar PDF"** nesta página — já não dispara a consulta (que roda sozinha a cada mudança de filtro), só gera o PDF do que está na tela no momento do clique.

### Lista de parcelas — decidido nesta sessão
- **D-03 (usuário, explícito):** A lista abaixo dos cards mostra **uma linha por parcela**, não por contrato — mesmo nível de granularidade dos 4 cards. Cada linha: endereço, proprietário, competência, vencimento, situação e valor. Dá para ver exatamente quais parcelas caíram em cada categoria, não só a contagem.

### Conteúdo do PDF — decidido nesta sessão
- **D-04 (usuário, explícito):** O PDF exportado é um documento autônomo — leva os 4 totais, a lista completa de parcelas filtradas, e um cabeçalho com os filtros que estavam aplicados no momento da exportação e a data de geração. Ninguém que abrir o PDF depois precisa lembrar ou adivinhar o que foi filtrado.

### Rota — decidido nesta sessão
- **D-05 (usuário, explícito):** Rota nova em `/relatorios/financeiro`. O botão "Relatório financeiro" dentro da `/relatorios` atual navega direto, na mesma aba (sem `target="_blank"`) — consistente com o resto do app, que não abre nada em nova aba hoje.

### Claude's Discretion
- **Estratégia de dado ao vivo:** se o filtro dinâmico busca do servidor a cada mudança de campo, ou busca uma vez ao carregar a página (`buscarParcelasRelatorioAction`, já existente) e filtra em memória a cada tecla — dado o volume (~48 contratos, poucas centenas de parcelas), buscar uma vez e filtrar em memória é o caminho natural (mesmo raciocínio de D-06 de `06.2-CONTEXT.md` e do "Claude's Discretion" de `08-CONTEXT.md`). Reconfirmar no plano; se o pesquisador achar um motivo técnico para preferir busca por tecla, é ponto de levantar.
- **Geração do PDF:** biblioteca/abordagem (client-side `window.print()` com CSS de impressão, `jsPDF`/`html2canvas`, ou geração server-side) fica para pesquisa/planejamento — nenhuma preferência de produto declarada, só o conteúdo (D-04) e o gatilho (D-02) importam para o usuário. **Atenção:** este projeto está numa versão do Next.js com breaking changes vs. o conhecimento de treinamento (ver `web/AGENTS.md`) — o pesquisador/planner deve verificar compatibilidade de qualquer biblioteca de PDF com Next.js 16/React 19/Turbopack antes de escolher.
- **Estado inicial do painel de filtro:** mesmo padrão de `FiltroRelatorioFinanceiro` (Phase 8) — fechado por padrão ao carregar a página.
- **Reaproveitamento de código:** `calcularRelatorioFinanceiro`, `ParcelaRelatorio`, `FiltroRelatorioValores`, `filtroRelatorioVazio`, `passaFiltroTexto`/`passaFiltroPeriodo` (todos em `web/src/lib/kanban/relatorio-financeiro.ts`) já implementam exatamente a filtragem e agregação em memória que esta fase precisa — a única mudança é o gatilho (a cada campo, não só no clique) e a adição da lista de linhas. Não reimplementar essas funções.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Página e padrão que esta fase estende
- `.planning/phases/08-relat-rios-financeiros/08-CONTEXT.md` — D-01 a D-08, especialmente D-04 (o padrão botão-só-dispara que esta fase deliberadamente NÃO reusa) e D-06/D-07 (cálculo das 4 categorias, reaproveitado aqui verbatim)
- `web/src/lib/kanban/relatorio-financeiro.ts` — `calcularRelatorioFinanceiro`, `ParcelaRelatorio`, `FiltroRelatorioValores`, `filtroRelatorioVazio`, `SITUACAO_RELATORIO_ORDEM` — a lógica pura de filtro/agregação, sem acoplamento a servidor, pronta para reuso direto
- `web/src/components/reports/relatorio-financeiro.tsx` — o componente cliente da Phase 8, mostra o padrão de estado (`aplicado`/`dados`/`carregando`/`erro`) a adaptar para o gatilho ao vivo
- `web/src/components/reports/filtro-relatorio-financeiro.tsx` — o painel suspenso (`Collapsible`/`CollapsiblePanel`) e os campos de imóvel/proprietário/período/situação, ponto de partida para o filtro desta fase
- `web/src/lib/kanban/actions.ts` — `buscarParcelasRelatorioAction` (Server Action que busca `parcelas` fresco, criada na correção pós-verificação da Phase 8 para o bug da aba desatualizada — reusar, não reimplementar a query)
- `web/src/app/(app)/relatorios/page.tsx` — a rota atual, ponto de partida para o botão "Relatório financeiro" e para a estrutura da rota nova em `/relatorios/financeiro`
- `web/src/components/reports/stat-tile.tsx` — padrão visual dos cards, reusado sem alteração

### Restrições do projeto
- `web/AGENTS.md` — Next.js 16 tem breaking changes vs. conhecimento de treinamento; ler os docs locais em `node_modules/next/dist/docs/` antes de escrever código novo, especialmente ao escolher biblioteca de PDF
- `.planning/phases/09-integridade-de-datas-do-contrato-nas-parcelas/09-CONTEXT.md` § `<deferred>` — onde esta fase foi originalmente prevista (pedido do usuário na mesma conversa que abriu a Phase 9)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `calcularRelatorioFinanceiro(parcelas, filtro, hojeISO)` (`relatorio-financeiro.ts:82`): pura, sem I/O — já faz exatamente o filtro (imóvel/proprietário/período/situação) e a agregação em 4 categorias que esta fase precisa. Chamar a cada mudança de filtro (via `useMemo`, já é o padrão em `relatorio-financeiro.tsx:43-49`) em vez de só dentro de um handler de clique é a única mudança de gatilho necessária.
- `buscarParcelasRelatorioAction()` (`actions.ts`): já busca `parcelas` sem filtro de arquivado/ativo (D-05 da Phase 8) — mesma fonte de dado que esta fase usa, só muda quando ela é chamada (ao carregar a página, não ao clicar).
- `FilterChip`/`toggle()` (`reports-view.tsx`): padrão de chip de situação já reusado por `FiltroRelatorioFinanceiro` — mesmo padrão serve para a página nova.

### Established Patterns
- Toda leitura financeira roda com a sessão do usuário via Server Action (`requireUser()`), nunca `service_role` — a rota nova segue o mesmo padrão de `relatorios/page.tsx` (Server Component que busca o necessário, componente cliente que interage).
- `hojeEmCuiaba()` (`format.ts`) para qualquer cálculo de "hoje" no servidor — nunca `Date` nativo (lição registrada em `STATE.md` desde a Phase 6.2).

### Integration Points
- Botão "Relatório financeiro" entra em `web/src/components/reports/reports-view.tsx` (ou na página `relatorios/page.tsx`), perto do painel de filtro suspenso já existente da Phase 8 — não decidido o texto/posição exata, fica para a UI-SPEC.
- Rota nova precisa de um `layout`/`page.tsx` próprio em `web/src/app/(app)/relatorios/financeiro/`, seguindo a mesma estrutura de Server Component + busca de `columns`/`todayISO` que `relatorios/page.tsx` já usa.

</code_context>

<specifics>
## Specific Ideas

- Frase-guia original do usuário (da conversa que abriu a Phase 9): "quero que abaixo dos cards tenha uma lista com as informações do contrato em lista" e "o botão 'Gerar relatórios' eu quero que o sistema gere um PDF" — confirmadas e refinadas nesta sessão (D-01 a D-05 acima).
- O usuário reforçou, ao pedir esta fase: "estamos construindo sistema profissional, seguro e escalável" — vale manter o mesmo padrão de rigor (Server Actions com sessão do usuário, RLS via `is_team_member()`, sem `service_role`) já usado em toda a v2.0.

</specifics>

<deferred>
## Deferred Ideas

- **Rastrear dinheiro recebido pela imobiliária (taxa de administração, primeiro aluguel, caução, taxas de gestão)** — pedido pelo usuário durante a discussão desta fase ("no nosso sistema hoje está fazendo a gestão do valor bruto, mas eu também preciso controlar o dinheiro que recebemos como imobiliária"). É uma capacidade nova de modelo de dados — hoje `parcela_lancamentos` só representa dinheiro do aluguel indo do inquilino para o proprietário; isto pediria um novo conceito de beneficiário/tipo de lançamento (imobiliária vs proprietário) e provavelmente novos `tipo` em `parcela_lancamentos` ou uma entidade nova. Não cabe como variação de relatório — precisa de discuss-phase própria para desenhar o modelo de dados primeiro. Sugestão: próxima fase depois desta (Phase 11), a definir quando o usuário quiser seguir.

### Reviewed Todos (not folded)
None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-Relatório Financeiro dedicado*
*Context gathered: 2026-08-21*
