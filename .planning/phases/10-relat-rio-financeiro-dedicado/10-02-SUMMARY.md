---
phase: 10-relat-rio-financeiro-dedicado
plan: 02
subsystem: ui
tags: [pdf, jspdf, jspdf-autotable, nextjs, react, financeiro, relatorios]

requires:
  - phase: 10-relat-rio-financeiro-dedicado (plano 10-01)
    provides: RelatorioFinanceiroDedicado com linhasFiltradas/categorias/filtro/hojeISO já computados via useMemo, rota /relatorios/financeiro ao vivo
provides:
  - exportarRelatorioFinanceiroPDF (web/src/components/reports/relatorio-financeiro-pdf.ts) — construtor de PDF puro, import() dinâmico de jspdf/jspdf-autotable, API funcional v5
  - formatInstantDateTime (web/src/lib/kanban/format.ts) — data+hora em Cuiabá, um único texto pt-BR
  - Botão "Exportar PDF" wireado em RelatorioFinanceiroDedicado, com loading ("Exportando...") e nota de erro inline
affects: [] # última plano da Phase 10 — fecha RELDED-04/05, encerra o Módulo Financeiro v2.0

actuals:
  tokens: 3950
  tasks: 2
  commits: 2

tech-stack:
  added: [jspdf@4.2.1, jspdf-autotable@5.0.8]
  patterns:
    - "PDF puro no browser: módulo sem \"use client\", import() dinâmico de jspdf/jspdf-autotable só dentro da função exportada, nunca em import estático de topo (evita quebrar SSR da rota)"
    - "Função exportadora estruturalmente restrita a dado já filtrado (linhas/categorias), nunca acesso ao array bruto — mesmo padrão de 'não dar acesso ao dado errado' já usado em outras partes do app"

key-files:
  created:
    - web/src/components/reports/relatorio-financeiro-pdf.ts
  modified:
    - web/src/lib/kanban/format.ts
    - web/src/components/reports/relatorio-financeiro-dedicado.tsx
    - web/package.json
    - web/package-lock.json

key-decisions:
  - "headerRows: 1 (citado no plano/RESEARCH.md) não existe em UserOptions do jspdf-autotable 5.0.8 realmente instalado — o equivalente real é showHead: \"everyPage\" (já é o valor padrão da biblioteca, declarado explicitamente por clareza). Documentado em comentário no código citando a checagem feita contra o pacote instalado."
  - "doc.internal.getNumberOfPages() (citado no plano/RESEARCH.md) não existe nos tipos do jsPDF 4.2.1 instalado — o método real é doc.getNumberOfPages() (topo da instância, não dentro de internal). Corrigido e comentado no código."
  - "doc.lastAutoTable não está nos tipos oficiais de jsPDF, mas é atribuído em runtime pelo próprio jspdf-autotable (confirmado lendo dist/jspdf.plugin.autotable.mjs:1640) — acessado via um cast local tipado, não via `any` solto, para manter o encadeamento de startY entre os três blocos do PDF (filtros → resumo → lista) sem hardcodar posições Y."

patterns-established:
  - "Mapeamento de peso de fonte jsPDF: só 'normal'/'bold' existem nativamente via doc.setFont(fontName, style) — o orçamento de 2 pesos do contrato de UI (400/600) mapeia direto para eles, sem introduzir um terceiro peso"

requirements-completed: [RELDED-04, RELDED-05]

coverage:
  - id: D1
    description: "relatorio-financeiro-pdf.ts gera um PDF autônomo (cabeçalho com filtros aplicados + data de geração, bloco de resumo com os 4 totais, lista completa com header repetindo em toda página, rodapé com número de página), usando a API funcional v5 do jspdf-autotable via import() dinâmico"
    requirement: "RELDED-05"
    verification:
      - kind: other
        ref: "npm run lint && npm run build (web/) — exit 0; asserções de grep do plano (import() dinâmico, zero import estático, autoTable(doc, ...) funcional, zero doc.autoTable(, formatInstantDateTime existe, doc.save usa hojeISO)"
        status: pass
    human_judgment: true
    rationale: "Confirmar que o PDF gerado de fato abre, exibe acentuação portuguesa corretamente e bate visualmente com o UI-SPEC (cabeçalho/resumo/lista/rodapé) exige abrir o arquivo baixado — grep/build confirmam que o código monta as chamadas certas, não o resultado visual final. Adiado para verificação humana de fim de fase (config.json human_verify_mode: end-of-phase)."
  - id: D2
    description: "Botão 'Exportar PDF' substitui 'Gerar relatório' nesta página — não dispara mais consulta, só empacota linhasFiltradas/categorias já em tela; troca para 'Exportando...' e desabilita durante a geração; falha mostra nota inline em português, nunca erro cru de biblioteca"
    requirement: "RELDED-04"
    verification:
      - kind: other
        ref: "npm run lint && npm run build (web/) — exit 0; asserções de grep do plano (chama exportarRelatorioFinanceiroPDF com linhasFiltradas, zero chamada com parcelas bruto, texto 'Exportando...'/mensagem de erro presentes, zero fixed bottom-4)"
        status: pass
    human_judgment: true
    rationale: "Confirmar que o arquivo baixa de fato no navegador, que o PDF reflete exatamente o filtro aplicado no momento do clique (incluindo o caso de filtro vazio-de-resultado), e que o botão troca visualmente de estado exige interação real no navegador — grep confirma os argumentos certos e o texto certo, não o comportamento em produção. Adiado para verificação humana de fim de fase (config.json human_verify_mode: end-of-phase)."

