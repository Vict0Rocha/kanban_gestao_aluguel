# Phase 7: Conciliação e destrava rastreada - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Esta fase entrega as duas últimas ações financeiras do módulo: **conciliar** (travar uma parcela já paga contra alteração acidental) e **destravar** (corrigir uma parcela conciliada, com motivo obrigatório e rastro de quem/quando/por quê). É a última peça do modelo de livro-razão desenhado desde a Phase 4 — `parcelas.status = 'conciliada'`, `conciliada_em`/`conciliada_by`, e `parcela_lancamentos.tipo = 'destrava'` já existem no schema e nas CHECK constraints, não usados até agora.

In scope:
- Ação "Conciliar" numa parcela com `status = 'paga'`: seta `status = 'conciliada'`, `conciliada_em = now()`, `conciliada_by = usuário atual` (CONCIL-01)
- Trava no servidor: qualquer tentativa de `registrarPagamentoAction`/`ajustarParcelaAction` sobre uma parcela `conciliada` é recusada, com mensagem em português simples dizendo que é preciso destravar antes (CONCIL-02)
- Ação "Destravar": exige `motivo` (não vazio, mesma regra da CHECK constraint `parcela_lancamentos_destrava_exige_motivo`), grava um lançamento `tipo = 'destrava'` com `motivo`/`criado_por`/`criado_em`, e devolve `status` para `paga` (CONCIL-03)
- Histórico de destravas visível na própria parcela — quem destravou, quando, motivo (CONCIL-04). `ParcelaHistoricoSheet` já lista lançamentos genericamente; só precisa garantir que o `motivo` de um `destrava` aparece nessa lista, não construir uma superfície nova

Explicitamente fora de escopo:
- Relatórios financeiros (parcelas conciliadas por período/proprietário) — Phase 8
- Qualquer forma de "conciliação bancária" real (importar extrato) — não é isso que "conciliar" significa neste projeto; é trava manual interna, conforme o próprio spec original
- Bulk/conciliar em massa — não pedido, uma parcela por vez, mesmo padrão de Pagamento/Ajustar

Requirements: **CONCIL-01, CONCIL-02, CONCIL-03, CONCIL-04**
</domain>

<decisions>
## Implementation Decisions

### Regra de negócio — já travada pelo spec original e pelo schema, não redesenhar

- **D-01:** Conciliar só é oferecido/aceito quando `status = 'paga'`. Não faz sentido travar algo em aberto ou parcial — a UI nem mostra a ação fora desse estado, e o servidor recusa de qualquer forma se for chamado direto.
- **D-02:** Conciliar grava `conciliada_em = now()` e `conciliada_by = <usuário da sessão>` — a CHECK constraint `parcelas_conciliada_rastreada` (já em produção desde a Phase 4) recusa `status = 'conciliada'` sem os dois preenchidos, então a trava de banco já existe; a Server Action só precisa preencher os dois campos corretamente.
- **D-03:** Ajustar/Pagamento numa parcela `conciliada` é recusado **no servidor**, não só escondido na tela — mesma disciplina de D-15 da Phase 6.2 (a interface é conveniência, a trava real é a Server Action reconsultando o banco).
- **D-04:** Destravar exige `motivo` não vazio — mesma regra que a CHECK constraint `parcela_lancamentos_destrava_exige_motivo` já impõe no banco. **Qualquer membro da allowlist pode destravar** (spec original explícito: "qualquer membro destrava, mas fica registrado") — não é uma ação restrita a quem conciliou.
- **D-05:** Destravar grava um lançamento `tipo = 'destrava'`, `valor = 0` (evento de estado, não movimento financeiro — já suportado pela CHECK constraint `parcela_lancamentos_tipo_valor_positivo`, que permite `valor = 0` só para `destrava`), e devolve `parcelas.status` para `'paga'` — o ponto de partida de onde a parcela tinha saído ao ser conciliada.
- **D-06:** O predicado de bloqueio de exclusão de contrato da Phase 6.2 (`cardTemLancamento`, "qualquer lançamento de qualquer tipo trava") já cobre `destrava` automaticamente — nenhum código novo é necessário nessa trava (documentado como D-17 em `06.2-CONTEXT.md`), só confirmar no plano desta fase que continua valendo.

### Interface — decisões desta sessão

