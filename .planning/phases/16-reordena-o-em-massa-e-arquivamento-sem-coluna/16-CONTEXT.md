# Phase 16: Reordenação em massa e arquivamento sem coluna - Context

**Gathered:** 2026-08-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Duas capacidades independentes, agrupadas numa fase por pedido do usuário:

1. **Botão "Reordenar" no Board.** Ao lado do campo de busca (canto superior esquerdo), um botão abre um popup listando as colunas existentes do board. O usuário escolhe uma e confirma; todos os cards elegíveis (ver D-03) são movidos de uma vez para essa coluna.
2. **Card arquivado fica sem coluna.** Hoje `arquivarCardAction`/`desarquivarCardAction` nunca tocam `column_id` — o card volta para a mesma coluna em que estava antes de arquivar. Passa a ser: arquivar desvincula o card de qualquer coluna de verdade (`column_id` nulo no banco); desarquivar sempre atribui a primeira coluna do board (mais à esquerda, menor `position`), nunca a antiga.

Fora de escopo: qualquer mudança em drag-and-drop individual de card (`moveCardAction`/`handleDragEnd` em `board.tsx`) — continua exatamente como está, só ganha um caminho novo (bulk) ao lado do já existente (um card por vez).

</domain>

<decisions>
## Implementation Decisions

