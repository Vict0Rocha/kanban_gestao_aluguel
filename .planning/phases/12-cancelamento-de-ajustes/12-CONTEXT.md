# Phase 12: Cancelamento de ajustes - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning

<domain>
## Phase Boundary

A Phase 11 deu ao gestor uma forma de cancelar um pagamento marcado por engano (`tipo='pagamento'`), mas deixou de fora `tipo='acrescimo'` e `tipo='desconto'` — deliberadamente, porque o pedido original era só sobre pagamento. O usuário pediu agora para estender exatamente o mesmo mecanismo a acréscimo e desconto: "adicione a funcionalidade de cancelar nos ajustes também, tanto para acréscimos como para descontos, pode fazer da mesma maneira que foi feito para os pagamentos."

In scope:
- Botão "Cancelar" ao lado de cada lançamento `tipo='acrescimo'` **e** `tipo='desconto'`, dentro de `ParcelaHistoricoSheet` — mesmo local do botão de pagamento (Phase 11, D-05)
- Apagar de verdade o lançamento do banco — mesma reversão deliberada do padrão append-only já aberta pela Phase 11 (D-01), agora estendida a mais dois `tipo`
- Recalcular o status da parcela depois de apagar, reusando `recalcularEGravarStatus` — idêntico à Phase 11 (D-03)
- Confirmação simples, sem motivo obrigatório — idêntico à Phase 11 (D-04)
- Trava contra parcela conciliada, reusando `exigirParcelaNaoConciliada` — idêntico à Phase 11 (D-06)
- Generalizar o diálogo de confirmação da Phase 11 (`CancelarPagamentoDialog`) para um único componente que atende os três tipos (`pagamento`/`acrescimo`/`desconto`), com o texto adaptado por tipo

Explicitamente fora de escopo:
- `tipo='destrava'` — decisão explícita do usuário nesta discussão (ver D-01 abaixo): destrava é um registro de auditoria (quem destravou, quando, por quê), não um valor lançado por engano; apagá-lo removeria o rastro que CONCIL-04 garante hoje, sem desfazer o destravamento em si (a parcela já voltou para "paga" quando o Destravar aconteceu — apagar o registro não desfaz isso, só apaga a prova)
- Qualquer mudança em Conciliar/Destravar (Phase 7) ou no cancelamento de pagamento já existente (Phase 11) além de generalizar o diálogo compartilhado

Requirements: **CANAJU-01, CANAJU-02, CANAJU-03, CANAJU-04** (trabalho pós-milestone, mesmo grupo de INTEG/RELDED/CANPAG — nenhum requisito de v2.0 cobre esta fase)
</domain>

<decisions>
## Implementation Decisions

### Escopo: destrava fica de fora — decisão explícita do usuário nesta discussão
- **D-01 (usuário, explícito):** O botão "Cancelar" alcança `tipo='acrescimo'` e `tipo='desconto'`, mas **não** `tipo='destrava'`. O pedido original do usuário ("tudo que é adicionado para uma parcela precisa ter a opção de excluir") foi lido literalmente e checado contra destrava explicitamente — o usuário confirmou que destrava fica de fora, escolhendo a opção que preserva CONCIL-04 (histórico de destravas sempre visível). **Reversibility:** reversible — nada impede uma fase futura de reabrir essa discussão se o usuário mudar de ideia; nenhum dado é perdido por deixar destrava de fora agora.

### Herdado da Phase 11 sem mudança — usuário confirmou "mesma maneira"
- **D-02 (usuário, explícito, herdado de 11-CONTEXT.md D-01):** Cancelar apaga de verdade a linha em `parcela_lancamentos` — não lança um evento de estorno. Mesma reversão deliberada do princípio append-only, agora coberta para os três tipos que o usuário pode cancelar (pagamento, acréscimo, desconto). **Reversibility:** one-way — mesma rationale da Phase 11: a linha apagada não volta, sem registro de quem cancelou o quê.
- **D-03 (herdado de 11-CONTEXT.md D-02):** Cada lançamento tem seu próprio botão de cancelar — sem "cancelar tudo" de uma vez.
- **D-04 (herdado de 11-CONTEXT.md D-03):** Status da parcela recalculado a partir do que sobra no livro-razão (`recalcularEGravarStatus`/`statusDeParcela`/`somarLancamentos`) — nunca hardcoded.
- **D-05 (herdado de 11-CONTEXT.md D-04):** Confirmação simples, sem campo de motivo obrigatório.
- **D-06 (herdado de 11-CONTEXT.md D-05):** Botão dentro de `ParcelaHistoricoSheet`, ao lado de cada lançamento elegível — não na linha principal da tabela.
- **D-07 (herdado de 11-CONTEXT.md D-06):** Parcela conciliada nunca aceita cancelamento de lançamento nenhum, trava reusando `exigirParcelaNaoConciliada` no servidor.

### Diálogo de confirmação — decisão explícita do usuário nesta discussão
- **D-08 (usuário, explícito):** Generalizar o diálogo em vez de duplicar — um único componente (substituindo/renomeando `CancelarPagamentoDialog`) que recebe o `tipo` do lançamento e monta o texto certo ("Cancelar este pagamento?"/"Cancelar este acréscimo?"/"Cancelar este desconto?"), reusando os mesmos rótulos já centralizados em `LancamentoTipoLabel` (`TIPO[tipo].label` = "Pagamento"/"Acréscimo"/"Desconto"). Evita duplicar o componente três vezes; um único lugar concentra o comportamento de DELETE + recálculo de status.

