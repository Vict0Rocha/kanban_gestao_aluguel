# Phase 8: Relatórios financeiros - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Última fase do Módulo Financeiro v2.0. Entrega um relatório financeiro — quatro categorias (pagas, a vencer, vencidas, conciliadas), cada uma com contagem de parcelas e total em dinheiro — dentro da página `/relatorios` já existente, atrás de um filtro suspenso novo, sem tocar no que já está lá (StatTile/ColumnBarChart/ContractsTable de status de contrato).

In scope:
- Painel de filtro suspenso (collapsible, mesmo padrão de abrir/fechar do `FiltroParcelas` do Financeiro), posicionado no canto superior esquerdo, abaixo do subtítulo "Uma visão geral da carteira para apoiar a decisão do dia." — decisão explícita do usuário sobre posição
- Dentro do painel: filtros por imóvel, proprietário e período (ROADMAP), mais chips de situação (paga/a vencer/vencida/conciliada) — decisão desta sessão
- Botão "Gerar relatório" — os filtros só rodam a consulta ao clicar, não atualizam ao vivo (decisão explícita do usuário, ao contrário do padrão ao-vivo do Financeiro)
- As quatro categorias com contagem + total em dinheiro (FINREL-01 a FINREL-04)
- Filtros combinam entre si sem resetar um o outro (FINREL-05)
- Vencida/a-vencer calculado na leitura (`vencimento` vs hoje), nunca guardado (FINREL, "Pilares cruzados")

Explicitamente fora de escopo:
- Exportação (PDF/Excel/CSV) — assunção confirmada na spec original ("Sem exportação de relatório nesta fase — só tela"), nunca revisitada
- Qualquer mudança na página `/relatorios` existente além de acrescentar o painel — StatTile, ColumnBarChart, ContractsTable, os chips de status de contrato ficam byte-a-byte como estão
- Mover ou duplicar filtros do Financeiro (`FiltroParcelas`) — este é um painel novo e próprio, ainda que inspirado no padrão visual dele

Requirements: **FINREL-01, FINREL-02, FINREL-03, FINREL-04, FINREL-05**
</domain>

<decisions>
## Implementation Decisions

### Localização e interação — decididas nesta sessão, não re-abrir

- **D-01 (usuário, explícito):** O relatório financeiro vive **dentro da rota `/relatorios` já existente**, não em `/financeiro` nem em rota nova. A página de hoje (contrato/status) fica exatamente como está; o relatório financeiro é uma peça nova, adicionada, não uma reforma.
- **D-02 (usuário, explícito):** O painel de filtro é **suspenso/colapsável** (mesmo comportamento de abrir/fechar do `FiltroParcelas` do Financeiro — `Collapsible`/`CollapsibleTrigger`/`CollapsiblePanel`, já em uso em `web/src/components/financeiro/filtro-parcelas.tsx`), posicionado no **canto superior esquerdo**, **abaixo** do parágrafo "Uma visão geral da carteira para apoiar a decisão do dia." (linha 138 de `reports-view.tsx`).
- **D-03 (usuário, explícito):** Dentro do painel, filtros por **imóvel** (busca por endereço, mesmo padrão `ilike` que `proprietário`/`inquilino` já usam no Financeiro — não há campo "imóvel" no Financeiro hoje, mas o padrão de busca textual é o mesmo), **proprietário** (idem) e **período** (mesmo formato `YYYY-MM` que o Financeiro já usa), mais **chips de situação** (paga/a vencer/vencida/conciliada — mesmo padrão visual dos chips de status de contrato já em `reports-view.tsx`, `STATUS_OPTIONS`/`FilterChip`, mas para as quatro situações de parcela).
- **D-04 (usuário, explícito):** A consulta **não** roda ao vivo. Existe um botão **"Gerar relatório"**: o usuário ajusta os filtros e só então clica para rodar. Diferente deliberadamente do padrão ao-vivo do Financeiro — não "consertar" para live-update depois achando que é inconsistência; foi escolha explícita.
- **D-05 (usuário, explícito):** Contratos arquivados ou inativos **entram** nos totais do relatório financeiro. O relatório é sobre dinheiro que já aconteceu ou está para acontecer — arquivar/inativar um contrato não apaga histórico financeiro dele, mesmo raciocínio de D-01/D-05 da Phase 6.2 (parcela com lançamento nunca some). **Isto é uma exceção deliberada** à regra de visibilidade da Phase 6.2 (que esconde parcela de contrato arquivado/inativo no Financeiro/Board) — não a mesma regra aplicada aqui. Documentar isso com destaque no código, porque é o tipo de "inconsistência" que um leitor futuro tende a "corrigir" sem saber que foi escolha do usuário.

