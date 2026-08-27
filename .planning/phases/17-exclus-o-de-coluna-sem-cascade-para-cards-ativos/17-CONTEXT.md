# Phase 17: Exclusão de coluna sem cascade para cards ativos - Context

**Gathered:** 2026-08-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Excluir uma coluna que ainda tem cards **ativos** (não arquivados) deixa de apagar esses cards em cascata.
Em vez do aviso atual ("Os N imóveis dessa coluna também serão excluídos"), o próprio diálogo de exclusão
passa a oferecer para qual coluna mover os cards — escolher e confirmar move os cards e só então exclui a
coluna, numa única ação. Se não existir nenhuma outra coluna no board, a exclusão é bloqueada com mensagem
clara.

Cards **arquivados** já não têm relação nenhuma com coluna desde a Phase 16 (`column_id` nulo) — nunca
aparecem numa coluna, logo nunca entram no escopo desta fase. Esta fase cobre exclusivamente o caminho
principal do Board (cards ativos), o mesmo risco de cascade que a Phase 16 fechou para cards arquivados,
mas na direção que faltava.

Fora de escopo: qualquer mudança no botão "Reordenar" em si (Phase 16, `reordenarCardsAction`/
`ReordenarDialog`) — esta fase reusa o mesmo padrão de UI/mecanismo, mas para um gatilho e um escopo de
cards diferentes (todos os cards **da coluna sendo excluída**, não os que batem com uma busca).

</domain>

<decisions>
## Implementation Decisions

### Mecanismo
- **D-01:** O diálogo de exclusão de coluna (`column.tsx`, hoje um `AlertDialog` com o aviso "Os N imóveis dessa coluna também serão excluídos") passa a oferecer um seletor de coluna de destino quando a coluna tem pelo menos 1 card — mesmo padrão visual do `ReordenarDialog` (Phase 16): lista de colunas como botões, selecionado com `variant="default"`. Confirmar move todos os cards da coluna para o destino escolhido e só então exclui a coluna — uma única ação, sem tela de confirmação adicional (mesmo espírito de D-07 da Phase 16). Quando a coluna já está vazia (0 cards), o fluxo continua exatamente como hoje — confirmação simples, sem seletor.
- **D-02:** Se a coluna sendo excluída for a única do board (nenhuma outra coluna disponível como destino) e ela tiver pelo menos 1 card, a exclusão é bloqueada com mensagem clara ("Crie outra coluna antes de excluir esta.") — nunca deixa um card ativo sem coluna nenhuma (isso é reservado para o estado de arquivado, Phase 16, não para um card em operação normal).
- **D-03:** Nenhuma migração de banco é necessária. `columns → cards on delete cascade` continua existindo no schema como rede de segurança — a fase garante, na camada de aplicação, que a coluna está sempre vazia (todos os cards já movidos) antes do `delete from columns` rodar, então o cascade nunca chega a apagar um card de verdade. Confirmado por leitura do schema (`20260728000000_init_schema.sql`) e do fluxo de `deleteColumnAction`/`reordenarCardsAction` (`web/src/lib/kanban/actions.ts`) durante a discussão — mover os cards primeiro também contorna, de propósito, a trava de `impedir_exclusao_de_card_com_lancamento` (o trigger não bloqueia mais a exclusão da coluna se nenhum card com lançamento financeiro ainda apontar para ela).