### Claude's Discretion
- **Nome do componente generalizado e da Server Action:** fica a critério do planner/executor manter `cancelarPagamentoAction` como está (aceita `tipo` implicitamente pelo `id` do lançamento) ou generalizar o nome (ex.: `cancelarLancamentoAction`) — o comportamento da trava (`.eq("tipo", "pagamento")` hoje) precisa passar a aceitar os três tipos elegíveis (`in ["pagamento","acrescimo","desconto"]`), nunca destrava.
- **Texto exato de cada variante da confirmação:** fica para a UI-SPEC — só o princípio (reusar `LancamentoTipoLabel`, um componente só) está travado aqui.
- **Atualização de `docs/data-model.md`:** a entrada da Phase 11 sobre a segunda exceção ao livro-razão append-only deve ser atualizada para deixar claro que a exceção cobre `pagamento`/`acrescimo`/`desconto` (não mudou de "segunda" para "terceira" exceção — é a mesma exceção da Phase 11, só com escopo maior).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Padrão a reusar (não reimplementar)
- `web/src/lib/kanban/actions.ts` — `cancelarPagamentoAction` (a Server Action da Phase 11 a generalizar ou espelhar — hoje o DELETE está condicionado a `.eq("tipo", "pagamento")`, que precisa virar `.in("tipo", ["pagamento","acrescimo","desconto"])` ou equivalente), `exigirParcelaNaoConciliada`, `recalcularEGravarStatus`
- `web/src/lib/kanban/queries.ts` — `cancelarPagamento` (client wrapper da Server Action, Phase 11)
- `web/src/components/financeiro/cancelar-pagamento-dialog.tsx` — o diálogo a generalizar (D-08); note o bug real corrigido em produção nesta mesma sessão: `formatDate(data)` só deve ser chamado quando `data` não é vazio (o componente fica sempre montado mesmo sem lançamento selecionado)
- `web/src/components/financeiro/parcela-historico-sheet.tsx` — onde o botão "Cancelar" de pagamento já existe (`lancamento.tipo === "pagamento" && !parcelaConciliada`); a condição precisa virar `["pagamento","acrescimo","desconto"].includes(lancamento.tipo) && !parcelaConciliada`
- `web/src/components/financeiro/lancamento-tipo-label.tsx` — `TIPO[tipo].label`, os rótulos "Pagamento"/"Acréscimo"/"Desconto"/"Destrava" já centralizados, a reusar no texto do diálogo generalizado (D-08)

### Schema e migração
- `supabase/migrations/20260816000000_financeiro_schema.sql` — nenhuma migração nova necessária (mesmo raciocínio da Phase 11: nenhum tipo/coluna nova, RLS de `parcela_lancamentos` já cobre DELETE)

### Precedente documentado a citar
- `docs/data-model.md` — a entrada da Phase 11 sobre a segunda exceção ao livro-razão append-only, a atualizar para refletir o escopo maior (pagamento+acréscimo+desconto)
- `.planning/phases/11-cancelamento-de-pagamento/11-CONTEXT.md` — todas as decisões D-01 a D-06 herdadas aqui; especialmente `<deferred>` § "Cancelar lançamentos de ajuste", que é exatamente o pedido que abre esta fase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cancelarPagamentoAction`/`cancelarPagamento`: já implementam DELETE triplo-condicionado + recálculo de status — a generalização é trocar a condição de `tipo` de igualdade para uma lista, sem mudar mais nada da lógica.
- `LancamentoTipoLabel`: já centraliza o rótulo por tipo — o diálogo generalizado deve reusar essa fonte única, não duplicar os rótulos.

### Established Patterns
- Toda escrita financeira passa por Server Action com `requireUser()` + validação server-side.
- `erroDoBanco()`/`semLinhas()` sanitizam erro de banco e trava de corrida.
- DELETE condicionado (`.eq()`/`.in()`) como a trava de corrida real — nunca leitura seguida de escrita.

### Integration Points
- `parcela-historico-sheet.tsx` é o único lugar de UI que muda (mesma condição do botão, agora cobrindo 3 tipos em vez de 1) — nenhuma mudança em `parcelas-table.tsx`/`AcoesCell`.

</code_context>

<specifics>
## Specific Ideas

Frase-guia do usuário: "Não para para cancelas os ajustes gerados, adicione a funcionalidade de cancelar nos ajustes também, tanto para acréscimos como para descontos, pode fazer da mesma maneiro que foi feito para os pagamentos. Mas tudo que é adicionado para uma parcela, precisa ter a opção de excluir, as vezes o usuário fazer fazer alguma lançamento errado ou se arrepender."

</specifics>

<deferred>
## Deferred Ideas

- **Cancelar lançamentos `tipo='destrava'`** — explicitamente decidido como fora de escopo nesta discussão (D-01). Se o usuário reconsiderar depois de ver o comportamento atual em produção, precisaria reabrir essa decisão citando o impacto em CONCIL-04.
- **Rastrear dinheiro recebido pela imobiliária** (taxa de administração, primeiro aluguel, caução, taxas de gestão) — já registrado em `10-CONTEXT.md`/`11-CONTEXT.md` § Deferred, ainda não retomado.

### Reviewed Todos (not folded)
None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-Cancelamento de ajustes*
*Context gathered: 2026-08-21*
