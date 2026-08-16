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

- [ ] **Phase 4: Fundação financeira** - Banco aceita parcelas e lançamentos só de quem está na allowlist, recusa dado inválido por conta própria, e o modelo está documentado
- [ ] **Phase 5: Aba Financeiro com parcelas automáticas** - Abrir a aba mostra as parcelas do mês atual e do próximo mês de cada contrato ativo, sem clicar em "gerar"
- [ ] **Phase 6: Baixa e ajustes de parcela** - Registrar recebimento total ou parcial, multa e desconto, com histórico que nunca é sobrescrito
- [ ] **Phase 7: Conciliação e destrava rastreada** - Parcela conferida fica travada contra edição acidental; destravar sempre deixa rastro de quem, quando e por quê
- [ ] **Phase 8: Relatórios financeiros** - Pagas, a vencer, vencidas e conciliadas, com filtros combináveis por imóvel, proprietário e período

## Phase Details

### Phase 4: Fundação financeira
**Goal**: O banco guarda parcelas e lançamentos financeiros com a mesma proteção que já protege os cards, recusa dado financeiro inválido sozinho, e o modelo novo está explicado para quem chegar depois
**Depends on**: Nothing (primeira fase da v2.0; Phases 1-3 pertencem à v1.0)
**Requirements**: FINSEG-01, FINSEG-02, FINDOC-01
**Success Criteria** (what must be TRUE):
  1. A migração aplica limpo (`supabase db push`) sobre o banco de produção com os ~46 imóveis: nenhum card é apagado ou alterado, todos passam a ter `ativo = true` (nenhum nulo) e o board continua carregando exatamente como antes
  2. Um usuário autenticado **fora** da allowlist não lê nem grava nada em `parcelas` e `parcela_lancamentos` — a consulta volta vazia e a escrita é recusada; com um e-mail da allowlist, a mesma operação funciona (RLS via `is_team_member()`, a função que já cobre `cards` e `alerts`)
  3. O banco recusa sozinho, mesmo com o SQL escrito na mão: valor negativo, status fora de `aberta|parcial|paga|conciliada`, tipo de lançamento fora de `pagamento|acrescimo|desconto|destrava`, destrava sem motivo, e uma segunda parcela para o mesmo `(card_id, competencia)`
  4. `docs/data-model.md` mostra `parcelas` e `parcela_lancamentos` no diagrama de entidades e explica, no mesmo estilo "decisão + porquê" da seção existente, por que o financeiro é livro-razão append-only, por que a geração é preguiçosa em vez de cron, e por que `ativo` é flag manual em vez de derivada de `periodo_fim`
**Pilares cruzados**: esta fase é onde os pilares de segurança do módulo (FINSEG-01, FINSEG-02) passam a existir e a ser testáveis diretamente no banco; as fases seguintes não os re-implementam, mas cada uma confirma que continuam valendo quando a operação vem pela UI
**Plans**: 4 plans

Plans:
- [ ] 04-01-PLAN.md — Escrever a migração aditiva (`cards.ativo`, `parcelas`, `parcela_lancamentos`, 10 CHECK constraints, índice único, RLS via `is_team_member()`) e o runbook `supabase/verificacao_financeiro.sql`
- [ ] 04-02-PLAN.md — Ensaiar a migração no SQL Editor de produção dentro de uma transação desfeita no fim, provando RLS e CHECKs sem gravar nada
- [ ] 04-03-PLAN.md — Aplicar em produção com `supabase db push` (atrás de checkpoint de decisão) e conferir que nada quebrou
- [ ] 04-04-PLAN.md — Documentar as entidades e as três decisões não-óbvias em `docs/data-model.md`

