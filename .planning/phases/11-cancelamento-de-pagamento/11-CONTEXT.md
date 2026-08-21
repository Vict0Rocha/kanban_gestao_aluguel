# Phase 11: Cancelamento de pagamento - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Hoje, uma vez que um pagamento é registrado (`registrarPagamentoAction` grava um lançamento `tipo='pagamento'` em `parcela_lancamentos`), não existe nenhuma forma de desfazer — se o usuário marcou uma parcela como paga por engano, ela fica presa nesse estado. Esta fase adiciona um botão "Cancelar" ao lado de cada lançamento `tipo='pagamento'` no histórico da parcela, que apaga aquele lançamento específico do banco e recalcula o status da parcela a partir do que sobrar no livro-razão.

In scope:
- Botão "Cancelar" por lançamento `tipo='pagamento'`, dentro de `ParcelaHistoricoSheet` (o painel que já lista cada lançamento)
- Confirmação simples (sem motivo obrigatório) antes de apagar
- Apagar de verdade o lançamento do banco — reversão deliberada do padrão append-only usado no resto do sistema (ver D-01)
- Recalcular o status da parcela depois de apagar, reusando `recalcularEGravarStatus`/`statusDeParcela` já existentes — nunca hardcoded para "aberta"
- Trava contra parcela conciliada, reusando `exigirParcelaNaoConciliada` já existente

Explicitamente fora de escopo:
- Cancelar lançamentos `tipo='acrescimo'`/`tipo='desconto'` — o usuário pediu especificamente sobre "pagamento", não sobre ajustes. Se quiser estender depois, é pedido novo
- Qualquer mudança em Conciliar/Destravar (Phase 7) — este é um mecanismo novo e paralelo, não uma reforma do fluxo de conciliação
- Qualquer confirmação com motivo obrigatório (decisão explícita do usuário: confirmação simples)

Requirements: **CANPAG-01, CANPAG-02, CANPAG-03, CANPAG-04** (trabalho pós-milestone, mesmo grupo de INTEG/RELDED — nenhum requisito de v2.0 cobre esta fase)
</domain>

<decisions>
## Implementation Decisions

### Apagar, não estornar — decisão explícita do usuário, contra o padrão do resto do sistema
- **D-01 (usuário, explícito):** Cancelar um pagamento **apaga de verdade** a linha em `parcela_lancamentos` — não lança um evento de estorno que preserva o histórico. Isto é uma reversão deliberada do princípio append-only que todo o resto do módulo financeiro segue até aqui (mais claramente em Destravar, Phase 7, que desfaz uma conciliação lançando um evento novo, nunca apagando o registro antigo). Apontei esse trade-off diretamente ao usuário (perda de rastro de quem pagou/quando/quem cancelou) antes de perguntar — ele confirmou apagar mesmo assim. **Reversibility:** one-way — a linha apagada não volta, e ao contrário de Destravar não existe nenhum registro de que um pagamento foi cancelado (quem, quando, por quê). Se o usuário reconsiderar depois de ver isso em produção, a fase seguinte precisaria migrar para o padrão de estorno (nova coluna/tipo) sem conseguir recuperar o histórico já perdido nesse meio-tempo.
- **D-02 (usuário, explícito):** Cada lançamento `tipo='pagamento'` tem seu próprio botão de cancelar — não existe um botão único que apaga todos os pagamentos de uma parcela de uma vez. Se uma parcela tem dois pagamentos parciais e o usuário cancela um, o outro continua valendo (a parcela pode voltar para `parcial` em vez de `aberta` — decidido pelo recálculo de D-03 abaixo, não hardcoded).
- **D-03 (usuário, explícito):** Depois de apagar o lançamento, o status da parcela é **recalculado a partir do que sobra no livro-razão** — reusar `recalcularEGravarStatus`/`statusDeParcela`/`somarLancamentos` (`actions.ts`/`parcelas.ts`), os mesmos que `registrarPagamentoAction`/`ajustarParcelaAction` já usam. Nunca escrever `status='aberta'` direto — o resultado pode legitimamente ser `aberta` (zero pagamentos restantes) ou `parcial` (ainda sobra algum pagamento, mas menor que o devido).

