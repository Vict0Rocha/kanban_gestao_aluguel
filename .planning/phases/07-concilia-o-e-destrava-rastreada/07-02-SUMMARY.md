---
phase: 07-concilia-o-e-destrava-rastreada
plan: 02
subsystem: financeiro
tags: [server-actions, supabase, nextjs, row-level-lock, financeiro]

# Dependency graph
requires:
  - phase: 07-concilia-o-e-destrava-rastreada
    plan: 01
    provides: conciliarParcelaAction/conciliarParcela, exigirParcelaNaoConciliada, o botão Conciliar, ConciliarFalhaToast
provides:
  - destravarParcelaAction — relê status, só aceita "conciliada", grava lançamento tipo="destrava" (motivo obrigatório, teto 500) e devolve status a "paga"
  - destravarParcela (bridge em queries.ts)
  - DestravarParcelaDialog — motivo obrigatório, bloqueado no cliente antes do round-trip
  - Botão Destravar em AcoesCell (linha conciliada), substituindo Pagamento/Ajustar/Conciliar
  - Bloco lancamento.motivo em ParcelaHistoricoSheet, ao lado de observacao
affects: [relatorios-financeiros]

# Actuals (#2632)
actuals:
  tokens: 3700
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Read-then-write com relê de status antes de INSERT/UPDATE, quando a trava não pode ser expressa num único UPDATE condicionado (destravar precisa de dois passos: INSERT do lançamento + UPDATE do status, não é atômico como conciliar)"
    - "Correção de teto documentado no plano em vez de confiar cegamente na UI-SPEC — CHECK do banco é a autoridade final (motivo: 500, não 2000)"

key-files:
  created:
    - web/src/components/financeiro/destravar-parcela-dialog.tsx
  modified:
    - web/src/lib/kanban/actions.ts
    - web/src/lib/kanban/queries.ts
    - web/src/components/financeiro/parcelas-table.tsx
    - web/src/components/financeiro/parcela-historico-sheet.tsx

key-decisions:
  - "destravarParcelaAction usa teto de motivo = 500 (não 2000): corrige um erro da UI-SPEC, que citou o teto de observacao por engano. Documentado em comentário no código para não ser 'consertado' de volta a 2000 no futuro."
  - "destravarParcelaAction NÃO chama exigirParcelaVisivel — mesma razão de D-09 já documentada em conciliarParcelaAction: uma parcela conciliada sempre tem lançamento, logo já é visível por outro caminho."
  - "UPDATE de status='paga' não recebe condição adicional de status no .eq — o SELECT do passo anterior já confirmou 'conciliada' poucos milissegundos antes, e o INSERT do lançamento que acabou de acontecer é o que autoriza a gravação."

patterns-established:
  - "Diálogo com único campo obrigatório (sem sufixo '(opcional)') como gate de fricção no lugar de um diálogo de confirmação — mesmo padrão de D-04 desta fase"

requirements-completed: [CONCIL-03, CONCIL-04]

coverage:
  - id: D1
    description: "destravarParcelaAction relê status antes de qualquer INSERT/UPDATE; só aceita parcela 'conciliada', recusando antes de gravar quando não é"
    requirement: "CONCIL-03"
    verification:
      - kind: other
        ref: "grep assertions in 07-02-PLAN.md Task 1 <verify> — export async function destravarParcelaAction, status !== \"conciliada\", tipo: \"destrava\", valor: 0, criado_por: sessao.user.id, status: \"paga\""
        status: pass
    human_judgment: true
    rationale: "Grep confirms the source shape (read-before-write ordering, refusal message, insert/update shape), but the actual browser round-trip — destravar with an empty motivo blocked client-side, then filled and submitted, row flipping back to paga — needs a human click against real production data."
  - id: D2
    description: "DestravarParcelaDialog bloqueia motivo vazio no cliente com 'Informe o motivo da destrava.' antes de qualquer round-trip; AcoesCell mostra Destravar+Histórico só em linha conciliada"
    requirement: "CONCIL-03"
    verification:
      - kind: other
        ref: "grep assertions in 07-02-PLAN.md Task 2 <verify> — Motivo da destrava, Informe o motivo da destrava., placeholder verbatim, sem maxLength, situacao === \"conciliada\", Unlock"
        status: pass
    human_judgment: true
    rationale: "Confirms source-level copy and structure; the visual swap of buttons per row and the disabled/label-swap during submit require a human in a real browser session."
  - id: D3
    description: "ParcelaHistoricoSheet renderiza lancamento.motivo num bloco separado, ao lado do bloco de observacao já existente, sem remover nenhum dos dois"
    requirement: "CONCIL-04"
    verification:
      - kind: other
        ref: "grep assertions in 07-02-PLAN.md Task 3 <verify> — lancamento.motivo, Motivo: , lancamento.observacao"
        status: pass
    human_judgment: true
    rationale: "Confirms the JSX exists in the file; the actual rendering inside the Sheet — a destrava entry showing Unlock icon, '—' value, and the wrapped motivo text inside the scrolling container — needs a human to open the Sheet in the browser against a real destravada parcela."

