---
phase: 09-integridade-de-datas-do-contrato-nas-parcelas
plan: 01
subsystem: database
tags: [supabase, server-actions, delete, nextjs, react, alert-dialog]

# Dependency graph
requires:
  - phase: 06.2-ciclo-de-vida-do-contrato
    provides: avaliarVisibilidadeParcela (regra de "esconder" que esta fase estreita, não substitui) e competenciaNoPeriodo/competenciasAlvo em parcelas.ts
  - phase: 08-relatorios-financeiros
    provides: a query sem filtro de período que revelou as 27 parcelas órfãs em produção, motivando esta fase
provides:
  - "parcelaOrfaApagavel/semNenhumaData/ParcelaCandidataPoda em parcelas.ts — critério único de D-01/D-02/D-03"
  - "poda síncrona dentro de updateCardAction (D-04) apagando de verdade parcelas órfãs no mesmo salvamento"
  - "contarParcelasOrfasAction/contarParcelasOrfas — pré-voo consultivo read-only para o diálogo de confirmação"
  - "confirmação D-05 em CardDetailDialog: AlertDialog 'Esta alteração vai apagar parcelas' com fail-closed no pré-voo"
  - "D-06/D-07: contrato sem nenhuma data gera só o mês atual, sem apagar retroativamente o que já existia"
affects: [09-02-limpeza-orfas-existentes, financeiro, relatorios]

# Actuals (#2632)
actuals:
  tokens: 5161
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Poda síncrona dentro da mesma Server Action que grava o campo que a motiva (D-04) — não preguiçosa como a geração"
    - "Critério de exclusão sempre reconsultado no momento do DELETE, nunca recebido de fora da função que executa o delete (defesa contra corrida pré-voo × confirmação)"
    - "Pré-voo consultivo fail-closed quando o servidor já vai executar uma ação destrutiva de verdade (ao contrário dos pré-voos fail-open já existentes, que são só backstop de UX)"

key-files:
  created: []
  modified:
    - web/src/lib/kanban/parcelas.ts
    - web/src/lib/kanban/actions.ts
    - web/src/lib/kanban/queries.ts
    - web/src/components/kanban/card-detail-dialog.tsx

key-decisions:
  - "Task 1 (checkpoint:decision): usuário escolheu 'implementar-agora' — autoriza a poda ativa (DELETE real, sem desfazer) exatamente pelo critério de D-02, sem reabrir a discussão"
  - "podarParcelasOrfas nunca recebe lista de ids de fora — reconsulta o conjunto de candidatas na hora do delete, e o próprio .delete() reafirma .eq('status','aberta') como segunda camada"
  - "Pré-voo (contarParcelasOrfasAction) é só consultivo — nunca é a lista usada pelo delete real, que sempre roda dentro de updateCardAction"
  - "Falha no pré-voo do diálogo de confirmação é fail-closed: handleSubmit nunca chama onSave sem uma contagem confirmada do servidor"

patterns-established:
  - "salvarCard() em CardDetailDialog: sequência de salvamento compartilhada entre o caminho sem fricção (sem mudança de data / 0 órfãs) e o AlertDialogAction de confirmação, parametrizada só pelo texto de fallback do erro"

requirements-completed: [INTEG-01, INTEG-02, INTEG-03, INTEG-04]

coverage:
  - id: D1
    description: "parcelaOrfaApagavel/semNenhumaData em parcelas.ts implementam o critério único de D-01/D-02/D-03/D-06/D-07"
    requirement: INTEG-01
    verification:
      - kind: other
        ref: "grep de fonte: export function parcelaOrfaApagavel, export function semNenhumaData, competenciaNoPeriodo(competencia, novoInicio, novoFim) em parcelas.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "updateCardAction apaga de verdade, no mesmo salvamento, as parcelas órfãs quando periodo_inicio/periodo_fim mudam de valor (D-04)"
    requirement: INTEG-02
    verification:
      - kind: other
        ref: "npm run lint && npm run build (web/) — código 0"
        status: pass
    human_judgment: true
    rationale: "DELETE real e irreversível em produção — precisa de confirmação visual do diálogo e prova por SQL Editor de que a exclusão aconteceu de verdade, não só que a tela parou de mostrar a linha (ver human-check da Task 3)"
  - id: D3
    description: "Confirmação D-05 em CardDetailDialog: diálogo só aparece quando há órfã apagável, copy exata do UI-SPEC, fail-closed no pré-voo"
    requirement: INTEG-03
    verification:
      - kind: other
        ref: "grep CONFIRMACAO_OK (contarParcelasOrfas, 'Esta alteração vai apagar parcelas', 'Confirmar e salvar', 'Verificando', variant=\"destructive\", 'Não foi possível confirmar as mudanças no período') — todas as 6 asserções passaram"
        status: pass
    human_judgment: true
    rationale: "Requer walkthrough visual em produção (singular/plural, Cancelar preservando datas, contagem certa) e prova por SQL de que a parcela realmente sumiu do banco — ver human-check abaixo"
  - id: D4
    description: "Contrato sem nenhuma data gera só a parcela do mês atual (D-06), sem apagar retroativamente parcelas de próximo mês já geradas antes desta fase (D-07)"
    requirement: INTEG-04
    verification:
      - kind: other
        ref: "grep de fonte: semNenhumaData(card) em competenciasAlvoParaCard (parcelas.ts) + npm run build tipando limpo"
        status: pass
    human_judgment: true
    rationale: "Verificação funcional exige abrir um contrato de teste sem data em produção e confirmar visualmente que só uma competência é gerada — ver human-check abaixo"