### Confirmação — decisão explícita do usuário
- **D-04 (usuário, explícito):** Confirmação simples antes de apagar (ex.: "Cancelar este pagamento de R$X? Isso não pode ser desfeito."), **sem** campo de motivo obrigatório — diferente deliberadamente do padrão de Destravar (que exige motivo). Combina com o cenário que o usuário descreveu ("marcou sem querer, precisa reverter rápido") — e como o lançamento é apagado de verdade (D-01), não haveria onde guardar um motivo de qualquer forma.

### Local do botão — decisão explícita do usuário
- **D-05 (usuário, explícito):** O botão "Cancelar" fica dentro de `ParcelaHistoricoSheet` (o painel de histórico de lançamentos que já existe, ícone de relógio/histórico na tabela do Financeiro), ao lado de cada lançamento `tipo='pagamento'` especificamente — não um botão na linha principal da tabela (`AcoesCell`), porque a ação é por lançamento, não por parcela (consistente com D-02).

### Trava contra parcela conciliada — locked pelo próprio usuário no pedido original
- **D-06 (usuário, explícito, dado junto com o pedido da fase):** "Só não deve ser permitido qualquer alteração nas parcelas conciliadas." Reusar `exigirParcelaNaoConciliada` (`actions.ts:944`) — a mesma trava já usada por `registrarPagamentoAction`/`ajustarParcelaAction` (CONCIL-02/D-03 da Phase 7) — chamada no servidor, não só escondida na tela. Uma parcela conciliada não mostra o botão "Cancelar" nem aceita a Server Action se chamada direto.

### Claude's Discretion
- **Escopo de "qual parcela pode ter pagamento cancelado":** o botão aparece para qualquer lançamento `tipo='pagamento'` existente, independente da `situacao` atual da parcela ser `paga` ou `parcial` — não só quando `paga`. O usuário descreveu o caso "marcou como paga por engano", mas a mesma lógica por-lançamento (D-02) se aplica igualmente a um pagamento parcial que também foi um engano.
- **Race safety:** a Server Action nova deve reconsultar `status` da parcela E confirmar que o `parcela_lancamentos.id` específico ainda existe e ainda é `tipo='pagamento'` no momento do DELETE (não confiar em nenhum estado lido momentos antes pela UI) — mesmo padrão de defesa em profundidade já usado em `conciliarParcelaAction`/`destravarParcelaAction` (`.eq()` condicionando o próprio UPDATE/DELETE).
- **Cópia exata do botão/diálogo, ícone:** fica para a UI-SPEC — só o comportamento (confirmação simples, sem motivo) está travado aqui.
- **Atualização de `docs/data-model.md`:** esta fase abre uma segunda exceção ao princípio append-only documentado desde a Phase 4 (a primeira foi a poda de parcelas órfãs da Phase 9, D-01 daquela fase — mas aquela apagava linhas de `parcelas`, nunca `parcela_lancamentos`; esta é a primeira vez que uma linha do livro-razão em si é apagada). O planner deve incluir uma tarefa de documentação citando as duas exceções lado a lado, no mesmo estilo "decisão + porquê" já usado.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Padrão a reusar (não reimplementar)
- `web/src/lib/kanban/actions.ts` — `exigirParcelaNaoConciliada` (linha ~944, a trava a reusar), `recalcularEGravarStatus` (linha ~971, reconsulta TODOS os lançamentos e regrava `status` — chamar depois do DELETE, nunca hardcoded), `registrarPagamentoAction`/`ajustarParcelaAction` (linhas ~1016/~1076, o padrão de validação → trava de visibilidade → trava de conciliada → escrita → recálculo de status a seguir), `conciliarParcelaAction`/`destravarParcelaAction` (linhas ~1159/~1200, padrão de UPDATE/DELETE condicionado como trava de corrida real, não leitura-depois-escrita)
- `web/src/lib/kanban/parcelas.ts` — `statusDeParcela` (linha ~424, a régua exata de aberta/parcial/paga), `somarLancamentos` (linha ~395, soma tudo que resta depois do DELETE)
- `web/src/components/financeiro/parcela-historico-sheet.tsx` — o painel onde o botão novo entra, já lista cada lançamento com tipo/valor/data
- `web/src/components/financeiro/destravar-parcela-dialog.tsx` — analog mais próximo de um diálogo de confirmação de ação financeira consequente (ainda que este novo NÃO peça motivo, D-04)
- `web/src/components/financeiro/parcelas-table.tsx` — `AcoesCell` (linha ~36), para confirmar que o histórico continua acessível de todo estado de parcela e que nenhuma mudança é necessária nesse componente