# Metrics
duration: ~12min
completed: 2026-08-20
status: complete
---

# Phase 7 Plan 2: Destravar uma parcela conciliada, com motivo obrigatório rastreado, e o histórico visível Summary

**`destravarParcelaAction` (relê status, exige motivo, grava lançamento `tipo="destrava"` e devolve `status` a `"paga"`) ligada a `DestravarParcelaDialog`, com a linha conciliada trocando Pagamento/Ajustar/Conciliar por Destravar, e o `motivo` agora visível em `ParcelaHistoricoSheet`**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-20T08:32:28-04:00 (Task 1 commit)
- **Completed:** 2026-08-20T08:34:54-04:00 (Task 3 commit)
- **Tasks:** 3/3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- `destravarParcelaAction`: relê `status` direto do banco antes de qualquer gravação — só aceita destravar uma parcela `conciliada`, recusando de imediato numa parcela paga/aberta/parcial, sem gravar um lançamento fantasma. Valida `motivo` com `textoObrigatorio(motivo, "Motivo", 500)` — **500, não 2000** como a UI-SPEC citava por engano (a CHECK `parcela_lancamentos_motivo_tamanho` é distinta da CHECK de `observacao`).
- Dois passos server-side, ambos decididos e executados no servidor: `INSERT` em `parcela_lancamentos` (`tipo="destrava"`, `valor=0`, `motivo`, `criado_por` da sessão) seguido de `UPDATE` de `parcelas.status` para `"paga"`.
- `destravarParcela` bridge em `queries.ts`, mesmo padrão `unwrap` dos demais.
- `DestravarParcelaDialog` novo: estrutura idêntica a `AjustarParcelaDialog` (`wasOpen` resync, único campo obrigatório sem sufixo "(opcional)", erro inline via `erroDoBanco()`, botão "Destravar"/"Destravando..." com `disabled={saving}`).
- `AcoesCell` reestruturado com `if`/`else` sobre `situacao === "conciliada"`: uma linha conciliada mostra **só** Destravar (outline, ícone `Unlock`) + Histórico; qualquer outra situação mantém exatamente a sequência que o plano 07-01 deixou (Pagamento, Ajustar, Conciliar-condicional, Histórico), sem mudança de conteúdo.
- `ParcelaHistoricoSheet` ganhou um bloco `{lancamento.motivo && (...)}` ao lado do bloco de `observacao` já existente — os dois nunca colidem na prática (um lançamento `destrava` só grava `motivo`, os outros três tipos só gravam `observacao`), fechando CONCIL-04: os quatro `tipo` de `parcela_lancamentos` (`pagamento`, `acrescimo`, `desconto`, `destrava`) estão agora todos alcançáveis pela interface.

## Task Commits

Each task was committed atomically:

1. **Task 1: Destravar — Server Action e bridge** - `3906a4e` (feat)
2. **Task 2: DestravarParcelaDialog e a troca de botões na linha conciliada** - `477f56b` (feat)
3. **Task 3: Histórico de destravas em ParcelaHistoricoSheet** - `7373eba` (feat)

_All three automated `<verify>` blocks (lint + build + grep assertions) passed for each task before commit. This plan has no separate plan-metadata commit — the final metadata step below handles STATE/ROADMAP/REQUIREMENTS._

## Files Created/Modified
- `web/src/components/financeiro/destravar-parcela-dialog.tsx` - Novo. `DestravarParcelaDialog`, estrutura idêntica a `AjustarParcelaDialog`, único campo obrigatório
- `web/src/lib/kanban/actions.ts` - `destravarParcelaAction` (Task 1): relê status, valida motivo (teto 500), INSERT + UPDATE, ambos com verificação de linhas afetadas
- `web/src/lib/kanban/queries.ts` - `destravarParcela` bridge, import de `destravarParcelaAction`
- `web/src/components/financeiro/parcelas-table.tsx` - `AcoesCell` reestruturado com `if`/`else` sobre `situacao === "conciliada"`, `"destravar"` acrescentado ao union `dialogoAberto`, `DestravarParcelaDialog` renderizado incondicionalmente ao lado dos outros três
- `web/src/components/financeiro/parcela-historico-sheet.tsx` - Bloco `lancamento.motivo` acrescentado ao lado do bloco `observacao` já existente