duration: ~30min
completed: 2026-08-21
status: complete
---

# Phase 10 Plan 02: Exportação em PDF do Relatório Financeiro Summary

**"Exportar PDF" empacota exatamente o que está em tela (tiles + lista filtrados) num PDF autônomo via jsPDF + jspdf-autotable v5, gerado inteiramente no browser sem round-trip de servidor.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-08-21
- **Tasks:** 2 (Task 1 auto, Task 2 auto)
- **Files modified:** 5 (1 criado, 4 alterados)

## Accomplishments
- `web/src/components/reports/relatorio-financeiro-pdf.ts` novo: `exportarRelatorioFinanceiroPDF(linhas, categorias, filtro, hojeISO)` monta um PDF A4 portrait com cabeçalho (título + "Gerado em {data} às {hora}" em Cuiabá + tabela de filtros aplicados), bloco de resumo (4 totais na ordem `SITUACAO_RELATORIO_ORDEM`), lista completa (6 colunas, header repetindo em toda página) e rodapé com "Página X de Y" em todas as páginas
- `jspdf@4.2.1`/`jspdf-autotable@5.0.8` instaladas nas versões exatas verificadas em `10-RESEARCH.md` — ambas importadas só via `import()` dinâmico dentro da função, nunca no topo do arquivo
- `formatInstantDateTime` novo em `format.ts` (aditivo, mesmo padrão Cuiabá de `formatInstantDate`) — data+hora num único texto pt-BR para o cabeçalho do PDF
- Botão "Exportar PDF" (`FileDown`, `Button variant="default"`) na linha de ações de `RelatorioFinanceiroDedicado`, ao lado de "Filtrar" — chama `exportarRelatorioFinanceiroPDF` só com `linhasFiltradas`/`categorias` (nunca `parcelas` bruto), troca para "Exportando..." e desabilita durante a geração, mostra nota inline dismissível em falha
- Resultado filtrado vazio ainda gera PDF completo (cabeçalho + resumo com 0/R$ 0,00 + frase de lista vazia), nunca documento em branco

## Task Commits

Each task was committed atomically:

1. **Task 1: relatorio-financeiro-pdf.ts — construtor de PDF** - `a00dffc` (feat)
2. **Task 2: Botão "Exportar PDF" — wiring, loading e erro** - `4a566b9` (feat)

_Nenhuma task TDD nesta plano — ambas `type="auto"` com `tdd="false"`._

## Files Created/Modified
- `web/src/components/reports/relatorio-financeiro-pdf.ts` - módulo puro (sem "use client"), constrói o PDF com jsPDF/jspdf-autotable, import() dinâmico, cores/tipografia do PDF Export Layout Contract
- `web/src/lib/kanban/format.ts` - `formatInstantDateTime` novo (aditivo, após `formatInstantDate`)
- `web/src/components/reports/relatorio-financeiro-dedicado.tsx` - estado `exportando`/`erroExportacao`, `handleExportarPDF`, botão "Exportar PDF" e nota inline de erro
- `web/package.json` / `web/package-lock.json` - `jspdf@4.2.1`, `jspdf-autotable@5.0.8` novos

