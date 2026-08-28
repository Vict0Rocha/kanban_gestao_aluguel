---
phase: 21-redesenho-do-modelo-de-pdf-dos-relat-rios-financeiros
plan: 01
subsystem: ui
tags: [jspdf, jspdf-autotable, pdf-export, relatorios]

requires:
  - phase: 10-relat-rio-financeiro-dedicado
    provides: "relatorio-financeiro-pdf.ts (contrato de layout PDF verde/retrato original)"
  - phase: 19-dinheiro-da-imobiliaria
    provides: "reconciliacao-pdf.ts, espelhado bloco a bloco em relatorio-financeiro-pdf.ts"
  - phase: 20-tipo-imob-e-colunas-imobiliaria
    provides: "colunas Contrato(proprietário)/Inquilino na tela dinheiro-imobiliaria-view.tsx, deixadas pendentes no PDF (D-09)"
provides:
  - "relatorio-financeiro-pdf.ts e reconciliacao-pdf.ts com novo contrato visual: A4 paisagem, paleta cinza, lista theme:plain com linha horizontal sutil + zebra, linha 'Total' via foot/footStyles/showFoot:lastPage"
  - "reconciliacao-pdf.ts com 6 colunas (Data/Contrato/Inquilino/Tipo/Valor/Observação), Contrato mostrando proprietário em vez de endereço"
  - "10-UI-SPEC.md § 'PDF Export Layout Contract' atualizado in-place, cobrindo os dois módulos"
affects: [relatorios, pdf-export]

actuals:
  tokens: 6530
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "jspdf-autotable foot/footStyles/showFoot:'lastPage' para linha de total sem repetir em páginas seguintes"
    - "theme:'plain' + styles.lineWidth bottom-only para linha horizontal sutil sem grade vertical"
    - "halign:'right' direto no CellDef.styles do foot (columnStyles não alcança a seção foot)"

key-files:
  created: []
  modified:
    - web/src/components/reports/relatorio-financeiro-pdf.ts
    - web/src/components/reports/reconciliacao-pdf.ts
    - .planning/phases/10-relat-rio-financeiro-dedicado/10-UI-SPEC.md

key-decisions:
  - "Paleta cinza (D-01/D-03): foreground #262626, headerFill #f2f2f2 (novo), border #d9d9d9, muted #6b6b6b, rowShade #f7f7f7"
  - "reconciliacao-pdf.ts ganha coluna Inquilino e troca Contrato de endereço para proprietário (D-02 corrigido), fechando o gap deixado pela Phase 20"
  - "relatorio-financeiro-pdf.ts mantém suas colunas inalteradas — só reconciliacao-pdf.ts muda de colunas nesta fase"

patterns-established:
  - "bodyRows (ou linhas.reduce direto quando o valor já é plano) computado uma única vez, reusado tanto para renderizar a célula quanto para somar o Total — nunca re-derivado"

requirements-completed: [PDFMODELO-01, PDFMODELO-02, PDFMODELO-03, PDFMODELO-04, PDFMODELO-05]