## Decisions Made
- Teto de `motivo` corrigido para 500 (não 2000) desde o início da Task 1 — a UI-SPEC citava o teto errado (achou que `motivo` compartilha o teto de `observacao`; são duas CHECKs distintas no schema). Comentário no código documenta a correção, para que uma leitura futura não reverta por engano.
- `destravarParcelaAction` não chama `exigirParcelaVisivel`, mesma razão de D-09 já documentada em `conciliarParcelaAction` — comentário replicado no ponto certo.
- O `UPDATE` final de `destravarParcelaAction` não leva condição adicional de `status` no `.eq` — a leitura anterior já confirmou `conciliada` poucos milissegundos antes, e o `INSERT` do lançamento que acabou de acontecer é o que autoriza a gravação. Diferente de `conciliarParcelaAction` (que usa um único UPDATE condicionado como trava atômica), destravar precisa necessariamente de dois passos porque grava um lançamento além de mudar o status — não há como fundir os dois numa única instrução condicionada.

## Deviations from Plan

None — plan executed exactly as written, incluindo a correção de teto de caracteres (500, não 2000) já prevista e determinada pelo próprio plano.

## Issues Encountered
None. `node_modules` precisou ser instalado no worktree (`npm ci`) antes de rodar lint/build, pois worktrees git não compartilham `node_modules` — passo mecânico, sem impacto no código.

## User Setup Required
None — no external service configuration required. Nenhuma migração de banco foi necessária (schema já vivo desde a Phase 4).

## Human-Check Items (pendentes, não bloqueantes para este plano)

Os dois blocos `<human-check>` do plano 07-02, reproduzidos verbatim para consolidação com os itens de human-check do plano 07-01 (a serem verificados manualmente contra produção, depois do merge/deploy):

### Task 2 — DestravarParcelaDialog e a troca de botões
- **Test:** Destravar uma parcela conciliada: clicar em "Destravar" na linha, tentar submeter com o campo de motivo vazio, depois preencher e submeter.
- **Expected:** Vazio: o diálogo mostra "Informe o motivo da destrava." sem sair da tela (sem round-trip). Preenchido: o botão troca para "Destravando...", o diálogo fecha, a linha volta a mostrar Pagamento/Ajustar/Conciliar (não mais Destravar) e a Situação volta a "Paga". Numa parcela não-conciliada, os botões Pagamento/Ajustar/Conciliar continuam aparecendo normalmente — nenhuma regressão nas outras linhas.
- **Why human:** Fluxo de formulário e a troca visual de botões por linha — grep confirma a existência do código, não o comportamento no navegador.

### Task 3 — Histórico de destravas em ParcelaHistoricoSheet
- **Test:** Abrir o Histórico (ícone) de uma parcela que já foi conciliada e destravada pelo menos uma vez (Tasks 1/2 deste plano).
- **Expected:** A entrada `destrava` na lista mostra o rótulo "Destrava" (ícone Unlock), o valor "—" (não uma moeda), a data e quem fez, e uma linha "Motivo: " seguida do texto digitado no diálogo — ao lado de, não no lugar de, qualquer observação de outros lançamentos da mesma parcela.
- **Why human:** Confere a renderização real dentro do Sheet, incluindo o texto longo quebrando dentro do container com scroll — grep só confirma que o JSX existe no arquivo.

## Next Phase Readiness
- Os quatro `tipo` de `parcela_lancamentos` (`pagamento`, `acrescimo`, `desconto`, `destrava`) estão todos alcançáveis pela interface — o modelo de livro-razão desenhado desde a Phase 4 está fechado.
- `cardTemLancamento` continua cobrindo lançamentos `tipo='destrava'` automaticamente, sem nenhuma mudança de código nesta fase (confirmado por leitura, não reimplementado — D-06 desta fase, D-17 de `06.2-CONTEXT.md`).
- Nenhum plano subsequente identificado nesta fase depende deste plano além dos itens de human-check acima.

---
*Phase: 07-concilia-o-e-destrava-rastreada*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: web/src/components/financeiro/destravar-parcela-dialog.tsx
- FOUND: web/src/lib/kanban/actions.ts (destravarParcelaAction)
- FOUND: web/src/lib/kanban/queries.ts (destravarParcela)
- FOUND: web/src/components/financeiro/parcelas-table.tsx (Destravar button, situacao === "conciliada")
- FOUND: web/src/components/financeiro/parcela-historico-sheet.tsx (lancamento.motivo)
- FOUND commit: 3906a4e
- FOUND commit: 477f56b
- FOUND commit: 7373eba
