---
phase: 14-cancelamento-de-taxas-e-cau-o
plan: 04
subsystem: payments
tags: [nextjs, react, typescript, supabase, server-actions]

# Dependency graph
requires:
  - phase: 14-03
    provides: migração `taxas_imobiliaria.lancamento_id` (FK `on delete cascade`) aplicada e documentada em produção
provides:
  - "TaxaHistorico/LinhaHistoricoParcela (parcelas.ts) — histórico unificado cronológico de lançamento+taxa"
  - "taxa-origem-label.tsx compartilhado (TAXA_ORIGEM/TaxaOrigemBadge), promovido de dinheiro-imobiliaria-view.tsx"
  - "cancelarTaxaImobiliariaAction — DELETE isolado de taxa, sem afetar status da parcela"
  - "registrarPagamentoAction grava lancamento_id — habilita a cascata pagamento→taxa"
  - "CancelarLancamentoDialog generalizado (parentId/itemId/rotulo/acao) — pronto para caução (plano 14-05)"
affects: [14-05]

actuals:
  tokens: 6750
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "União discriminada por `kind` (LinhaHistoricoParcela) para mesclar duas fontes de dados heterogêneas na mesma lista cronológica sem perder o tipo concreto de cada item"
    - "Diálogo de confirmação generalizado por `acao`/rotulo pronto do chamador, em vez de um `tipo` fechado por domínio — prepara o mesmo componente para um terceiro domínio (caução, 14-05) sem reabrir a API"

key-files:
  created:
    - web/src/components/financeiro/taxa-origem-label.tsx
  modified:
    - web/src/lib/kanban/parcelas.ts
    - web/src/app/(app)/financeiro/page.tsx
    - web/src/components/financeiro/parcela-historico-sheet.tsx
    - web/src/components/financeiro/parcelas-table.tsx
    - web/src/lib/kanban/actions.ts
    - web/src/lib/kanban/queries.ts
    - web/src/components/financeiro/cancelar-lancamento-dialog.tsx
    - web/src/components/reports/dinheiro-imobiliaria-view.tsx

key-decisions:
  - "Task 1 (tracer) entregou o histórico unificado sem botão de cancelar para taxa — Task 2 ampliou a condição do botão isoladamente, exatamente como planejado, para manter cada task um slice limpo e verificável"
  - "Task 3 (checkpoint:human-verify, gate=blocking) confirmada pelo usuário em produção — 'Fiz os teste e tudo se comportou como o esperado.'"

patterns-established:
  - "TaxaOrigemBadge ganhou `className` por origem (A-03) — convenção de ícone+rótulo+cor de LancamentoTipoLabel/CaucaoEventoLabel agora também cobre taxa, inclusive no relatório de reconciliação (/relatorios/imobiliaria) que já a consumia"

requirements-completed: [CANIMOB-01, CANIMOB-02, CANIMOB-03]

coverage:
  - id: D1
    description: "Taxa da imobiliária aparece na mesma lista cronológica do histórico da parcela (ParcelaHistoricoSheet), com rótulo de origem — TaxaHistorico/LinhaHistoricoParcela, embed taxas_imobiliaria nas duas queries de financeiro/page.tsx, merge+sort em montarLinhas"
    requirement: CANIMOB-01
    verification:
      - kind: other
        ref: "npm run lint && npm run build (código 0) + asserções de fonte do <verify> da Task 1 (tipos exportados, embed 2x, TaxaOrigemBadge renderizada) — todas passaram"
        status: pass
      - kind: manual_procedural
        ref: "Task 3, Passo 1 — operador confirmou em produção"
        status: pass
    human_judgment: true
    rationale: "Confirmado em produção pelo usuário."
  - id: D2
    description: "Cada taxa tem botão 'Cancelar' próprio, oculto quando a parcela está conciliada — cancelarTaxaImobiliariaAction reconsulta exigirParcelaNaoConciliada no servidor, DELETE condicionado por id+parcela_id, nunca chama recalcularEGravarStatus"
    requirement: CANIMOB-02
    verification:
      - kind: other
        ref: "asserção de fonte do <verify> da Task 2: corpo da função sem recalcularEGravarStatus, com os dois .eq(), sem .in(\"tipo\" — todas passaram"
        status: pass
      - kind: manual_procedural
        ref: "Task 3, Passo 2 — operador confirmou em produção que cancelar a taxa isoladamente não afetou o pagamento nem o status da parcela"
        status: pass
    human_judgment: true
    rationale: "Confirmado em produção pelo usuário."
  - id: D3
    description: "Cancelar o pagamento que gerou uma taxa remove a taxa também, via on delete cascade — registrarPagamentoAction agora grava lancamento_id: inserido[0].id no INSERT de taxas_imobiliaria; cancelarLancamentoAction não ganhou nenhuma linha nova de código"
    requirement: CANIMOB-03
    verification:
      - kind: other
        ref: "asserção de fonte: lancamento_id: inserido[0].id presente no corpo de registrarPagamentoAction — passou. git diff confirma zero linhas novas em cancelarLancamentoAction"
        status: pass
      - kind: manual_procedural
        ref: "Task 3, Passo 3 — operador registrou um novo pagamento+taxa, confirmou lancamento_id preenchido por SQL, cancelou o pagamento na tela, e confirmou por SQL que a taxa vinculada sumiu junto (cascata on delete cascade observada de ponta a ponta, não só no ensaio)"
        status: pass
    human_judgment: true
    rationale: "Confirmado em produção pelo usuário — o teste mais importante deste plano."
  - id: D4
    description: "CancelarLancamentoDialog generalizado de tipo: Extract<...> para parentId/itemId/rotulo/acao (\"lancamento\" | \"taxa\") — um só componente cobre pagamento/acréscimo/desconto/taxa, preservando o guard `data ? ... : \"\"` (bug 284e52b)"
    requirement: CANIMOB-05
    verification:
      - kind: other
        ref: "asserções de fonte do <verify> da Task 2: parentId/itemId/acao presentes, Extract<LancamentoDetalhado ausente, guard `data ? \`` preservado — todas passaram"
        status: pass
      - kind: manual_procedural
        ref: "Task 3, Passo 2 — operador confirmou o diálogo generalizado funcionando para taxa em produção, sem regressão visual"
        status: pass
    human_judgment: false

