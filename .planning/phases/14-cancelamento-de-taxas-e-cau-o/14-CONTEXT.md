# Phase 14: Cancelamento de taxas e caução - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

A Phase 13 deixou a taxa da imobiliária (`taxas_imobiliaria`) e os eventos de caução
(`caucao_eventos`) estruturalmente isolados do livro-razão de `parcela_lancamentos` (D-04/D-06,
13-CONTEXT.md) — nenhuma tela existente mudou, e nenhum dos dois tinha mecanismo de cancelamento.
Esta fase reabre essas duas decisões de forma pontual, sem desfazer o isolamento estrutural:

- A taxa da imobiliária passa a **aparecer no histórico de lançamentos da parcela**
  (`ParcelaHistoricoSheet`), na mesma lista cronológica que pagamento/acréscimo/desconto, e ganha um
  botão "Cancelar" próprio — mesmo mecanismo já usado para os outros três tipos (Phases 11/12: DELETE
  real após confirmação simples).
- Cancelar um lançamento `tipo="pagamento"` (CANPAG, já em produção) passa a cancelar automaticamente
  a(s) taxa(s) vinculada(s) àquele pagamento específico — hoje elas ficam órfãs (taxa sobrevive ao
  pagamento que a gerou), porque `taxas_imobiliaria` só guarda `parcela_id`, não qual lançamento
  específico a gerou.
- Eventos de caução (`caucao_eventos`) ganham cancelamento, mas **só o evento mais recente** pode ser
  cancelado por vez — nunca um do meio do histórico. Cancelar o mais recente libera o cancelamento do
  que ficou novo mais recente, permitindo desfazer o ciclo inteiro, um passo de cada vez, sempre a
  partir do topo.

In scope:
- Taxa visível no histórico da parcela, misturada cronologicamente com os lançamentos existentes, com
  rótulo de origem (Administração / Comissão 1º aluguel)
- Botão "Cancelar" por taxa, mesma trava de parcela conciliada que já vale para pagamento/acréscimo/
  desconto (CONCIL-02)
- Cascata automática: cancelar um `pagamento` cancela a(s) taxa(s) daquele pagamento específico —
  exige nova coluna de ligação `taxas_imobiliaria` → `parcela_lancamentos` (hoje inexistente)
- Botão "Cancelar" no evento mais recente do histórico de caução, liberando o anterior a cada
  cancelamento (nunca cancelamento de um evento do meio da linha do tempo)
- Mesmo diálogo de confirmação simples já usado (`CancelarLancamentoDialog`): valor + tipo, sem motivo
  obrigatório, DELETE real, "não pode ser desfeito"

Explicitamente fora de escopo:
- Qualquer mudança no relatório de reconciliação (`/relatorios/imobiliaria`, Phase 13) além do que já
  acontece automaticamente por ele ler `taxas_imobiliaria`/`caucao_eventos` ao vivo — cancelar uma taxa
  ou evento de caução já os remove do relatório sem nenhum código novo ali
- Editar valor/data de uma taxa ou evento de caução já lançado — só cancelar (apagar) existe, mesmo
  princípio "corrigir é lançar de novo" do resto do sistema
- Cancelamento de eventos de caução do meio do histórico (D-05 abaixo trava isso deliberadamente)
- Refinamento mais amplo do relatório de reconciliação — segue adiado (ver 13-CONTEXT.md § Deferred),
  não é este pedido

Requirements: **CANIMOB-01, CANIMOB-02, CANIMOB-03, CANIMOB-04, CANIMOB-05** (trabalho pós-milestone,
mesmo grupo de INTEG/RELDED/CANPAG/CANAJU/IMOB — nenhum requisito de v2.0 cobre esta fase)
</domain>

<decisions>
## Implementation Decisions