coverage:
  - id: D1
    description: "Os dois PDFs exportam em A4 paisagem, paleta cinza inteira (sem cor viva), três blocos estruturais mantidos"
    requirement: "PDFMODELO-01"
    verification:
      - kind: unit
        ref: "grep assertions (orientation landscape, 5 constantes de cor) em ambos os módulos, 21-01-PLAN.md Task 1/Task 2 <verify>"
        status: pass
    human_judgment: true
    rationale: "A estrutura visual real do PDF (orientação, paleta) só é verificável abrindo os arquivos gerados de verdade — grep confirma a forma do código-fonte, não o resultado visual renderizado"
  - id: D2
    description: "Lista principal com linha horizontal sutil (sem grade vertical) + zebra"
    requirement: "PDFMODELO-02"
    verification:
      - kind: unit
        ref: "grep 'theme: \"plain\"' e 'lineWidth: { top: 0, right: 0, bottom: 0.75, left: 0 }' em ambos os módulos"
        status: pass
    human_judgment: true
    rationale: "Renderização visual da zebra/linha só verificável abrindo o PDF"
  - id: D3
    description: "Linha 'Total' em negrito, fundo cinza igual ao cabeçalho, somando a coluna Valor, nunca repetida em páginas seguintes"
    requirement: "PDFMODELO-03"
    verification:
      - kind: unit
        ref: "grep 'showFoot: \"lastPage\"', 'footStyles', 'content: \"Total\"' em ambos os módulos"
        status: pass
    human_judgment: true
    rationale: "Soma correta e comportamento em export multi-página só verificável abrindo um PDF real com dados suficientes para 2+ páginas"
  - id: D4
    description: "Três blocos estruturais existentes (título+timestamp, filtros, totais/resumo) continuam presentes, só recoloridos"
    requirement: "PDFMODELO-04"
    verification:
      - kind: unit
        ref: "diff review — blocos 1-2 (theme:grid) e rodapé preservados estruturalmente em ambos os módulos, só textColor/lineColor trocados"
        status: pass
    human_judgment: true
    rationale: "Confirmação visual final requer abrir os PDFs"
  - id: D5
    description: "reconciliacao-pdf.ts ganha coluna Inquilino e Contrato passa a mostrar proprietário"
    requirement: "PDFMODELO-05"
    verification:
      - kind: unit
        ref: "grep '\"Data\", \"Contrato\", \"Inquilino\", \"Tipo\", \"Valor\", \"Observação\"', 'l.cards?.proprietario', 'l.cards?.inquilino', ausência de 'l.cards?.endereco' em reconciliacao-pdf.ts"
        status: pass
    human_judgment: true
    rationale: "Renderização final das colunas só confirmável abrindo o PDF de Dinheiro da imobiliária"

duration: 25min
completed: 2026-08-28
status: complete
---

# Phase 21 Plan 01: Redesenho do modelo de PDF dos relatórios financeiros Summary

**Os dois PDFs exportáveis (Relatório Financeiro e Dinheiro da imobiliária) migraram do contrato verde/retrato para um contrato cinza/paisagem com lista sem grade vertical, zebra, e uma nova linha de Total via `foot`/`showFoot:"lastPage"`; `reconciliacao-pdf.ts` também ganhou a coluna Inquilino e trocou Contrato de endereço para proprietário.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-28T18:25:00Z (approx.)
- **Completed:** 2026-08-28T18:50:49Z
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments
- `relatorio-financeiro-pdf.ts` redesenhado ponta a ponta: paisagem, 5 constantes de cor novas (incluindo `headerFill`), lista `theme:"plain"` com linha horizontal sutil (bottom-only) + zebra, nova linha "Total" em negrito somando `bodyRows.valor` via `foot`/`footStyles`/`showFoot:"lastPage"`
- `reconciliacao-pdf.ts` espelha o mesmo tratamento visual, mais a mudança de colunas corrigida (D-02): nova coluna "Inquilino", célula "Contrato" trocando endereço por proprietário, índices de `columnStyles`/`colSpan` deslocados corretamente (Valor 3→4, Total colSpan 3→4)
- `10-UI-SPEC.md` § "PDF Export Layout Contract" atualizado in-place para documentar o contrato novo (paisagem, 5 hex cinza, lista sem grade+zebra travada, linha de Total), cobrindo explicitamente os dois módulos

## Task Commits

Each task was committed atomically:

1. **Task 1: Novo contrato visual ponta a ponta — relatorio-financeiro-pdf.ts** - `e32e764` (feat)
2. **Task 2: Espelhar o novo contrato em reconciliacao-pdf.ts + mudança de colunas corrigida (D-02) + atualizar 10-UI-SPEC.md** - `19d5061` (feat)

_Note: dependencies had to be installed in this worktree (`npm ci`) before `tsc`/`lint`/`build` could run — not a task commit, no source files touched._

## Files Created/Modified
- `web/src/components/reports/relatorio-financeiro-pdf.ts` - paisagem, paleta cinza, lista redesenhada com Total
- `web/src/components/reports/reconciliacao-pdf.ts` - mesmo tratamento visual + 6 colunas (Inquilino nova, Contrato mostra proprietário)
- `.planning/phases/10-relat-rio-financeiro-dedicado/10-UI-SPEC.md` - § "PDF Export Layout Contract" reescrita para o novo contrato, cobrindo os dois módulos

