# Roadmap: Kanban Aluguel — v2.0 Módulo Financeiro

## Overview

Esta milestone dá ao gestor controle mensal dos recebimentos de aluguel dentro do próprio sistema: parcelas geradas sozinhas, baixa em dois cliques, trava contra edição acidental e relatórios do que entrou, do que falta entrar e do que atrasou.

O roadmap deriva da spec aprovada em `.planning/financeiro-modulo-prompt.md` (decisões de produto já fechadas com o usuário em 2026-08-16 — não re-litigar). A ordem é fundação → capacidade → capacidade → capacidade → visão consolidada: cada fase depois da primeira entrega um fluxo que dá para abrir no navegador e conferir com a mão, porque **o projeto não tem suíte automatizada** — verificação é lint + build + teste manual.

Restrição que atravessa tudo: o app está **em produção com ~46 imóveis reais**. Migração é aditiva e retrocompatível (nada de apagar coluna, nada de default nulo), escrita passa por Server Actions com a sessão do usuário (nunca `service_role`), e estado derivado é calculado na leitura — sem job agendado, mesmo padrão já validado em `web/src/lib/kanban/alerts.ts`.

**Phases 1-3 foram a milestone v1.0** (estabilização e documentação, concluída). O histórico ficou em `REQUIREMENTS.md § Histórico: v1.0`; a numeração continua daqui, sem reiniciar.

### Desvios em relação à divisão de 6 fases da spec

A spec propôs schema → geração → Server Actions → UI → relatórios → documentação. Três ajustes, cada um por um problema concreto de sequenciamento:

1. **A fase de documentação (spec, Fase 6) foi absorvida pela Phase 4.** A própria spec, no pilar 4, diz que documentar "não é opcional nem fica para o final: documentar junto com a fase que introduziu a decisão". As três decisões que FINDOC-01 manda registrar — livro-razão append-only, geração preguiçosa sem cron, `ativo` como flag manual — são todas decisões de *modelo de dados*, tomadas e verificáveis na fase de schema. Deixá-las numa fase final significaria documentar de memória, semanas depois.
2. **Geração automática (spec, Fase 2) foi unida à listagem da aba Financeiro (parte da spec Fase 4).** O critério de aceite da spec para a geração é "abrir a aba pela primeira vez no mês cria as parcelas faltantes" — mas a aba só nasceria duas fases depois. Sem suíte automatizada, uma fase de geração sem rota não teria como ser verificada por ninguém.
3. **As Server Actions (spec, Fase 3) foram dissolvidas em duas fatias verticais** — baixa/ajustes (Phase 6) e conciliação/destrava (Phase 7) — cada uma com a sua UI. Mesmo motivo: uma Server Action sem gatilho na tela não é conferível manualmente. Também evita o formato "todas as ações numa fase, todas as telas na outra", em que nada funciona ponta a ponta até o fim.

O resultado são 5 fases em vez de 6, com o mesmo escopo e a mesma ordem de dependência.

## Phases

**Phase Numbering:**