duration: ~35min (Tasks 1-2) + verificação em produção
completed: 2026-08-26
status: complete
---

# Phase 14 Plan 04: Taxa no histórico unificado + cancelamento isolado + cascata pagamento→taxa Summary

**Taxa da imobiliária passa a aparecer na mesma lista cronológica do histórico da parcela, com botão "Cancelar" próprio e um diálogo generalizado (`parentId`/`itemId`/`rotulo`/`acao`) que também prepara o terreno para caução — cancelar o pagamento que gerou a taxa agora remove a taxa junto, via `on delete cascade`, sem nenhuma linha de código nova em `cancelarLancamentoAction`. Confirmado em produção pelo usuário, incluindo a cascata de ponta a ponta.**

## Performance

- **Duration:** ~35 min (Tasks 1-2) + verificação em produção
- **Completed:** 2026-08-26
- **Tasks:** 3/3
- **Files modified:** 9 (8 modificados, 1 criado)

## Accomplishments
- `parcelas.ts` ganhou `TaxaHistorico`/`LinhaHistoricoParcela` (união discriminada por `kind`) e `montarLinhas` agora funde `parcela_lancamentos` + `taxas_imobiliaria` num único histórico cronológico (`historico`, substitui `lancamentos`)
- `financeiro/page.tsx` embute `taxas_imobiliaria(...)` nas duas queries (`SELECT_PARCELA_PADRAO`/`FILTRADA`)
- `taxa-origem-label.tsx` (novo) promove `TAXA_ORIGEM`/`TaxaOrigemBadge` de `dinheiro-imobiliaria-view.tsx`, agora com `className` por origem (A-03) — segunda tela a precisar do rótulo justifica a promoção
- `ParcelaHistoricoSheet`/`parcelas-table.tsx` renderizam o histórico unificado; botão "Cancelar" cobre lançamento E taxa
- `registrarPagamentoAction` grava `lancamento_id: inserido[0].id` no INSERT de `taxas_imobiliaria` — a ligação que a cascata de banco (FK `on delete cascade`, plano 14-01/14-03) usa
- `cancelarTaxaImobiliariaAction` (nova): DELETE condicionado por `id`+`parcela_id`, trava de conciliada reconsultada no servidor, NUNCA chama `recalcularEGravarStatus`
- `CancelarLancamentoDialog` generalizado: `tipo: Extract<...>` → `parentId`/`itemId`/`rotulo: string`/`acao: "lancamento" | "taxa"` — mesmo componente cobre os dois domínios, preservando o guard de data (bug `284e52b`)
- `dinheiro-imobiliaria-view.tsx` não define mais `TAXA_ORIGEM`/`TaxaOrigemBadge` localmente — importa do arquivo compartilhado

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Taxa aparece no histórico da parcela — leitura ponta a ponta (CANIMOB-01)** - `c834a93` (feat)
2. **Task 2: Cancelar taxa isolada + cascata pagamento→taxa + diálogo generalizado (CANIMOB-02, CANIMOB-03, CANIMOB-05)** - `cb264b9` (feat)

Task 3 (`checkpoint:human-verify`, `gate="blocking"`) — confirmada pelo usuário em produção, sem código adicional necessário.