duration: ~25min
completed: 2026-08-20
status: complete
---

# Phase 9 Plan 1: Integridade de datas do contrato nas parcelas Summary

**Poda síncrona real (DELETE, não só esconder) de parcelas órfãs dentro de `updateCardAction`, com confirmação explícita no `CardDetailDialog` antes de qualquer exclusão, mais o fallback "sem data = só mês atual" em `competenciasAlvoParaCard`.**

## Performance

- **Duration:** ~25min (Task 3 apenas, nesta execução — Tasks 1/2 já haviam sido concluídas em sessão anterior)
- **Tasks:** 3/3 (Task 1 checkpoint:decision, Task 2 tracer, Task 3 auto)
- **Files modified:** 4

## Accomplishments

- Reverteu deliberadamente D-03 (`docs/data-model.md`, Phase 6.2): editar `periodo_inicio`/`periodo_fim` de um card com parcelas geradas agora apaga de verdade — não só esconde — as que ficaram fora do novo período, desde que `status='aberta'` E zero `parcela_lancamentos`
- `parcelaOrfaApagavel` (`parcelas.ts`) é a única implementação do critério de D-02, reusada tanto pela poda síncrona quanto pelo pré-voo consultivo — reaproveita `competenciaNoPeriodo` negada, nunca reimplementa a comparação de datas
- Poda roda dentro da mesma Server Action que grava o período (`updateCardAction`, D-04) — só quando `periodo_inicio`/`periodo_fim` realmente mudam de valor nesta gravação, nunca em toda edição de card
- `podarParcelasOrfas` sempre reconsulta o conjunto de candidatas no momento do delete (nunca recebe lista de ids de fora) e o próprio `.delete()` reafirma `.eq("status", "aberta")` como segunda camada de defesa
- Confirmação D-05 em `CardDetailDialog`: botão mostra "Verificando..." durante o pré-voo, diálogo "Esta alteração vai apagar parcelas" (singular/plural) aparece só quando há órfã apagável, "Confirmar e salvar" é `variant="destructive"`, Cancelar só fecha o diálogo de confirmação preservando as datas editadas
- Pré-voo fail-closed: uma falha em `contarParcelasOrfas` nunca deixa o formulário prosseguir para `onSave` sem uma contagem confirmada
- D-06/D-07: contrato sem nenhuma data (`periodo_inicio` E `periodo_fim` ambos nulos) passa a gerar só a competência do mês atual; um contrato só com `periodo_inicio` (prazo indeterminado) continua sem mudança; nenhuma parcela de "próximo mês" já gerada antes desta fase é apagada retroativamente

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Autorizar a implementação da poda ativa** — `checkpoint:decision`, resolvida com `implementar-agora`; sem commit de código próprio (decisão registrada no checkpoint, não altera arquivos)
2. **Task 2: Poda síncrona de parcelas órfãs em updateCardAction + pré-voo consultivo** — `02dc4e6` (feat) — committed diretamente pelo orquestrador depois de um problema de infraestrutura de isolamento de worktree destruir o worktree do executor original a meio da task; código revisado contra o plano e verificado com lint/build antes do commit
3. **Task 3: Confirmação antes de apagar (D-05) no diálogo de detalhes do card** — `91712c0` (feat)

## Files Created/Modified

- `web/src/lib/kanban/parcelas.ts` — `ParcelaCandidataPoda`, `parcelaOrfaApagavel`, `semNenhumaData`; ramo de D-06 em `competenciasAlvoParaCard`
- `web/src/lib/kanban/actions.ts` — `podarParcelasOrfas` (função interna), leitura pré-UPDATE de período em `updateCardAction`, disparo condicional da poda, `contarParcelasOrfasAction` (Server Action nova)
- `web/src/lib/kanban/queries.ts` — `contarParcelasOrfas` (bridge para `contarParcelasOrfasAction`)
- `web/src/components/kanban/card-detail-dialog.tsx` — estado `PodaEstado` (idle/verificando/confirmando/falhou), `salvarCard()` compartilhado, `handleSubmit` estendido para disparar o pré-voo só quando as datas mudam, `AlertDialog` de confirmação D-05 aninhado