- Integer phases (4, 5, 6…): Planned milestone work
- Decimal phases (5.1, 5.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 4: Fundação financeira** - Banco aceita parcelas e lançamentos só de quem está na allowlist, recusa dado inválido por conta própria, e o modelo está documentado
- [x] **Phase 5: Aba Financeiro com parcelas automáticas** - Abrir a aba mostra as parcelas do mês atual e do próximo mês de cada contrato ativo, sem clicar em "gerar"
- [x] **Phase 6: Baixa e ajustes de parcela** - Registrar recebimento total ou parcial, multa e desconto, com histórico que nunca é sobrescrito
- [ ] **Phase 6.1: Consulta financeira e geração por período** (INSERTED) - Vencendo hoje como padrão, filtros por proprietário/inquilino/período/ID, geração pelo período completo do contrato com backfill
- [ ] **Phase 7: Conciliação e destrava rastreada** - Parcela conferida fica travada contra edição acidental; destravar sempre deixa rastro de quem, quando e por quê
- [ ] **Phase 8: Relatórios financeiros** - Pagas, a vencer, vencidas e conciliadas, com filtros combináveis por imóvel, proprietário e período

## Phase Details

### Phase 4: Fundação financeira

**Goal**: O banco guarda parcelas e lançamentos financeiros com a mesma proteção que já protege os cards, recusa dado financeiro inválido sozinho, e o modelo novo está explicado para quem chegar depois
**Depends on**: Nothing (primeira fase da v2.0; Phases 1-3 pertencem à v1.0)
**Requirements**: FINSEG-01, FINSEG-02, FINDOC-01
**Success Criteria** (what must be TRUE):

  1. ✓ A migração aplica limpo sobre o banco de produção com os ~46 imóveis: nenhum card é apagado ou alterado, todos passam a ter `ativo = true` (nenhum nulo) e o board continua carregando exatamente como antes — aplicada via SQL Editor em 2026-08-17 (CLI não instalado; ver 04-03-SUMMARY.md), `cards_total`/`updated_at_max` idênticos ao pré-push
  2. ✓ Um usuário autenticado **fora** da allowlist não lê nem grava nada em `parcelas` e `parcela_lancamentos` — a consulta volta vazia e a escrita é recusada; com um e-mail da allowlist, a mesma operação funciona (RLS via `is_team_member()`, a função que já cobre `cards` e `alerts`) — confirmado contra o schema real, não só ensaiado
  3. ✓ O banco recusa sozinho, mesmo com o SQL escrito na mão: valor negativo, status fora de `aberta|parcial|paga|conciliada`, tipo de lançamento fora de `pagamento|acrescimo|desconto|destrava`, destrava sem motivo, e uma segunda parcela para o mesmo `(card_id, competencia)` — 10 constraints confirmadas por inventário (`pg_constraint`) + comportamento provado no ensaio (04-02); re-teste ativo pós-push não repetido, ver desvio #2 em 04-03-SUMMARY.md
  4. ✓ `docs/data-model.md` mostra `parcelas` e `parcela_lancamentos` no diagrama de entidades e explica, no mesmo estilo "decisão + porquê" da seção existente, por que o financeiro é livro-razão append-only, por que a geração é preguiçosa em vez de cron, e por que `ativo` é flag manual em vez de derivada de `periodo_fim`

**Pilares cruzados**: esta fase é onde os pilares de segurança do módulo (FINSEG-01, FINSEG-02) passam a existir e a ser testáveis diretamente no banco; as fases seguintes não os re-implementam, mas cada uma confirma que continuam valendo quando a operação vem pela UI
**Plans**: 4/4 plans executed

Plans:

- [x] 04-01-PLAN.md — Escrever a migração aditiva (`cards.ativo`, `parcelas`, `parcela_lancamentos`, 10 CHECK constraints, índice único, RLS via `is_team_member()`) e o runbook `supabase/verificacao_financeiro.sql`
- [x] 04-02-PLAN.md — Ensaiar a migração no SQL Editor de produção dentro de uma transação desfeita no fim, provando RLS e CHECKs sem gravar nada
- [x] 04-03-PLAN.md — Aplicar em produção via SQL Editor (checkpoint de decisão: `conferir-backup-antes`) e conferir que nada quebrou
- [x] 04-04-PLAN.md — Documentar as entidades e as três decisões não-óbvias em `docs/data-model.md`

### Phase 5: Aba Financeiro com parcelas automáticas

**Goal**: O gestor abre a aba Financeiro e já encontra as parcelas do mês atual e do próximo mês dos contratos ativos, sem ter pedido nada e sem risco de duplicar
**Depends on**: Phase 4
**Requirements**: CONTRATO-01, CONTRATO-02, PARCELA-01, PARCELA-02, PARCELA-03, PARCELA-04, FINUI-01, FINUI-02, FINUI-03
**Success Criteria** (what must be TRUE):

  1. ✓ Existe uma aba "Financeiro" na navegação, ao lado de Board e Relatórios, com visões separadas de "Mês atual" e "Próximo mês"; abri-la pela primeira vez no mês faz aparecerem as parcelas de cada contrato ativo nas duas visões, sem nenhum botão de "gerar" — confirmado em produção: 46 parcelas em agosto/2026, 45 em setembro/2026 (uma a menos por período de contrato, comportamento correto)
  2. ✓ Reabrir e recarregar a aba várias vezes não duplica nada: continua uma parcela por contrato por competência — confirmado com 3 recargas + navegação cruzada, contagens idênticas, zero duplicata
  3. ✓ Cada linha mostra, em português comum, a situação da parcela (a vencer ou vencida — calculada na leitura a partir do vencimento, não gravada), o valor devido e o valor já pago — confirmado visualmente pelo operador
  4. ✓ O contrato é marcado como ativo ou inativo direto no card do board, sem abrir o modal de edição; contrato inativo para de ganhar parcelas novas, e as parcelas que ele já tinha continuam listadas e acessíveis no Financeiro — pill sempre visível no card, escrita de uma única coluna (D-10) confirmada por leitura de código, comportamento confirmado pelo operador em produção
  5. ✓ Nenhuma parcela aparece em competência fora do período do contrato (antes do início ou depois do fim), e mudar o valor do aluguel de um card não altera o valor de uma parcela já gerada — só a próxima nasce com o valor novo — confirmado por 6 verificações SQL contra produção (0 fora do período, 0 divergência de valor) e observado no uso real (usuário editou valor de um contrato após a parcela já existir; parcela manteve o valor antigo, como esperado)

**Pilares cruzados**: a geração grava com a sessão do usuário via Server Action, nunca `service_role`, então o RLS da Phase 4 continua sendo a rede de proteção; se a geração falhar, o usuário vê uma mensagem tratada e não o erro cru do Postgres
**Plans**: 3/3 plans executed
**UI hint**: yes

Plans:

- [x] 05-01-PLAN.md — Fatia vertical: nav → rota `/financeiro` → geração preguiçosa das duas competências → lista do mês atual
- [x] 05-02-PLAN.md — Duas visões (Mês atual/Próximo mês), badge de situação de 5 estados e os três estados vazios distintos
- [x] 05-03-PLAN.md — Toggle ativo/inativo direto no card do Board, otimista e reversível

### Phase 6: Baixa e ajustes de parcela

**Goal**: O gestor registra o que recebeu — inteiro, em parte, com multa ou com desconto — e nenhum registro anterior é apagado ou sobrescrito no caminho
**Depends on**: Phase 5
**Requirements**: BAIXA-01, BAIXA-02, BAIXA-03, BAIXA-04, BAIXA-05, FINUI-04, FINSEG-03
**Success Criteria** (what must be TRUE):

  1. ✓ Dar baixa total sai em no máximo dois cliques a partir da lista (abrir a ação → confirmar), informando a data do pagamento, e a linha passa a mostrar "paga" — confirmado em produção
  2. ✓ Baixa parcial deixa a parcela como "parcial", com o valor já pago e o que ainda falta visíveis na própria linha; lançar depois o restante vira "paga" sozinho, sem ninguém editar a parcela na mão — confirmado em produção
  3. ✓ Lançar acréscimo (ex.: multa por atraso) ou desconto muda o valor devido mostrado na lista, e uma parcela que estava "paga" volta a "parcial" se o acréscimo passar a descobrir o valor — a sequência mais arriscada da fase, testada explicitamente e confirmada
  4. ✓ Cada lançamento fica registrado com quem fez, quando e a observação digitada, e o histórico da parcela mostra todos eles; corrigir um erro é lançar algo novo por cima — nenhum lançamento antigo some, é editado ou é apagado — histórico em Sheet lateral (06-02), confirmado
  5. ✓ Uma operação recusada pelo banco (ex.: valor negativo escapando da validação do formulário) chega ao usuário como frase em português comum, sem trecho de mensagem do Postgres, código de constraint ou nome de tabela — `erroDoBanco()` reaproveitado, confirmado por leitura de código

**Pilares cruzados**: critério 5 é onde FINSEG-03 (`erroDoBanco()`) fica de fato verificável, porque é a primeira operação em que o usuário consegue provocar uma recusa do banco; a mesma sanitização vale para as ações da Phase 7. A validação server-side espelha as CHECK constraints da Phase 4 — nenhuma regra financeira decidida só no cliente. Parcelas de contrato já inativo (CONTRATO-02) continuam aceitando baixa e ajuste normalmente
**Plans**: 2/2 plans executed
**UI hint**: yes

Plans:

- [x] 06-01-PLAN.md — Registrar pagamento (baixa total/parcial) e ajustar valor (acréscimo/desconto), com recálculo de status no servidor
- [x] 06-02-PLAN.md — Histórico de lançamentos da parcela (Sheet lateral) e verificação final contra produção

### Phase 06.1: Consulta financeira e geração por período (INSERTED)

**Goal:** O gestor abre o Financeiro e já vê as parcelas vencendo hoje, sem aplicar nada; quando precisa achar outra coisa, filtra por proprietário, inquilino, período ou ID do contrato. Contratos com prazo definido (início e fim) têm todas as parcelas do período geradas de uma vez, incluindo as já vencidas no passado.
**Requirements**: CONTRATO-03, PARCELA-05, PARCELA-06, CONSULTA-01, CONSULTA-02
**Depends on:** Phase 6
**Why inserted**: Feedback do usuário ao testar a Phase 6 em produção (2026-08-18) — pediu uma tela de consulta inspirada em ERPs profissionais (referência: Sienge) em vez do "mostra tudo de cara" herdado da Phase 5, mais duas regras de negócio novas sobre como as parcelas são geradas. Validado com sketch navegável (`.planning/sketches/001-consulta-financeiro/`, variante B escolhida) antes de formalizar.
**Success Criteria** (what must be TRUE):

  1. Abrir a aba Financeiro sem nenhum filtro mostra só as parcelas vencendo **hoje** — o seletor Mês atual/Próximo mês da Phase 5 (FINUI-02) é removido, não apenas escondido
  2. Usuário filtra por proprietário, inquilino, período e/ou ID do contrato — cada campo é opcional e só entra na busca se preenchido; aplicar um filtro troca a visão padrão pelo resultado, sem misturar os dois
  3. Cada contrato tem um ID sequencial (#1, #2, #3…) visível no card do Board e na consulta do Financeiro
  4. O vencimento de uma parcela nova segue o dia do mês de `periodo_inicio` do contrato; contratos sem `periodo_inicio` usam o dia 20
  5. Contrato com `periodo_inicio` **e** `periodo_fim` gera parcelas para todos os meses do período inteiro, incluindo os já passados (retroativo); contrato com só uma das duas datas, ou nenhuma, continua restrito a mês atual + próximo

**Pilares cruzados**: a geração retroativa (critério 5) reabre uma decisão que a spec original tinha fechado como "sem backfill" — o volume real de parcelas que isso cria em produção precisa ser medido (consulta SQL de pré-voo, mesmo espírito da Phase 4) antes do plano de execução assumir que é seguro rodar sem um portão de confirmação. FINSEG-01/02/03 continuam valendo sem re-implementação — esta fase só muda o que é gerado e como é consultado, não quem pode escrever
**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 06.1-01: TBD (run `/gsd-plan-phase 06.1` para quebrar em planos)

### Phase 7: Conciliação e destrava rastreada

**Goal**: Uma parcela já conferida fica protegida contra alteração acidental, e desfazer essa proteção sempre deixa rastro de quem, quando e por quê
**Depends on**: Phase 6
**Requirements**: CONCIL-01, CONCIL-02, CONCIL-03, CONCIL-04
**Success Criteria** (what must be TRUE):

  1. Conciliar só é oferecido para parcela já paga; ao conciliar, a linha passa a "conciliada" e mostra visualmente que está travada
  2. Tentar dar baixa, acréscimo ou desconto numa parcela conciliada é recusado com uma frase simples dizendo que é preciso destravar antes — e a recusa acontece no servidor, não só escondendo o botão na tela
  3. Destravar exige um motivo: com o campo vazio a ação não completa, e o motivo não é opcional em lugar nenhum do caminho
  4. Depois de destravada, a parcela volta a aceitar lançamentos, e a própria parcela mostra o histórico de destravas — quem destravou, quando e o motivo de cada uma

**Pilares cruzados**: a obrigatoriedade do motivo é garantida pela CHECK constraint da Phase 4, não só pelo formulário; a recusa de alterar parcela conciliada usa a mesma sanitização de erro validada na Phase 6
**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 07-01: TBD

### Phase 8: Relatórios financeiros

**Goal**: O gestor responde "quanto entrou, quanto ainda falta entrar e o que está atrasado" sem abrir o board nem contar parcela na mão
**Depends on**: Phase 7
**Requirements**: FINREL-01, FINREL-02, FINREL-03, FINREL-04, FINREL-05
**Success Criteria** (what must be TRUE):

  1. Existe um relatório financeiro com as quatro visões — pagas, a vencer, vencidas e conciliadas — cada uma com a contagem de parcelas e o total em dinheiro
  2. Os totais batem com o estado real do banco: dar baixa numa parcela e voltar ao relatório move ela de "a vencer" para "pagas" e atualiza os dois totais, sem passo intermediário de recalcular
  3. Filtros por imóvel, proprietário e período combinam entre si e nenhum reseta o outro — mesmo comportamento dos relatórios de contrato que já existem
  4. Uma parcela conta como vencida por causa da comparação entre vencimento e hoje, feita na leitura: ninguém precisa rodar nada para "virar o mês"

**Pilares cruzados**: o relatório é somente leitura e roda com a sessão do usuário, então o RLS da Phase 4 continua filtrando as linhas — um usuário fora da allowlist vê relatório vazio, não dado de terceiro
**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 08-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 4 → 5 → 6 → 6.1 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 4. Fundação financeira | 4/4 | Complete | 2026-08-17 |
| 5. Aba Financeiro com parcelas automáticas | 3/3 | Complete | 2026-08-17 |
| 6. Baixa e ajustes de parcela | 2/2 | Complete | 2026-08-18 |
| 6.1. Consulta financeira e geração por período (INSERTED) | 0/TBD | Not started | - |
| 7. Conciliação e destrava rastreada | 0/TBD | Not started | - |
| 8. Relatórios financeiros | 0/TBD | Not started | - |

**Cobertura de requisitos:** 33 de 33 requisitos da v2.0 mapeados, cada um para exatamente uma fase (28 originais − 1 substituído [FINUI-02] + 5 novos da Phase 6.1 + 1 = 33; ver REQUIREMENTS.md para a conta exata). `SEC-02` (Leaked Password Protection, herdado da v1.0) fica deliberadamente fora — é toggle no painel do Supabase, não trabalho de código.