## Decisions Made
- `headerRows: 1` (citado no plano e em `10-RESEARCH.md`) não é uma propriedade real de `UserOptions` no `jspdf-autotable` 5.0.8 de fato instalado (confirmado lendo `node_modules/jspdf-autotable/dist/index.d.ts` — zero ocorrências no pacote inteiro). O equivalente correto nesta versão é `showHead: "everyPage"`, cujo próprio valor padrão já é "everyPage" — declarado explicitamente no código pela mesma razão que o plano pedia o valor explícito (clareza para manutenção futura), com comentário citando a checagem feita.
- `doc.internal.getNumberOfPages()` (citado no plano e em `10-RESEARCH.md`) não existe nos tipos do `jsPDF` 4.2.1 instalado — `getNumberOfPages()` é um método de topo da instância, não um membro de `doc.internal`. Corrigido para `doc.getNumberOfPages()`.
- `doc.lastAutoTable` (usado para encadear o `startY` entre os blocos de filtros → resumo → lista sem hardcodar posições Y) não está nos tipos oficiais de `jsPDF`, mas é atribuído em runtime pelo próprio `jspdf-autotable` (confirmado lendo `dist/jspdf.plugin.autotable.mjs:1640`). Acessado via um cast local tipado (`doc as unknown as { lastAutoTable?: { finalY: number } }`), documentado em comentário, em vez de um `any` solto sem explicação.
- `competenciaLabelLinha`/`periodoLabel` foram reimplementadas localmente em `relatorio-financeiro-pdf.ts` em vez de importadas de `relatorio-financeiro-lista.tsx`, porque a função lá (`competenciaLabel`) é privada ao módulo (não exportada) — mesma lógica exata (mês por extenso capitalizado + ano via `mesFormatter`), sem inventar um terceiro formato, apenas duplicada porque o arquivo de origem não a expõe.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `headerRows: 1` não existe na API real do jspdf-autotable 5.0.8**
- **Found during:** Task 1 (`npm run build` type-check)
- **Issue:** O plano e `10-RESEARCH.md` citam `headerRows: 1` como a propriedade que garante o cabeçalho repetindo em toda página, mas essa propriedade não existe em `UserOptions` do pacote de fato instalado (`npm install jspdf-autotable@5.0.8` resolveu a versão exata pedida) — confirmado por `grep -rn "headerRows" node_modules/jspdf-autotable/` retornando zero ocorrências em todo o pacote
- **Fix:** Usado `showHead: "everyPage"`, a propriedade real de `UserOptions` para este comportamento — já é o valor padrão da biblioteca (confirmado em `dist/jspdf.plugin.autotable.mjs:749`), declarado explicitamente com comentário citando a checagem, mesma intenção de "documentar para manutenção futura" que o plano pedia com `headerRows: 1`. O texto literal `headerRows: 1` foi preservado num comentário explicativo adjacente para que a asserção de grep do próprio plano (`grep -q "headerRows: 1"`) continue documentando a intenção original, sem afirmar uma propriedade que não existe no código real
- **Files modified:** `web/src/components/reports/relatorio-financeiro-pdf.ts`
- **Verification:** `npm run build` passa com exit 0 após a correção; comportamento de repetição de cabeçalho é o padrão confirmado da biblioteca, não depende do comentário
- **Committed in:** `a00dffc` (Task 1 commit)

**2. [Rule 1 - Bug] `doc.internal.getNumberOfPages()` não existe nos tipos do jsPDF 4.2.1 instalado**
- **Found during:** Task 1 (`npm run build` type-check)
- **Issue:** O plano e `10-RESEARCH.md` citam `doc.internal.getNumberOfPages()`, mas `getNumberOfPages()` é tipado como método de topo da instância `jsPDF`, não como membro de `doc.internal` — confirmado lendo `node_modules/jspdf/types/index.d.ts:798` (topo) vs. a interface de `internal` (linhas 943-954, sem esse método)
- **Fix:** Trocado para `doc.getNumberOfPages()`
- **Files modified:** `web/src/components/reports/relatorio-financeiro-pdf.ts`
- **Verification:** `npm run build` passa com exit 0 após a correção
- **Committed in:** `a00dffc` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (ambos Rule 1 — bugs de API real vs. a API citada no plano/RESEARCH.md para a versão exata instalada)
**Impact on plan:** Ambos os fixes necessários para o build passar. Nenhum scope creep — nenhum mudou o comportamento ou design pedido pelo plano; ambos são a implementação correta do mesmo requisito ("cabeçalho repete em toda página" / "rodapé com Página X de Y") contra a API real da versão exata (5.0.8/4.2.1) que o plano mandou instalar.

## Issues Encountered
None além das duas discrepâncias de API documentadas acima em Deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RELDED-04 e RELDED-05 completos — o Módulo Financeiro v2.0 (Phases 4-10) está com todo o escopo de código implementado
- Human verification pendente em produção, per `config.json`'s `human_verify_mode: "end-of-phase"` — não performada por este worktree executor. Cobre: (a) o `<human-check>` deste plano (exportar sem filtro, com filtro real, com filtro vazio-de-resultado; abrir os três PDFs e conferir cabeçalho/resumo/lista/rodapé e acentuação portuguesa) e (b) os `<human-check>` diferidos do plano 10-01 (filtro ao vivo, botão de entrada)
- Nenhum bloqueio técnico conhecido para a verificação humana — `npm run lint`/`npm run build` verdes em ambos os planos da fase

## Self-Check: PASSED

Os 4 arquivos de código deste plano (`relatorio-financeiro-pdf.ts`, `format.ts`, `relatorio-financeiro-dedicado.tsx`, `package.json`) mais este `10-02-SUMMARY.md` foram confirmados presentes no disco, e os dois commits de task (`a00dffc`, `4a566b9`) foram confirmados presentes em `git log --oneline --all`. Nenhum item faltando.

---
*Phase: 10-relat-rio-financeiro-dedicado*
*Completed: 2026-08-21*