## Decisions Made

- **Task 1:** usuário escolheu `implementar-agora` — autoriza a poda ativa (DELETE real, sem desfazer) exatamente pelo critério de D-02 (`status='aberta'` E zero `parcela_lancamentos` E fora do novo período, nas duas direções), sem reabrir a discussão nem restringir a apenas "encurtar o fim"
- `podarParcelasOrfas` loga via `console.error("podarParcelasOrfas: parcelas apagadas", ...)` os ids apagados a cada chamada — backstop mínimo de auditoria, já que D-01 é uma exceção deliberada ao livro-razão append-only do resto do projeto (T-09-03, disposition `accept`)
- `salvarCard()` (Task 3) foi extraído como função compartilhada entre o `handleSubmit` sem fricção e o `AlertDialogAction` de confirmação, parametrizado só pelo texto de fallback do erro — evita duplicar a sequência `setSaving` → `onSave` → `onOpenChange(false)` → `catch`/`finally` em dois lugares

## Deviations from Plan

### Auto-fixed Issues

Nenhum desvio de Rule 1-4 durante a execução da Task 3 nesta sessão — implementação seguiu o `<action>` da Task 3 ao pé da letra (estado `PodaEstado`, `salvarCard` compartilhado, AlertDialog aninhado com copy exata do UI-SPEC).

**Nota operacional (não é uma deviation de código):** a Task 2 foi commitada diretamente pelo agente orquestrador em vez do executor original, por causa de um problema de infraestrutura (worktree destruído a meio da task, não uma falha do código ou do plano). O código do commit `02dc4e6` foi revisado linha a linha contra o `<action>` da Task 2 e verificado com `npm run lint`/`npm run build` antes do commit — confirmado nesta sessão por leitura direta do diff (`git show 02dc4e6`) e por releitura do estado atual de `actions.ts`/`parcelas.ts`/`queries.ts`, que bate exatamente com o texto do plano.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** Nenhum — plano executado exatamente como escrito.

## Issues Encountered

- `node_modules/` não existia no worktree desta sessão (`npm run lint`/`npm run build` falhavam com "eslint não é reconhecido"). Resolvido com `npm ci` (610 pacotes, ~44s) antes de rodar a verificação — não é uma deviation de código, só um passo de setup do ambiente do worktree.

## Known Stubs

Nenhum. O caminho de dados é real de ponta a ponta: `contarParcelasOrfas` consulta o banco de verdade, `podarParcelasOrfas` executa o DELETE de verdade, nenhuma UI foi montada sobre dado mockado.

## Threat Flags

Nenhuma superfície nova fora do `<threat_model>` já registrado no PLAN.md (T-09-01 a T-09-05, T-09-SC) — a Task 3 só adiciona UI sobre a Server Action já mitigada na Task 2, sem novo endpoint nem novo caminho de escrita.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Pronto:** Tasks 1, 2 e 3 completas, commitadas, `npm run lint`/`npm run build` verdes na raiz de `web/`, todas as asserções de grep dos `<verify><automated>` de Task 2 e Task 3 passaram.
- **Pendente (human-check da Task 3, não pode ser automatizado por este agente):** verificação em produção descrita no `<human-check>` da Task 3 do `09-01-PLAN.md` — (1) encurtar `periodo_fim`/avançar `periodo_inicio` de um contrato de teste sem lançamento que já tenha parcelas em vários meses, confirmar que o botão mostra "Verificando...", que o diálogo "Esta alteração vai apagar parcelas" abre com a contagem certa (singular/plural), que Cancelar mantém o formulário aberto com a data editada, que "Confirmar e salvar" grava e fecha, e confirmar por SQL Editor que a(s) parcela(s) realmente sumiu(ram) de `parcelas` (não só da tela); (2) editar um campo que não seja data (ex.: telefone) e confirmar que salva direto, sem "Verificando..." e sem diálogo novo; (3) abrir um contrato de teste sem nenhuma data cadastrada, provocar a geração (abrir o Financeiro) e confirmar que só a parcela do mês atual aparece, não a do próximo mês.
- **Fora deste plano:** a limpeza das 27 parcelas órfãs já existentes em produção (D-08) é o plano `09-02`, com seu próprio checkpoint de autorização — não tocado por este plano.

---
*Phase: 09-integridade-de-datas-do-contrato-nas-parcelas*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: `.planning/phases/09-integridade-de-datas-do-contrato-nas-parcelas/09-01-SUMMARY.md`
- FOUND: commit `02dc4e6`
- FOUND: commit `91712c0`
- FOUND: `web/src/components/kanban/card-detail-dialog.tsx`