## Files Created/Modified
- `web/src/lib/kanban/parcelas.ts` - `TaxaHistorico`/`LinhaHistoricoParcela`, `ParcelaComCard.taxas_imobiliaria`, `LinhaParcela.historico`, `montarLinhas` funde os dois arrays
- `web/src/app/(app)/financeiro/page.tsx` - embed `taxas_imobiliaria(...)` nas duas queries
- `web/src/components/financeiro/taxa-origem-label.tsx` (novo) - `TAXA_ORIGEM`/`TaxaOrigemBadge` compartilhados, com cor por origem
- `web/src/components/financeiro/parcela-historico-sheet.tsx` - histórico unificado, `rotuloDoItem`, botão Cancelar amplia para taxa, diálogo generalizado
- `web/src/components/financeiro/parcelas-table.tsx` - `historico={linha.historico}` em vez de `lancamentos={linha.lancamentos}`
- `web/src/lib/kanban/actions.ts` - `registrarPagamentoAction` grava `lancamento_id`; nova `cancelarTaxaImobiliariaAction`
- `web/src/lib/kanban/queries.ts` - wrapper `cancelarTaxaImobiliaria`
- `web/src/components/financeiro/cancelar-lancamento-dialog.tsx` - generalizado para `parentId`/`itemId`/`rotulo`/`acao`
- `web/src/components/reports/dinheiro-imobiliaria-view.tsx` - remove definição local, importa do arquivo compartilhado

## Decisions Made
- Manter o `cast` de `tipo` no diálogo ANTIGO (ainda vigente durante a Task 1, antes da generalização da Task 2) referenciando `Extract<LancamentoDetalhado["tipo"], ...>` em vez de um literal solto — evita duplicar o union e mantém `LancamentoDetalhado` como import usado, sem warning de lint
- Seguir o padrão já usado em `14-03-SUMMARY.md` para este mesmo cenário (checkpoint `blocking` pendente): `status: halted` no frontmatter e `requirements-completed: []`, já que a confirmação em produção (Task 3) é o que efetivamente fecha CANIMOB-01/02/03/05 para este plano

## Deviations from Plan

### Nenhuma mudança de código além do que o plano especificou

Todo o código de Tasks 1 e 2 segue literalmente as seções `<action>` do plano — nenhum Rule 1-4 disparado durante a implementação. Uma única observação sobre o **script de verificação automatizada** da Task 1, não sobre o código produzido:

**1. [Observação, não deviation de código] Falso positivo no `<verify>` da Task 1**
- **Encontrado durante:** Task 1, ao rodar o `<automated>` verify literal do plano
- **Constatação:** a asserção `! grep -q "lancamentos: LancamentoDetalhado\[\]" "$f1"` casa por substring com `parcela_lancamentos: LancamentoDetalhado[] | null` (campo que o próprio plano manda MANTER em `ParcelaComCard`, ver `<action>` item 1) — o grep não distingue `parcela_lancamentos` de um `lancamentos` solto
- **Confirmação:** rodei uma checagem adicional ancorada (`^\s+lancamentos: LancamentoDetalhado\[\]`) que confirma que `LinhaParcela.lancamentos` de fato não existe mais — só `ParcelaComCard.parcela_lancamentos` (esperado, intocado) contém a substring
- **Ação:** nenhuma mudança de código — o `<done>`/acceptance criteria da Task 1 ("`LinhaParcela.lancamentos` não existe mais") está de fato satisfeito; documentando aqui para não confundir uma auditoria futura que rode o grep literal do plano

---

**Total deviations:** 0 de código (1 observação sobre precisão do próprio script de `<verify>`)
**Impact on plan:** Nenhum — implementação segue o plano ao pé da letra, `npm run lint`/`npm run build` passam com código 0 em ambas as tasks, e todas as demais asserções de fonte (Task 1 e Task 2) passaram sem ressalva.

## Issues Encountered
- `node_modules/` não existia neste worktree (`.claude/worktrees/agent-a30e340107bf0bf54/web`) — rodei `npm install --prefer-offline --no-audit --no-fund` antes do primeiro `npm run lint`/`build`. Sem impacto no código do plano; apenas setup de ambiente necessário para verificar as tasks.

## User Setup Required

None - a confirmação em produção (Task 3) já foi feita pelo usuário: "Fiz os teste e tudo se comportou como o esperado."

## Next Phase Readiness

- Plano completo: CANIMOB-01, CANIMOB-02 e CANIMOB-03 confirmados em produção, incluindo a cascata pagamento→taxa observada de ponta a ponta por SQL
- `CancelarLancamentoDialog` já está na forma generalizada (`parentId`/`itemId`/`rotulo`/`acao`) que o plano 14-05 (caução) vai reusar direto, ampliando só o union de `acao` para incluir `"caucao"` — nenhum rename adicional necessário
- CANIMOB-05 (diálogo padronizado) fica parcialmente confirmado aqui (lançamento+taxa) — fecha por completo no plano 14-05, quando caução também usar o mesmo componente

## Self-Check: PASSED

- FOUND: `web/src/components/financeiro/taxa-origem-label.tsx`
- FOUND: commit `c834a93` (Task 1)
- FOUND: commit `cb264b9` (Task 2)
- FOUND: `export type TaxaHistorico`/`export type LinhaHistoricoParcela` em `parcelas.ts`
- FOUND: `export async function cancelarTaxaImobiliariaAction` em `actions.ts`
- FOUND: `export async function cancelarTaxaImobiliaria` em `queries.ts`

---
*Phase: 14-cancelamento-de-taxas-e-cau-o*
*Completed: 2026-08-26*
