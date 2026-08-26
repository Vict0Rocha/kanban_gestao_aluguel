# Phase 15: Exclusão de card com destrava e paginação - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Duas capacidades independentes, agrupadas numa fase por pedido do usuário:

1. **Destrava deixa de travar a exclusão do card.** Hoje `deleteCardAction` (via `cardTemLancamento`) e o trigger de banco `impedir_exclusao_de_card_com_lancamento` recusam excluir um card se existir **qualquer** linha em `parcela_lancamentos` ligada a ele — incluindo `tipo='destrava'`, que é só um registro de auditoria (nunca soma valor, D-01 de 12-CONTEXT.md o excluiu deliberadamente do cancelamento). Passa a ser possível excluir o card mesmo com histórico de destrava, e também cancelar um lançamento `tipo='destrava'` individualmente (igual pagamento/acréscimo/desconto/taxa/caução hoje) — reabrindo pontualmente D-01 (12-CONTEXT.md). A única trava que permanece: uma parcela **conciliada** (travada) continua bloqueando tanto a exclusão do card quanto o cancelamento de qualquer lançamento seu, exatamente como hoje.
2. **Paginação (máx. 10 itens por página) em seis listagens** fora do Board: Financeiro (lista de parcelas), Relatórios → Situação dos contratos, Relatório Financeiro dedicado (lista de parcelas), Relatório da imobiliária (lista de eventos taxa+caução), Configuração financeira (lista de contratos) e Arquivados (lista de contratos arquivados).

Fora de escopo: qualquer mudança de comportamento no Board (D-02 abaixo).

</domain>

<decisions>
## Implementation Decisions

### Destrava — exclusão e cancelamento
- **D-01:** Ambas as capacidades pedidas resolvem o problema, não uma OU outra: (a) a trava de exclusão do card deixa de contar `tipo='destrava'` como impeditivo, e (b) um lançamento `tipo='destrava'` ganha botão "Cancelar" (mesmo diálogo `CancelarLancamentoDialog` já usado para pagamento/acréscimo/desconto/taxa/caução). Reabre pontualmente D-01 de `12-CONTEXT.md` ("destrava é auditoria, não valor lançado por engano, fica fora do cancelamento") — só para este caso específico, o resto da decisão original (não é escopo de "tudo que é adicionado precisa ter opção de excluir" por padrão) continua válida em espírito, mas o usuário decidiu abrir esta exceção. — **Reversibility:** one-way — **rationale:** a trava de exclusão (`deleteCardAction`/`cardTemLancamento`) tem backstop em banco (`impedir_exclusao_de_card_com_lancamento`, `supabase/migrations/20260819000000_cards_arquivado_em.sql`, corpo atual em `20260824000000_dinheiro_imobiliaria.sql`) — relaxar esse predicado exige uma migração (`create or replace function`, aditiva) aplicada em produção via o mesmo ciclo ensaio→aplicar já usado nas Phases 4/6.1/6.2/13/14; desfazer depois de aplicado significa outra migração e reconciliar cards já excluídos nesse meio-tempo (irreversível na prática, já que exclusão de card é `on delete cascade` real).
- **D-02:** Cancelar um lançamento `destrava` não reabre a conciliação nem altera o status da parcela — só remove a linha de auditoria do histórico. Mesmo comportamento de `cancelarLancamentoAction` hoje: `recalcularEGravarStatus` roda depois do DELETE por consistência com os outros três tipos, mas é inócuo para `destrava` porque `somarLancamentos` (`web/src/lib/kanban/parcelas.ts:427`) nunca soma esse tipo (comentário existente: "`destrava` não entra em nenhuma soma — é evento de estado, carrega valor 0").
- **D-03:** A única trava que sobra, em ambas as frentes (exclusão de card e cancelamento de lançamento destrava), é a parcela estar **conciliada** no momento — mesma trava já implementada por `exigirParcelaNaoConciliada` (CONCIL-02) e já chamada por `cancelarLancamentoAction`. Nenhuma trava nova precisa ser inventada: widenar `.in("tipo", [...])` para incluir `"destrava"` em `cancelarLancamentoAction` (`web/src/lib/kanban/actions.ts:1420-1460`) já herda essa proteção automaticamente. Para a exclusão do card, o predicado de bloqueio (`cardTemLancamento`/trigger) deve continuar contando pagamento/acréscimo/desconto (dinheiro de verdade) — só `destrava` sai da lista de bloqueio.