## Decisions Made
- Paleta cinza travada (D-03): `foreground` #262626, `headerFill` #f2f2f2 (novo — antes cabeçalho tinha fundo branco fixo), `border` #d9d9d9, `muted` #6b6b6b, `rowShade` #f7f7f7 (zebra, distinto de `headerFill`)
- `showFoot: "lastPage"` explícito nos dois módulos — nunca o default `"everyPage"` da biblioteca, que repetiria o Total em cada página de um export multi-página
- `halign:"right"` da célula de valor do `foot` setado direto no `CellDef.styles`, nunca via `columnStyles` (que não alcança a seção `foot` nesta versão do `jspdf-autotable`)
- Em `relatorio-financeiro-pdf.ts`, extraído `bodyRows` (valor + cells) para que o Total reuse exatamente o mesmo `valor` situação-dependente já computado por linha, nunca re-derivado
- Em `reconciliacao-pdf.ts`, `columnStyles`/`foot.colSpan` deslocados (índice 3→4) porque "Inquilino" foi inserida no índice 2, entre "Contrato" e "Tipo"

## Deviations from Plan

None - plan executado exatamente como escrito. O `npm ci` necessário para rodar `tsc`/`lint`/`build` neste worktree isolado (que não tinha `node_modules` instalado) não é uma mudança de código nem um desvio de plano — é infraestrutura de execução, sem arquivo de fonte tocado.

## Issues Encountered
- O worktree de execução não tinha `node_modules` instalado (worktrees do Claude Code não compartilham `node_modules` com o checkout principal). Resolvido rodando `npm ci --no-audit --no-fund` em `web/` antes de `tsc`/`lint`/`build`. Sem impacto no código do plano.

## User Setup Required

None - nenhuma configuração de serviço externo necessária.

## Next Phase Readiness

Os dois módulos de PDF estão prontos para verificação visual humana (ver Human Check consolidado abaixo). Nenhum bloqueio para fases futuras — mudança puramente client-side, zero migração, zero pacote novo, zero Server Action nova.

### Human Check pendente (consolidado, não-bloqueante)

Baixar os dois PDFs — "Exportar PDF" em `/relatorios/financeiro` (Relatório Financeiro dedicado) e em
`/relatorios/imobiliaria` (Dinheiro da imobiliária) — e abrir os dois arquivos. Confirmar em ambos: A4
paisagem; paleta cinza inteira (texto quase preto, cabeçalho/Total com fundo cinza claro, bordas cinza,
nenhuma cor viva — verde/vermelho/azul — em lugar nenhum); na lista, linha horizontal sutil entre as linhas
sem nenhuma borda vertical, e zebra branco/cinza claro alternando; a última linha da lista é "Total", em
negrito, mesmo fundo cinza do cabeçalho, com o valor batendo com a soma manual das linhas visíveis
(considerando o filtro aplicado no momento da exportação). Se algum dos dois exports tiver linhas suficientes
para gerar 2+ páginas, confirmar que "Total" aparece só na última página, não repetido em cada uma. No PDF de
Dinheiro da imobiliária especificamente, confirmar a nova coluna "Inquilino" (logo depois de "Contrato") e que
"Contrato" mostra o proprietário do contrato, não mais o endereço do imóvel. Os três blocos estruturais
(título+timestamp, filtros aplicados, totais/resumo) devem continuar presentes nos dois PDFs, só recoloridos.

**Expected:** Os dois PDFs abrem em paisagem, com a paleta cinza nova; lista com linha sutil + zebra, sem
grade vertical; linha "Total" em negrito somando corretamente, presente só na última página de um export
multi-página; Dinheiro da imobiliária com as colunas Contrato(proprietário)/Inquilino corretas; os três blocos
estruturais existentes continuam presentes nos dois.

## Self-Check: PASSED

- FOUND: web/src/components/reports/relatorio-financeiro-pdf.ts
- FOUND: web/src/components/reports/reconciliacao-pdf.ts
- FOUND: .planning/phases/10-relat-rio-financeiro-dedicado/10-UI-SPEC.md
- FOUND: commit e32e764 (Task 1)
- FOUND: commit 19d5061 (Task 2)

---
*Phase: 21-redesenho-do-modelo-de-pdf-dos-relat-rios-financeiros*
*Completed: 2026-08-28*