### Schema e migração
- `supabase/migrations/20260816000000_financeiro_schema.sql` (linhas 160-200) — `parcela_lancamentos_tipo_valido` (`tipo in ('pagamento','acrescimo','desconto','destrava')`), `parcela_lancamentos_valor_nao_negativo`. D-01 (apagar, não estornar) significa que **nenhuma migração de schema é necessária** para esta fase — nenhum tipo novo, nenhuma coluna nova. RLS de `parcela_lancamentos` (`for all ... using is_team_member()`, Phase 4) já cobre `DELETE`, sem migração nova

### Precedente documentado a citar
- `docs/data-model.md` § "Por que nada é apagado quando uma parcela deixa de aparecer (D-03)" e a entrada da Phase 9 sobre a poda ativa — os dois precedentes de "quando o sistema já apagou algo de verdade" a citar ao escrever a nova entrada desta fase
- `.planning/phases/09-integridade-de-datas-do-contrato-nas-parcelas/09-CONTEXT.md` D-01 — a primeira vez que o projeto reverteu deliberadamente o princípio append-only (para linhas de `parcelas`, não `parcela_lancamentos`); útil para o planner entender o precedente de processo (avisar o trade-off, esperar confirmação explícita) já seguido aqui
- `.planning/phases/07-concilia-o-e-destrava-rastreada/07-CONTEXT.md` — o motivo original de Destravar NÃO apagar (D-04/D-05 daquela fase), para o planner citar corretamente o contraste no PLAN/na documentação

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `exigirParcelaNaoConciliada(supabase, parcelaId)`: já implementa exatamente a trava de D-06 — reconsulta `status` no servidor, recusa se `'conciliada'`. Chamar antes do DELETE, mesmo padrão de `registrarPagamentoAction`.
- `recalcularEGravarStatus(supabase, parcelaId)`: já implementa o D-03 inteiro — relê `valor_original` + TODOS os `parcela_lancamentos` restantes, calcula `statusDeParcela`, grava. Chamar logo depois do DELETE bem-sucedido, sem nenhuma lógica de status nova.

### Established Patterns
- Toda escrita financeira passa por Server Action com `requireUser()` + validação server-side — a action nova (`cancelarPagamentoAction` ou nome similar) segue o mesmo molde de `registrarPagamentoAction`.
- `erroDoBanco()`/`semLinhas()` (`actions.ts`) sanitizam erro de banco e trava de corrida — reusar, não criar mensagem nova.
- UPDATE/DELETE condicionado (`.eq("status", ...)`/`.eq("id", ...)`) como a trava de corrida real, não uma leitura seguida de escrita — mesmo padrão de `conciliarParcelaAction`.

### Integration Points
- `parcela-historico-sheet.tsx` é o único lugar novo de UI — recebe `lancamentos` já como prop (ver `parcelas-table.tsx:144-151`), então o botão "Cancelar" por linha só precisa saber o `id` de cada lançamento (já presente no shape de `LancamentoResumo`/histórico, a confirmar lendo o arquivo) e o `parcelaId` (já passado a outros diálogos irmãos).

</code_context>

<specifics>
## Specific Ideas

Frase-guia do usuário: "Hoje no sistema quando um usuário adiciona uma parcela como paga ele não consegue cancelar esse pagamento. É necessário uma funcionalidade de exclusão de um pagamento marcado como pago, às vezes o usuário pode marcar como pago sem querer e precisar cancelar para a parcela voltar. Só não deve ser permitido qualquer alteração nas parcelas conciliadas."

</specifics>

<deferred>
## Deferred Ideas

- **Cancelar lançamentos de ajuste (`acrescimo`/`desconto`)** — não pedido pelo usuário nesta conversa (ele falou especificamente de "pagamento"). Se quiser estender o mesmo mecanismo para ajustes depois, é uma extensão pequena do mesmo padrão, mas não decidida aqui.
- **Rastrear dinheiro recebido pela imobiliária** (taxa de administração, primeiro aluguel, caução, taxas de gestão) — já registrado como ideia futura em `10-CONTEXT.md` § Deferred, ainda não retomado.

### Reviewed Todos (not folded)
None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-Cancelamento de pagamento*
*Context gathered: 2026-08-21*