### Onde a taxa aparece — decisão explícita do usuário
- **D-01:** No histórico da parcela, a taxa entra na **mesma lista cronológica** que pagamento/
  acréscimo/desconto — não uma seção separada. Rótulo próprio (ex.: "Taxa · Administração" / "Taxa ·
  Comissão 1º aluguel"), mesmo espírito do mapa `TAXA_ORIGEM`/`TaxaOrigemBadge` já criado em
  `dinheiro-imobiliaria-view.tsx` (13-07) — mas esta fase é a segunda tela a precisar rotular taxa por
  origem, então esse mapa deixa de ser "só desta view" (A-03, 13-07-PLAN.md) e deve virar um componente
  compartilhado, mesmo padrão de `CaucaoEventoLabel`/`LancamentoTipoLabel`.

### Trava de conciliada para cancelar taxa — decisão explícita do usuário
- **D-02:** Cancelar uma taxa é bloqueado quando a parcela está conciliada — mesma trava
  (`exigirParcelaNaoConciliada`) já usada por pagamento/acréscimo/desconto (CONCIL-02, D-03 em
  `cancelarLancamentoAction`). Nenhuma trava nova a inventar, reuso direto.

### Cascata pagamento → taxa — decisão explícita do usuário
- **D-03:** Cancelar um lançamento `tipo="pagamento"` (CANPAG) cancela automaticamente a taxa
  vinculada àquele pagamento específico — "fica junto automaticamente" (palavras do usuário). Hoje
  `taxas_imobiliaria` só guarda `parcela_id`, não qual `parcela_lancamentos.id` a gerou — uma parcela
  paga em partes pode acumular várias taxas, uma por baixa. Sem uma ligação explícita não dá para saber
  qual taxa cancelar junto com qual pagamento. **Consequência estrutural:** precisa de uma coluna nova
  em `taxas_imobiliaria` (nullable, FK para `parcela_lancamentos.id`) — migração aditiva, mesmo padrão
  de todas as anteriores (SQL Editor, ensaio em transação revertida, depois aplicar). Linhas de taxa já
  existentes em produção (geradas durante os testes da Phase 13) ficam com essa coluna `null` — não há
  como inferir retroativamente qual pagamento gerou qual taxa quando há mais de um por parcela; sem
  backfill. — **Reversibility:** one-way — muda o schema de produção, mas é aditiva (coluna nullable,
  nenhuma linha existente é reescrita ou apagada) e de baixo risco, mesmo padrão de toda migração
  anterior deste projeto.

### Cancelamento independente da taxa — decisão implícita, a confirmar no plano
- **D-04:** Além da cascata (D-03), a taxa também tem seu **próprio botão "Cancelar"** no histórico,
  igual aos outros três tipos — permite cancelar só a taxa, sem cancelar o pagamento que a gerou (ex.:
  o valor da taxa foi editado errado na hora da baixa, mas o pagamento em si está correto).

### Caução — só o mais recente, sequencialmente — decisão explícita do usuário
- **D-05:** No histórico de caução, só o **evento mais recente** pode ser cancelado por vez — nunca um
  do meio da linha do tempo. Motivo: `statusCaucao()` (`taxas.ts`) decide devolvida/usada pelo evento
  mais recente por `criado_em`; cancelar um evento do meio deixaria o saldo/status incoerente com essa
  leitura. **Porém** (nas palavras do usuário): "deve ser possível excluir tudo o histórico vindo do
  mais recente" — ou seja, a trava é sempre "só o topo atual", não "só uma vez": depois de cancelar o
  mais recente, o evento que sobrou no topo passa a ser cancelável, e assim por diante, permitindo
  desfazer o ciclo inteiro, evento por evento, sempre a partir do topo. Nunca um cancelamento "pulando"
  para o meio do histórico.

### Confirmação — decisão explícita do usuário
- **D-06:** O diálogo de confirmação para cancelar taxa ou evento de caução é o **mesmo padrão** já
  usado em `CancelarLancamentoDialog` (Phases 11/12): mostra valor e tipo, sem motivo obrigatório,
  texto "esta ação não pode ser desfeita", DELETE real ao confirmar. Generalizar o componente existente
  (mesmo espírito de D-08 em 12-CONTEXT.md, que já generalizou de 1 para 3 tipos) em vez de criar dois
  diálogos novos — mas caução e taxa não usam `parcela_lancamentos.tipo`/`LancamentoTipoLabel`, então a
  generalização final (um componente para os cinco tipos possíveis, ou dois componentes lado a lado com
  a mesma estrutura) fica para o pattern-mapper decidir com base no que já existe.

### Claude's Discretion
- **Nome exato da coluna nova em `taxas_imobiliaria`** (ex.: `lancamento_id`, `pagamento_id`) e se tem
  `on delete cascade`/`on delete set null` — fica para research/pattern-mapper/planner, seguindo o
  estilo de FK já usado no projeto.
- **Como a cascata é implementada** — o `DELETE` em `taxas_imobiliaria` dentro de
  `cancelarLancamentoAction` (quando `tipo="pagamento"`), ou uma constraint `on delete cascade` no
  banco que faz isso sozinho — fica para o planner decidir com base no padrão dominante do arquivo
  (`actions.ts` hoje faz tudo explicitamente em código, sem depender de cascade do banco para lógica de
  negócio).
- **Componentização exata do rótulo de origem de taxa** (D-01) — extrair `TAXA_ORIGEM`/
  `TaxaOrigemBadge` de `dinheiro-imobiliaria-view.tsx` para um arquivo compartilhado (mesmo padrão de
  `caucao-evento-label.tsx`) — fica para o pattern-mapper mapear o arquivo exato.
- **Como o botão "Cancelar" do evento mais recente de caução decide "sou eu o mais recente"** — reusar
  a mesma ordenação por `criado_em` que `statusCaucao()`/`CaucaoHistoricoSheet` (ordem ascendente) já
  fazem, comparando o id do último item da lista — fica para o planner.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Padrão de cancelamento a reusar (não reimplementar)
- `web/src/lib/kanban/actions.ts` — `cancelarLancamentoAction` (~linha 1415): o DELETE condicionado +
  trava de conciliada + recálculo de status a espelhar para a taxa (sem o recálculo — D-04 de
  13-CONTEXT.md continua valendo, taxa nunca aciona `recalcularEGravarStatus`)
- `web/src/components/financeiro/cancelar-lancamento-dialog.tsx` — o diálogo a generalizar/espelhar
  (D-06)
- `web/src/components/financeiro/parcela-historico-sheet.tsx` — onde a taxa entra na lista cronológica
  (D-01) e onde o botão "Cancelar" já existe para os três tipos elegíveis (linha ~107)
- `web/src/components/financeiro/caucao-historico-sheet.tsx` — onde o botão de cancelar do evento mais
  recente entra (D-05); hoje comentado explicitamente como "sem botão de cancelar por evento — caução é
  append-only sem mecanismo de cancelamento nesta fase" (linha ~33), comentário que esta fase invalida

### Estrutura de dados a estender
- `web/src/lib/kanban/taxas.ts` — `OrigemTaxa`, `statusCaucao()`/`saldoCaucao()` (a lógica de "mais
  recente" que D-05 depende); `TipoCaucao`, `CaucaoEventoDetalhado`
- `web/src/lib/kanban/parcelas.ts` — `LancamentoDetalhado`, `ParcelaComCard`, `LinhaParcela` — a taxa
  precisa entrar em algum desses tipos (ou um tipo irmão) para chegar até `ParcelaHistoricoSheet`
- `web/src/app/(app)/financeiro/page.tsx` — `SELECT_PARCELA_PADRAO`/`SELECT_PARCELA_FILTRADA` (linhas
  23-27) — hoje não trazem `taxas_imobiliaria`, precisam de um embed ou consulta irmã
- `supabase/migrations/20260824000000_dinheiro_imobiliaria.sql` — a migração original de
  `taxas_imobiliaria`/`caucao_eventos`, molde de CHECK/RLS a seguir na migração aditiva de D-03

### Precedente documentado a citar
- `.planning/phases/13-dinheiro-da-imobili-ria/13-CONTEXT.md` — D-04 (isolamento estrutural
  taxa/parcela) e D-06 (caução append-only) — as duas decisões que esta fase reabre pontualmente, sem
  desfazer o isolamento
- `.planning/phases/11-cancelamento-de-pagamento/11-CONTEXT.md` e
  `.planning/phases/12-cancelamento-de-ajustes/12-CONTEXT.md` — a primeira e segunda exceção ao
  livro-razão append-only; esta fase é a terceira (caução) e a extensão da primeira/segunda (taxa
  vinculada a pagamento)
- `docs/data-model.md` § livro-razão append-only — onde as exceções já são documentadas; esta fase
  precisa de uma nova entrada

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TIPO`/`LancamentoTipoLabel` (`lancamento-tipo-label.tsx`) — o mapa de rótulo por tipo que
  `CancelarLancamentoDialog` já usa (`TIPO[tipo].label`); o equivalente para taxa é o `TAXA_ORIGEM` de
  `dinheiro-imobiliaria-view.tsx` (a promover, D-01), e para caução é `CAUCAO_TIPO`/`CaucaoEventoLabel`
  (já existe, `caucao-evento-label.tsx`)
- `queries.ts` — `cancelarLancamento` (wrapper client-side de `cancelarLancamentoAction`) — mesmo
  padrão para as duas novas Server Actions desta fase

### Established Patterns
- Cancelamento é sempre DELETE real + confirmação simples sem motivo (D-06), nunca soft-delete/flag
- Toda trava de escrita financeira é reconsultada no servidor (nunca confiada ao estado do cliente) —
  mesmo padrão para a nova trava de "só o evento mais recente" de caução (D-05): o servidor precisa
  reconferir que o evento sendo cancelado é de fato o mais recente na hora do DELETE, não confiar que o
  botão só apareceu no evento certo na tela
- `taxas_imobiliaria`/`caucao_eventos` continuam nunca participando de `somarLancamentos`/
  `statusDeParcela` (D-04, 13-CONTEXT.md) — cancelar uma taxa não aciona `recalcularEGravarStatus`

### Integration Points
- `registrarPagamentoAction` (`actions.ts` ~linha 1169) — ponto onde a taxa é inserida; precisa passar
  a gravar a nova coluna de ligação (D-03) no mesmo INSERT
- `cancelarLancamentoAction` (`actions.ts` ~linha 1415) — ponto onde a cascata de D-03 entra, só para
  `tipo === "pagamento"` (acréscimo/desconto nunca geram taxa)

</code_context>

<specifics>
## Specific Ideas

Frases-guia do usuário:

> "Hoje no histórico de parcelas não aparece os pagamentos de comissão e nem da para cancelar. Quero
> que o pagamento da comissão aparece no histórico da parcela e que seja possível cancelar, igual as
> parcelas normais."

> "Sobre o caução também quero que seja possível cancelas [cancelar]."

> [sobre taxa órfã quando o pagamento é cancelado] "Fica junto automaticamente."

> [sobre cancelar caução do meio do histórico] "Só o mais recente (Recomendado). Porém deve ser
> possível excluir tudo o histórico vindo do mais recente." — confirma que a trava é sempre "o topo
> atual", aplicada repetidamente, não uma trava de "uma vez só".

</specifics>

<deferred>
## Deferred Ideas

None novo nesta discussão — o único item adiado do domínio (refinamento mais amplo do relatório de
reconciliação) já está registrado em `13-CONTEXT.md § Deferred` e continua fora do escopo desta fase.

### Reviewed Todos (not folded)
None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-Cancelamento de taxas e caução*
*Context gathered: 2026-08-26*