### Paginação
- **D-04:** Escopo confirmado — seis listagens ganham paginação:
  1. Financeiro — `web/src/components/financeiro/parcelas-table.tsx` (lista de parcelas)
  2. Relatórios → Situação dos contratos — `web/src/components/reports/contracts-table.tsx` (dentro de `reports-view.tsx`, `/relatorios`)
  3. Relatório Financeiro dedicado — `web/src/components/reports/relatorio-financeiro-lista.tsx` (`/relatorios/financeiro`); os 4 `StatTile` de totais em `relatorio-financeiro.tsx` são só números agregados, sem lista própria — nada a paginar ali
  4. Relatório da imobiliária — lista de eventos (taxas + caução) em `web/src/components/reports/dinheiro-imobiliaria-view.tsx` (`/relatorios/imobiliaria`)
  5. Configuração financeira — lista de contratos em `web/src/components/financeiro/configuracao-financeira-view.tsx` (`/financeiro/configuracao`)
  6. Arquivados — lista de contratos arquivados em `web/src/components/arquivados/arquivados-view.tsx` (`/arquivados`)

  Board **fica de fora** — confirmado explicitamente pelo usuário ("lá está tudo certo").
- **D-05:** Máximo 10 itens por página em todas as seis listagens. Estilo de navegação: **paginação numerada** (1, 2, 3… + setas anterior/próxima), não só Anterior/Próxima — usuário escolheu explicitamente a opção numerada sobre a minimalista.
- **D-06:** Nenhum componente de paginação existe hoje no projeto (`components/ui/` só tem table/dialog/sheet/button/input/label/separator/textarea/alert-dialog/collapsible — sem pagination nem select). Construir um componente novo, reutilizável entre as seis listagens (mesmo espírito de `IdPill`/`ParcelaSituacaoBadge` — um componente pequeno e genérico compartilhado, não seis implementações duplicadas).

### Claude's Discretion
- Onde exatamente o estado de página vive (local ao componente de lista vs. hook compartilhado) e se a paginação é client-side (slice do array já buscado/filtrado, mesmo padrão de todos os 6 componentes hoje — nenhum deles pagina no servidor) ou exige mudança na busca — pelo scout do código, todas as seis listagens já recebem o array completo já filtrado como prop e fazem `.map()` direto; paginação client-side (fatiar o array na renderização) é a abordagem natural e não deveria exigir nenhuma Server Action nova. Confirmar durante research/planning.
- Resetar para a página 1 sempre que o filtro mudar (comportamento óbvio, sem necessidade de perguntar).
- Exato desenho visual do componente de paginação numerada (tamanho, ícones, breakpoints mobile) — dentro do design system já estabelecido (Tailwind + shadcn), sem novo padrão visual a inventar.
- Se a migração do trigger (D-01) precisa também ajustar o pré-voo `cardTemLancamentoAction`/`ArquivarContratoDialog`/`ExcluirContratoDialog` (mensagens de aviso na tela) para não mencionar mais "destrava" como impeditivo — checar código real durante planning.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Trava de exclusão de card (D-01/D-14 original)
- `.planning/phases/06.2-ciclo-de-vida-do-contrato/06.2-CONTEXT.md` — decisão original D-14 ("qualquer lançamento de qualquer tipo trava a exclusão"), agora sendo pontualmente relaxada para excluir `destrava`
- `supabase/migrations/20260819000000_cards_arquivado_em.sql` — cria `impedir_exclusao_de_card_com_lancamento()` e o trigger `cards_impede_exclusao_com_lancamento`
- `supabase/migrations/20260824000000_dinheiro_imobiliaria.sql` §"Seção 4" (linhas ~225-290) — corpo atual da função (via `create or replace`), amplia para `taxas_imobiliaria`/`caucao_eventos`; próxima migração deve seguir o mesmo padrão (`create or replace function` sobre o mesmo nome, nunca `create function`/`create trigger` novo)
- `web/src/lib/kanban/actions.ts` linhas 576-660 — `tabelaTemCard`/`cardTemLancamento`/`deleteCardAction` (o pré-voo do app espelha o trigger; os dois precisam mudar juntos)
- `web/src/lib/kanban/actions.ts` linha ~788 — `cardTemLancamentoAction` (pré-voo consultivo usado pelo diálogo de exclusão)