- **D-07 (discutido com o usuário):** Conciliar é **um clique direto**, sem popup de confirmação — mesmo padrão de Pagamento/Ajustar hoje. Já existe Destravar (com motivo obrigatório) como caminho de correção, então uma confirmação extra em Conciliar seria fadiga de diálogo para uma ação reversível.
- **D-08 (Claude's discretion):** O badge `conciliada` (ícone `Lock`, `text-muted-foreground`) já existe em `parcela-situacao-badge.tsx`, construído na Phase 5 com antecedência para esta fase — reusar sem alterar. A UI-SPEC desta fase decide a forma exata de "Conciliar"/"Destravar" na linha da tabela (substituindo Pagamento/Ajustar quando a parcela está conciliada, ou desabilitando-os com explicação) — não travado aqui, é decisão de camada visual.
- **D-09 (Claude's discretion):** Conciliar e destravar continuam disponíveis independentemente do contrato estar ativo/inativo/arquivado — mesma filosofia de D-01/D-05 da Phase 6.2 (dinheiro que já entrou nunca fica preso atrás do estado do contrato). Uma parcela `conciliada` sempre tem lançamento, então a regra de visibilidade da Phase 6.2 já garante que ela nunca some da tela por causa de período/inativo/arquivado — só por filtro explícito de arquivado_em na query (D-08 da 6.2), que é sobre o CONTRATO desaparecer inteiro, não a parcela isoladamente.

### Claude's Discretion

- Forma exata do diálogo de Destravar (label do campo de motivo, placeholder, mensagem de erro se vazio) — segue o molde de `RegistrarPagamentoDialog`/`AjustarParcelaDialog` já estabelecido.
- Onde exatamente a mensagem de recusa (CONCIL-02) aparece na tela — mesmo slot de erro inline que os outros diálogos de parcela já usam (`text-sm text-destructive`), nenhuma superfície de erro nova.
- Se o histórico de destravas precisa de destaque visual distinto dentro de `ParcelaHistoricoSheet` (já lista lançamentos de outros tipos) ou se só listar `destrava` com seu `motivo` já satisfaz CONCIL-04 — decisão de UI-SPEC.
</decisions>

<specifics>
## Specific Ideas

- Filosofia do usuário, reafirmada nesta fase: "correção fácil, todos erram em algum momento" — destravar não é uma ação envergonhada ou escondida, é o caminho normal de corrigir um erro numa parcela já conciliada. A UI não deve tratar destravar como algo perigoso além do necessário (motivo obrigatório já é a fricção certa).
- Esta é a última fase que grava em `parcela_lancamentos` — depois dela, os quatro tipos (`pagamento`, `acrescimo`, `desconto`, `destrava`) estão todos alcançáveis, fechando o modelo de livro-razão desenhado desde a Phase 4.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/financeiro-modulo-prompt.md` — seções "O que 'conciliar' significa", "Regras de negócio" (itens 5 e 6, citados acima em D-01 a D-05), "Fase 3 — Ações financeiras" e "Fase 4 — UI"
- `.planning/ROADMAP.md` § Phase 7 — goal, 4 success criteria, "Pilares cruzados"
- `.planning/phases/06-baixa-e-ajustes-de-parcela/06-CONTEXT.md` — decisões já tomadas sobre o formato de Pagamento/Ajustar que esta fase deve espelhar (D-01 a D-09 de lá), e a nota explícita de que Phase 6 não constrói a trava de `conciliada` porque é job desta fase
- `.planning/phases/06.2-ciclo-de-vida-do-contrato/06.2-CONTEXT.md` — D-17 (a trava de exclusão de contrato já cobre `destrava` automaticamente) e D-01/D-05 (regra de visibilidade, override por lançamento)
- `supabase/migrations/20260816000000_financeiro_schema.sql` — `parcelas_conciliada_rastreada` (linha 80-81), `parcela_lancamentos_destrava_exige_motivo` (linha 191-192), `parcela_lancamentos_tipo_valor_positivo` (linha 190) — as três CHECK constraints das quais esta fase depende, já em produção
- `web/src/components/financeiro/parcela-situacao-badge.tsx` — badge `conciliada` já implementado (ícone `Lock`), construído na Phase 5 para esta fase
- `web/src/components/financeiro/lancamento-tipo-label.tsx` — rótulo de `destrava` já implementado
- `web/src/components/financeiro/parcela-historico-sheet.tsx` — já trata `destrava` especialmente na renderização de valor (`—` em vez de moeda); verificar se `motivo` precisa de tratamento parecido
- `web/src/lib/kanban/parcelas.ts` — `somarLancamentos`, `statusDeParcela`, comentário em `destrava` não entrar em nenhuma soma (linha ~310)
- `web/src/lib/kanban/actions.ts` — `registrarPagamentoAction`, `ajustarParcelaAction`, `exigirParcelaVisivel` (a trava de visibilidade da Phase 6.2, que esta fase NÃO substitui — a trava de `conciliada` é adicional, roda depois ou junto)
- `docs/data-model.md` — modelo de dados atual, decisões de design já documentadas
</canonical_refs>

<open_questions>
## Open Questions

None blocking. A forma exata da UI (diálogo de destravar, onde os botões aparecem na linha da parcela conciliada) fica para a UI-SPEC desta fase — ver Claude's Discretion acima.
</open_questions>