### Phase 5: Aba Financeiro com parcelas automáticas
**Goal**: O gestor abre a aba Financeiro e já encontra as parcelas do mês atual e do próximo mês dos contratos ativos, sem ter pedido nada e sem risco de duplicar
**Depends on**: Phase 4
**Requirements**: CONTRATO-01, CONTRATO-02, PARCELA-01, PARCELA-02, PARCELA-03, PARCELA-04, FINUI-01, FINUI-02, FINUI-03
**Success Criteria** (what must be TRUE):
  1. Existe uma aba "Financeiro" na navegação, ao lado de Board e Relatórios, com visões separadas de "Mês atual" e "Próximo mês"; abri-la pela primeira vez no mês faz aparecerem as parcelas de cada contrato ativo nas duas visões, sem nenhum botão de "gerar"
  2. Reabrir e recarregar a aba várias vezes não duplica nada: continua uma parcela por contrato por competência
  3. Cada linha mostra, em português comum, a situação da parcela (a vencer ou vencida — calculada na leitura a partir do vencimento, não gravada), o valor devido e o valor já pago
  4. O contrato é marcado como ativo ou inativo direto no card do board, sem abrir o modal de edição; contrato inativo para de ganhar parcelas novas, e as parcelas que ele já tinha continuam listadas e acessíveis no Financeiro
  5. Nenhuma parcela aparece em competência fora do período do contrato (antes do início ou depois do fim), e mudar o valor do aluguel de um card não altera o valor de uma parcela já gerada — só a próxima nasce com o valor novo
**Pilares cruzados**: a geração grava com a sessão do usuário via Server Action, nunca `service_role`, então o RLS da Phase 4 continua sendo a rede de proteção; se a geração falhar, o usuário vê uma mensagem tratada e não o erro cru do Postgres
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 05-01: TBD

### Phase 6: Baixa e ajustes de parcela
**Goal**: O gestor registra o que recebeu — inteiro, em parte, com multa ou com desconto — e nenhum registro anterior é apagado ou sobrescrito no caminho
**Depends on**: Phase 5
**Requirements**: BAIXA-01, BAIXA-02, BAIXA-03, BAIXA-04, BAIXA-05, FINUI-04, FINSEG-03
**Success Criteria** (what must be TRUE):
  1. Dar baixa total sai em no máximo dois cliques a partir da lista (abrir a ação → confirmar), informando a data do pagamento, e a linha passa a mostrar "paga"
  2. Baixa parcial deixa a parcela como "parcial", com o valor já pago e o que ainda falta visíveis na própria linha; lançar depois o restante vira "paga" sozinho, sem ninguém editar a parcela na mão
  3. Lançar acréscimo (ex.: multa por atraso) ou desconto muda o valor devido mostrado na lista, e uma parcela que estava "paga" volta a "parcial" se o acréscimo passar a descobrir o valor
  4. Cada lançamento fica registrado com quem fez, quando e a observação digitada, e o histórico da parcela mostra todos eles; corrigir um erro é lançar algo novo por cima — nenhum lançamento antigo some, é editado ou é apagado
  5. Uma operação recusada pelo banco (ex.: valor negativo escapando da validação do formulário) chega ao usuário como frase em português comum, sem trecho de mensagem do Postgres, código de constraint ou nome de tabela
**Pilares cruzados**: critério 5 é onde FINSEG-03 (`erroDoBanco()`) fica de fato verificável, porque é a primeira operação em que o usuário consegue provocar uma recusa do banco; a mesma sanitização vale para as ações da Phase 7. A validação server-side espelha as CHECK constraints da Phase 4 — nenhuma regra financeira decidida só no cliente. Parcelas de contrato já inativo (CONTRATO-02) continuam aceitando baixa e ajuste normalmente
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 06-01: TBD

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
Phases execute in numeric order: 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 4. Fundação financeira | 0/4 | Planned | - |
| 5. Aba Financeiro com parcelas automáticas | 0/TBD | Not started | - |
| 6. Baixa e ajustes de parcela | 0/TBD | Not started | - |
| 7. Conciliação e destrava rastreada | 0/TBD | Not started | - |
| 8. Relatórios financeiros | 0/TBD | Not started | - |

**Cobertura de requisitos:** 28 de 28 requisitos da v2.0 mapeados, cada um para exatamente uma fase. `SEC-02` (Leaked Password Protection, herdado da v1.0) fica deliberadamente fora — é toggle no painel do Supabase, não trabalho de código.