### Cancelamento de destrava (D-01/D-02 reabertos)
- `.planning/phases/12-cancelamento-de-ajustes/12-CONTEXT.md` — D-01 original ("destrava fica fora do cancelamento, é auditoria") — esta fase reabre pontualmente essa exceção
- `web/src/lib/kanban/actions.ts` linhas 1316-1460 — `destravarParcelaAction` (grava o lançamento), `cancelarLancamentoAction` (o `.in("tipo", [...])` a widenar), `exigirParcelaNaoConciliada` (a trava que permanece)
- `web/src/lib/kanban/parcelas.ts` linhas 420-463 — `somarLancamentos`/`statusDeParcela` (confirma que `destrava` nunca entra em soma nenhuma — cancelar é seguro sem efeito colateral no status)
- `web/src/components/financeiro/cancelar-lancamento-dialog.tsx` — diálogo genérico já usado para `lancamento`/`taxa`/`caucao` (Phase 14); destrava é um quarto `acao` ou um `tipo` a mais dentro de `acao="lancamento"` — decidir durante planning
- `web/src/components/financeiro/lancamento-tipo-label.tsx` — `TIPO` map (rótulos de pagamento/acréscimo/desconto/destrava) já usado pelo histórico

### Paginação
- Nenhum ADR/spec externo — decisão nova desta fase, sem precedente no projeto

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CancelarLancamentoDialog` (`web/src/components/financeiro/cancelar-lancamento-dialog.tsx`) — já generalizado para `acao: "lancamento" | "taxa" | "caucao"` (Phase 14); widenar o `.in("tipo",...)` do server action e o texto do diálogo é o padrão exato a seguir para destrava, sem criar diálogo novo
- `ParcelaHistoricoSheet` (`web/src/components/financeiro/parcela-historico-sheet.tsx`) — já decide quando mostrar o botão "Cancelar" por tipo/kind; precisa incluir `destrava` na condição, respeitando a trava de conciliada já existente
- Nenhum componente de paginação existe — construir do zero, mas seguindo o design system Tailwind/shadcn já usado em `components/ui/`

### Established Patterns
- **DELETE condicionado com `.in("tipo", [...])` como allowlist** (`cancelarLancamentoAction`) — widenar a lista é a mudança mínima, mesmo padrão usado para adicionar `acrescimo`/`desconto` na Phase 12
- **Migração aditiva com `create or replace function`** sobre o trigger de exclusão — já usado duas vezes (Phase 6.2 cria, Phase 13 amplia); esta fase amplia de novo (relaxa, não amplia) seguindo a mesma disciplina de nunca recriar trigger/função do zero
- **Todas as seis listagens de paginação já recebem array completo já filtrado como prop e fazem `.map()` client-side** — nenhuma delas pagina no servidor hoje; ver `parcelas-table.tsx:234`, `contracts-table.tsx:42`, e equivalentes nas outras quatro

### Integration Points
- Trigger de banco + `cardTemLancamento` (app) devem mudar juntos — nunca só um dos dois, senão abre uma janela onde a tela promete algo que o banco recusa (mesmo cuidado já documentado no comentário de `cardTemLancamento`)
- `cancelarLancamentoAction` amplia o `.in()`; nenhuma mudança necessária em `registrarPagamentoAction`/`ajustarParcelaAction`/`destravarParcelaAction` em si

</code_context>

<specifics>
## Specific Ideas

- Usuário: "quero que seja possível excluir o card mesmo com esse histórico, ou que seja possível excluir esse histórico de 'destravada' igual as parcelas normais" → esclarecido em pergunta de acompanhamento: **ambas**, não uma alternativa exclusiva
- Usuário: "Só não deve ser possível caso esteja conciliada 'travada', caso esteja conciliada só deve ser possível arquivar" — este comportamento (conciliada bloqueia, arquivar continua disponível) já existe hoje via `exigirParcelaNaoConciliada` + o fluxo de arquivar (Phase 6.2); nenhuma mudança nova necessária nessa parte, só confirmar que continua valendo depois do relaxamento de `destrava`
- Usuário: "Deixe no máximo 10 itens/movimentos ou contratos" — número fixo, não configurável pelo usuário final
- Usuário: "Só não precisa aplicar no board, lá está tudo certo" — Board explicitamente fora de escopo

</specifics>

<deferred>
## Deferred Ideas

None — discussão ficou dentro do escopo da fase.

</deferred>

---

*Phase: 15-exclusão-de-card-com-destrava-e-paginação*
*Context gathered: 2026-08-26*