### Cálculo das quatro categorias — Claude's Discretion, informado por código já existente

- **D-06:** As quatro categorias reusam a lógica já estabelecida em `web/src/lib/kanban/parcelas.ts`, não reimplementam:
  - `pagas` = `status === "paga"` (`situacaoDaParcela`)
  - `conciliadas` = `status === "conciliada"`
  - `a vencer` = `status` em `aberta`/`parcial` **e** `vencimento >= hoje` (Cuiabá, `hojeEmCuiaba()`)
  - `vencidas` = `status` em `aberta`/`parcial` **e** `vencimento < hoje`
- **D-07:** O "total em dinheiro" de cada categoria, para bater com "quanto entrou, quanto falta entrar, o que está atrasado" (goal da fase no ROADMAP):
  - `pagas`/`conciliadas`: soma de `valorPago` (dinheiro que já entrou)
  - `a vencer`/`vencidas`: soma de `valorDevido − valorPago` (o que falta entrar), nunca negativo
  - Os dois valores por parcela vêm de `somarLancamentos(valor_original, lancamentos)`, já existente — não recalcular na mão.
- **D-08:** Filtro por período aplica sobre `competencia` (mesmo campo que o Financeiro usa para o filtro de período), não sobre `vencimento` — consistência com o resto do módulo.

### Claude's Discretion

- Forma exata do layout dos quatro cartões/linhas (StatTile-like, tabela, ou outro) — UI-SPEC decide, informado pelo `StatTile` já existente em `web/src/components/reports/stat-tile.tsx`.
- Se o relatório roda com uma única query trazendo todas as parcelas do board (mesmo padrão de `financeiro/page.tsx`) e agrega em memória, ou se usa `count`/`sum` no PostgREST — decisão técnica de planejamento, sem preferência de produto declarada. Dado o volume (~48 contratos, algumas centenas de parcelas), agregação em memória é aceitável (mesmo raciocínio de D-06 da Phase 6.2).
- Estado inicial do painel: aberto ou fechado ao carregar a página — seguir o mesmo padrão de `FiltroParcelas` (fechado por padrão, abre se a URL já chegar com algum filtro aplicado).
</decisions>

<specifics>
## Specific Ideas

- Frase-guia do usuário para esta fase: "quero fazer filtros e gerar relatórios de forma avançada e eficiente" — o painel de filtro não é um afterthought, é o ponto de entrada principal do relatório financeiro. Vale investir na ergonomia dele (rótulos claros, chips fáceis de alternar), não só fazer o mínimo funcional.
- É a última fase do milestone v2.0 (Módulo Financeiro). Depois dela, as quatro fases de ação (baixa/ajuste, conciliação/destrava) e as duas fases de consulta (Financeiro, Relatórios) estão todas completas.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/financeiro-modulo-prompt.md` — "Fase 5 — Relatórios financeiros" e a assunção #3 ("sem exportação de relatório nesta fase")
- `.planning/ROADMAP.md` § Phase 8 — goal, 5 success criteria (FINREL-01..05 mapeados), "Pilares cruzados"
- `web/src/app/(app)/relatorios/page.tsx` — a rota atual, Server Component, já usa `hojeEmCuiaba()` e já filtra `cards.arquivado_em is null` para o relatório de contrato — **este filtro NÃO deve se propagar para a query nova do relatório financeiro** (D-05: arquivado entra no relatório financeiro)
- `web/src/components/reports/reports-view.tsx` — `STATUS_OPTIONS`/`FilterChip`/`toggle()` (padrão de chip a reusar para situação de parcela), o parágrafo "Uma visão geral da carteira..." (linha 138, ponto de referência para a posição do painel novo)
- `web/src/components/reports/stat-tile.tsx` — padrão visual de indicador numérico já em uso
- `web/src/components/financeiro/filtro-parcelas.tsx` — o `Collapsible`/`CollapsibleTrigger`/`CollapsiblePanel` a reusar para o painel suspenso, e o padrão de campos de texto para proprietário/período
- `web/src/lib/kanban/parcelas.ts` — `situacaoDaParcela`, `somarLancamentos`, `statusDeParcela` — as três funções das quais D-06/D-07 dependem, não reimplementar
- `web/src/lib/kanban/format.ts` — `hojeEmCuiaba()`, `formatCurrency`
- `.planning/phases/06.2-ciclo-de-vida-do-contrato/06.2-CONTEXT.md` — D-01/D-05 (o precedente de "lançamento nunca some"), citado por analogia em D-05 desta fase
</canonical_refs>

<open_questions>
## Open Questions

None blocking. A forma exata do layout dos quatro totais e a estratégia de query (memória vs agregação no banco) ficam para a UI-SPEC / planejamento — ver Claude's Discretion acima.
</open_questions>