### Claude's Discretion
- Reusar `reordenarCardsAction` (Phase 16) diretamente para mover os cards, ou escrever uma Server Action nova que combina mover + excluir coluna numa chamada só — decisão de implementação, sem impacto observável para o usuário. Pesquisa deve confirmar a forma mais simples dado o que já existe.
- O escopo de cards a mover é sempre "todos os cards da coluna sendo excluída" (`column.cards.map(c => c.id)`), nunca filtrado por busca — diferente do escopo do botão "Reordenar" (que usa `matchingIds`). Não confundir os dois mecanismos.
- Janela de corrida entre "mover os cards" e "excluir a coluna" (alguém arrastar um card novo para a coluna nesse meio-tempo) — mesmo espírito de tolerância a janela pequena já documentado em `destravarParcelaAction`/`cancelarEventoCaucaoAction`; não é um caso a resolver com transação SQL nova.
- Copy exato do diálogo (título, texto do seletor, rótulo do botão) — dentro do design system já estabelecido.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Exclusão de coluna hoje
- `web/src/components/kanban/column.tsx` linhas ~143-175 — o `AlertDialog` atual, incluindo o aviso explícito "Os N imóveis dessa coluna também serão excluídos" (linha ~161) que esta fase substitui
- `web/src/components/kanban/board.tsx` — `handleDeleteColumn` (usa `persistOrRevert`, mesmo padrão a seguir)
- `web/src/lib/kanban/actions.ts` — `deleteColumnAction` (linha ~294-326, busca por "excluir a coluna") — hoje um `.delete()` direto, sem nenhuma pré-checagem de card
- `web/src/lib/kanban/visibilidade.ts` — `EXCLUSAO_COLUNA_BLOQUEADA_POR_LANCAMENTO`, a mensagem já usada quando o trigger de banco recusa (continua valendo para colunas com card com lançamento financeiro — este caso já é coberto, não reabrir)
- `supabase/migrations/20260728000000_init_schema.sql` — `column_id uuid not null references public.columns(id) on delete cascade` (linha ~59), o FK que causa o cascade hoje; **não precisa mudar** (D-03)

### Padrão a reusar (Phase 16)
- `web/src/components/kanban/reordenar-dialog.tsx` — `ReordenarDialog`, o componente de seleção de coluna a espelhar (Dialog + lista de `Button`s, sem `RadioGroup`)
- `web/src/lib/kanban/actions.ts` — `reordenarCardsAction` (busca por "Reordenação em massa"), o mecanismo de mover N cards para uma coluna de destino — candidato direto a reusar ou espelhar
- `.planning/phases/16-reordena-o-em-massa-e-arquivamento-sem-coluna/16-CONTEXT.md` — D-06 a D-11, as decisões originais do botão "Reordenar"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `reordenarCardsAction`/`reordenarCards` (Phase 16) — já faz exatamente "mover uma lista de cardIds para uma columnId", com cap defensivo e `Promise.all` — a única diferença é a origem da lista de `cardIds` (aqui: todos os cards da coluna sendo excluída, não os que batem com busca)
- `ReordenarDialog` — já é um Dialog + lista de colunas selecionáveis; a UI de escolher coluna de destino para excluir uma coluna é visualmente quase idêntica
- `persistOrRevert` (`board.tsx`) — mesmo padrão de escrita otimista com revert a seguir para a ação combinada mover+excluir

### Established Patterns
- **Nenhuma migração necessária** — esta fase é a primeira desde a Phase 4 que não precisa tocar o banco; puramente Server Action + componente React
- **D-04 (Phase 16)** já estabeleceu o precedente de "bloquear com mensagem em vez de orfanar", aplicado agora ao caso simétrico (sem coluna de destino disponível, em vez de sem coluna nenhuma no board)

### Integration Points
- `column.tsx` precisa saber a lista de TODAS as colunas do board (não só a própria) para popular o seletor de destino — `Board` já tem esse estado (`columns`) e precisa passá-lo para baixo, do mesmo jeito que `ReordenarDialog` já recebe `columns` como prop

</code_context>

<specifics>
## Specific Ideas

- Usuário: "hoje ao excluir uma coluna todos os cards dela são excluidos junto efeitos cascata, porém isso não pode acontecer, so deve ser possível excluir uma coluna se mudar o cards para outra coluna, não pode ter um efeito cascata" — motivação original, encontrada durante a verificação em produção da Phase 16
- Usuário escolheu explicitamente reusar o mecanismo do Reordenar dentro do próprio diálogo de exclusão, em vez de só bloquear e exigir mover manualmente antes

</specifics>

<deferred>
## Deferred Ideas

None — discussão ficou dentro do escopo da fase.

</deferred>

---

*Phase: 17-exclusão-de-coluna-sem-cascade-para-cards-ativos*
*Context gathered: 2026-08-27*