### Card arquivado sem coluna
- **D-01:** `column_id` em `public.cards` passa a ser nullable (`alter table ... alter column column_id drop not null`) — mudança de banco real, não só de aplicação. `arquivarCardAction` grava `column_id: null` junto com `arquivado_em` (hoje só grava `arquivado_em`); `desarquivarCardAction` grava `column_id: <id da primeira coluna do board>` junto com `arquivado_em: null`. — **Reversibility:** one-way — **rationale:** mudança de schema em produção (relaxar `not null`), aplicada via o mesmo ciclo ensaio→checkpoint:decision→apply→verify já usado em toda migração deste projeto; desfazer depois de cards já arquivados com `column_id` nulo exigiria backfill antes de poder recolocar o `not null`.
- **D-02:** Motivação confirmada durante a discussão (não só preferência estética): hoje, se uma coluna com um card arquivado ainda apontando pra ela for excluída, esse card arquivado é apagado de verdade em cascata (`on delete cascade` de `column_id`), sem nenhum aviso — porque a trava de exclusão de coluna (mesmo trigger `impedir_exclusao_de_card_com_lancamento`) só bloqueia quando existe lançamento financeiro real; um card arquivado sem histórico nenhum não bloqueia nada. Desvincular `column_id` no arquivamento fecha esse risco por construção — um card arquivado nunca mais é afetado por exclusão de coluna.
- **D-03:** "Primeira coluna" = a coluna com a menor `position` no board (mais à esquerda visualmente) — mesma ordem que `columns.map(...)` já usa no Board (`board.tsx`, `SortableContext`). Nenhuma coluna tem conceito de "ativa"/"inativa" no schema (`columns` só tem `id`/`board_id`/`name`/`position`/`created_at`) — "primeira coluna ativa" do pedido original do usuário significa simplesmente a primeira coluna existente, não um flag novo.
- **D-04 (Claude's Discretion, confirmar no planning):** Se o board não tiver nenhuma coluna no momento de desarquivar (caso raro, mas possível), bloquear a ação com mensagem clara ("Crie uma coluna antes de desarquivar") em vez de desarquivar com `column_id` nulo — um card `arquivado_em = null` mas sem coluna nenhuma ficaria invisível no Board (que só itera `column.cards`), um estado órfão pior do que recusar a ação.
- **D-05:** `Card.column_id` (`web/src/lib/kanban/types.ts`) muda de `string` para `string | null`. Verificado por leitura de código: nenhuma tela de Arquivados (`arquivados-view.tsx`, `/arquivados`) lê ou exibe `column_id` hoje — o campo não aparece em nenhum lugar fora do próprio Board (`board.tsx`, `column.tsx`, as Server Actions de mover/arrastar). O ripple de tornar o tipo nullable fica contido: Board já filtra `arquivado_em is null` na query (`app/(app)/page.tsx:25`), então um `column_id` nulo nunca aparece no `columns` state do Board.

### Botão "Reordenar" (bulk move)
- **D-06:** Rótulo do botão: "Reordenar" (nome exato pedido pelo usuário). Posição: mesma linha do `SearchField`, no topo do Board (`board.tsx`, dentro do `<div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-4 md:px-6">` que já envolve o campo de busca).
- **D-07:** Popup lista as colunas existentes do board (nome de cada uma), usuário seleciona uma e confirma — um único popup, sem uma segunda tela de "tem certeza?" depois (usuário escolheu explicitamente "só o popup já basta").
- **D-08:** Escopo dos cards movidos: **se há uma busca ativa no campo de busca, move só os cards em destaque (que batem com a busca); se não há busca ativa, move literalmente todos os cards do board.** Implementação natural: `matchingIds(columns, query)` (`web/src/lib/kanban/search.ts`) já devolve "todos" quando `query` está vazia (comentário existente em `board.tsx`: "query vazia bate com tudo") — a mesma função, chamada com o `query` atual do campo de busca, resolve os dois casos do pedido do usuário sem precisar de um branch client-side separado.
- **D-09:** Cards arquivados nunca entram no escopo — já são excluídos da query do Board (`arquivado_em is null`, `app/(app)/page.tsx:25`), então nunca aparecem no `columns` state que alimenta a busca/seleção. Nenhuma mudança extra necessária para isso.
- **D-10 (Claude's Discretion):** Ordem dos cards dentro da coluna de destino depois do bulk move — sugestão: preservar a ordem visual atual (coluna por coluna, da esquerda pra direita, e dentro de cada coluna por `position` crescente), atribuindo posições novas sequenciais (mesmo `GAP=1000` de `position.ts`) a todos os cards movidos, incluindo os que já estavam na coluna de destino (evita ter que distinguir "já estava lá" de "está chegando").
- **D-11:** Reusar o padrão de Server Action já existente para mover card (`moveCardAction`, `web/src/lib/kanban/actions.ts:546`) como referência direta — a ação nova é uma versão em lote: recebe uma lista de `cardId`s + a coluna de destino, grava `column_id`+`position` para cada um. Escrita otimista no cliente (mesmo padrão de `persistOrRevert` já usado em `board.tsx` para outras mutações), revertendo o board inteiro se a Server Action falhar.

### Claude's Discretion
- Desenho visual exato do popup (Dialog vs. outro padrão) — dentro do design system já estabelecido (`components/ui/dialog.tsx`, mesmo padrão de outros diálogos de seleção do projeto)
- Nome exato da Server Action/query wrapper nova (ex.: `moverTodosCardsAction`/`reordenarCardsAction`) — convenção de nomenclatura já estabelecida no projeto
- Se a Server Action bulk deve ser uma única query (`update ... where id = any(...)`) ou N updates individuais — decisão de implementação, sem impacto observável para o usuário

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema de colunas/cards
- `supabase/migrations/20260728000000_init_schema.sql` — criação original de `columns`/`cards`, `column_id uuid not null references public.columns(id) on delete cascade` (linha ~59)
- `supabase/migrations/20260819000000_cards_arquivado_em.sql` — `impedir_exclusao_de_card_com_lancamento()`, o trigger que hoje NÃO bloqueia exclusão de coluna com card arquivado sem histórico financeiro (a lacuna que motiva D-01/D-02)
- `supabase/migrations/20260826010000_relaxar_exclusao_destrava.sql` — migração mais recente sobre o mesmo trigger (Phase 15), padrão de `create or replace function` a seguir se qualquer ajuste no trigger for necessário (não previsto, mas é o precedente mais recente)

### Board / bulk move
- `web/src/components/kanban/board.tsx` — `Board`, `handleDragEnd`/`handleDragOver` (padrão de mover card individual), `persistOrRevert` (escrita otimista com revert), a linha do `SearchField` (~362) onde o botão "Reordenar" entra
- `web/src/lib/kanban/search.ts` — `matchingIds`/`isSearching`, já usado para destacar cards na busca; reusar para o escopo do bulk move (D-08)
- `web/src/lib/kanban/position.ts` — `positionBetween`, `GAP = 1000`, fractional indexing já usado em todo o board
- `web/src/lib/kanban/actions.ts:546` (`moveCardAction`) — padrão de validação/gravação a espelhar para a ação em lote

### Arquivamento
- `web/src/lib/kanban/actions.ts:730` (`arquivarCardAction`) e `:759` (`desarquivarCardAction`) — as duas funções a alterar
- `web/src/lib/kanban/types.ts` — `Card.column_id: string`, a mudar para `string | null`
- `app/(app)/page.tsx:25` — `.is("cards.arquivado_em", null)`, confirma que o Board nunca carrega card arquivado (logo nunca vê `column_id` nulo)
- `.planning/phases/06.2-ciclo-de-vida-do-contrato/06.2-CONTEXT.md` — D-12 original ("arquivar e ativo são ortogonais", "desarquivar devolve ao funcionamento normal") — esta fase estende D-12 para incluir `column_id` na mesma lógica de "devolver ao funcionamento normal", sem contradizer a ortogonalidade com `ativo`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `persistOrRevert` (`board.tsx`) — escrita otimista com revert em caso de falha, já usado por toda mutação do Board; a ação de bulk move deve seguir o mesmo padrão
- `matchingIds`/`isSearching` (`search.ts`) — resolve o escopo do bulk move (D-08) sem lógica nova
- `positionBetween`/`GAP` (`position.ts`) — mesmo esquema de posições fracionárias para as posições novas dos cards movidos

### Established Patterns
- **Server Action + query wrapper + validação com `id()`/`numeroFinito()`** — todo mutador de `actions.ts` segue esse molde (`moveCardAction` como referência mais próxima)
- **`create or replace function` sobre schema existente nunca se aplica aqui** — D-01 é um `alter column ... drop not null`, tipo de mudança novo neste projeto (nenhuma migração anterior relaxou uma constraint `not null`); ainda assim segue o mesmo ciclo ensaio→checkpoint:decision→apply→verify

### Integration Points
- `arquivarCardAction`/`desarquivarCardAction` precisam do `board_id` do card (via a própria linha de `cards` ou um join) para buscar a primeira coluna **daquele board** — hoje o projeto tem um único board (`.planning/PROJECT.md`, "board único, sem isolamento entre clientes"), mas a query deve ser explícita por `board_id`, não presumir globalmente

</code_context>

<specifics>
## Specific Ideas

- Usuário: "Adicione um botão para reordenar os card no board no canto superior esquerdo ao lado do imput de busca... O botão deve se chamar reordenar." — nome e posição exatos
- Usuário: "Caso tenha alguma busca ativa, move somente os que estão em destaque na busca. Caso não tenha nenhuma busca, move todos os cards por padrão." — resposta literal que define D-08
- Usuário: "Quanto um card é arquivado, ele não precisa estar vinculado a nenhuma coluna do Kanban. Ele simplesmente desativa e não tem mais relação nenhuma com o [column]." — motivação original de D-01, reforçada pelo achado de D-02 (risco de exclusão em cascata)

</specifics>

<deferred>
## Deferred Ideas

None — discussão ficou dentro do escopo da fase.

</deferred>

---

*Phase: 16-reordenação-em-massa-e-arquivamento-sem-coluna*
*Context gathered: 2026-08-27*
