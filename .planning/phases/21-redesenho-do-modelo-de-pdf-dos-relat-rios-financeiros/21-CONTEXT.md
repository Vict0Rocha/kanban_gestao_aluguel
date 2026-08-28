# Phase 21: Redesenho do modelo de PDF dos relatórios financeiros - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning

<domain>
## Phase Boundary

O projeto tem dois PDFs exportáveis, ambos gerados client-side com `jsPDF`+`jspdf-autotable`: o Relatório Financeiro dedicado (`relatorio-financeiro-pdf.ts`, Phase 10) e o Dinheiro da imobiliária (`reconciliacao-pdf.ts`, Phase 19/20). Os dois seguem hoje o mesmo "PDF Export Layout Contract" (`10-UI-SPEC.md`): A4 retrato, paleta verde clara (`#18341c`/`#5c7060`/`#dbeed4`/`#74ac1c`/`#eaf6e6`), sem linha de total. Esta fase substitui esse contrato por um novo, aplicado aos dois PDFs igualmente (mesma orientação/paleta/estilo de tabela/linha de total), sem tocar nas colunas de dado de nenhum dos dois (cada um mantém suas próprias colunas — dados diferentes) nem nos três blocos estruturais que já existem (título, filtros aplicados, totais/resumo) — só o visual desses blocos muda.

</domain>

<decisions>
## Implementation Decisions

### Orientação e escopo
- **D-01:** Os dois PDFs passam para **paisagem** (landscape), A4. Confirmado explicitamente pelo usuário.
- **D-02:** O redesenho vale para **os dois PDFs** — Relatório Financeiro dedicado e Dinheiro da imobiliária — com o mesmo visual novo (paleta, estilo de linha, cabeçalho/Total). Cada PDF mantém suas próprias colunas de dado, sem mudança nenhuma nelas nesta fase: Relatório Financeiro continua com Imóvel/Proprietário/Competência/Vencimento/Situação/Valor; Dinheiro da imobiliária continua com Data/Contrato (ID+proprietário)/Inquilino/Tipo/Valor/Observação (já ajustado na Phase 20 para espelhar a tela).

### Paleta de cores
- **D-03:** Paleta cinza, substituindo o verde inteiro do contrato atual — sem nenhuma cor viva (verde, vermelho ou azul saturado) em lugar nenhum do documento:
  - Texto principal: cinza bem escuro, quase preto (`#262626`)
  - Fundo do cabeçalho da tabela e da linha de Total: cinza bem claro (`#f2f2f2`)
  - Bordas/linhas: cinza (`#d9d9d9`)
  - Texto mudo (rótulos, rodapé): um cinza intermediário — o researcher escolhe o tom exato dentro da mesma família neutra, sem inventar uma cor fora dela
- Confirmado explicitamente pelo usuário depois de eu propor os hex acima como ponto de partida.

### Estilo da lista
- **D-04:** A lista (a tabela principal, com as linhas de movimento/parcela) usa **linha horizontal sutil** separando cada linha — **sem** borda vertical entre colunas (não é grade completa, ao contrário da primeira ideia discutida) — mais **zebra**: linhas alternando branco e cinza bem claro. Decisão final, confirmada explicitamente pelo usuário depois de mudar de ideia sobre grade completa.
- **D-05:** O cabeçalho da tabela (nomes das colunas) e a nova linha de Total têm fundo cinza claro (`#f2f2f2`) e texto em negrito — únicos elementos com fundo sólido na lista, contrastando com o corpo (branco/zebra).

### Linha de Total (nova)
- **D-06:** Uma linha **"Total"** nova, no final da lista (última linha da tabela), em negrito, com o mesmo fundo cinza do cabeçalho — soma a coluna **Valor** de todas as linhas efetivamente listadas no PDF (ou seja, já respeitando qualquer filtro aplicado — a mesma lista que o corpo da tabela mostra, nunca um total não-filtrado). Não existia antes em nenhum dos dois PDFs.

### Blocos estruturais (mantidos, só o visual muda)
- **D-07:** Os três blocos que já existem em cada PDF — (1) título + timestamp de geração, (2) tabela compacta de filtros aplicados, (3) bloco de totais/resumo (as 4 categorias no Relatório Financeiro, os 6 totais no Dinheiro da imobiliária) — **continuam existindo, sem cortar nenhum**, só passam a usar a nova paleta cinza em vez do verde atual. Confirmado explicitamente pelo usuário ("mantém os 3, só troca o visual") depois de eu perguntar se algum deveria ser cortado por "poluir".

### Referência visual
- **D-08:** O usuário anexou um print de um relatório do software Sienge ("Contas a Pagar por Apropriação Financeira") — explicitamente **não é para copiar igual**, é só um guia de estilo geral (tabela em grade, cabeçalho/total com fundo sutil, alinhamento numérico à direita, visual limpo tipo planilha/ERP corporativo), a adaptar para a realidade mais simples deste projeto. Mesmo padrão já usado na Phase 10, cujo `10-UI-SPEC.md` (§ PDF Export Layout Contract) já cita explicitamente uma referência Sienge anterior como inspiração estrutural (não literal) para os blocos de filtro/totais já existentes — esta fase segue a mesma disciplina de "adaptar, não copiar" já documentada ali.

### Claude's Discretion
- Tom exato do cinza de texto mudo (rótulos/rodapé) — dentro da mesma família neutra dos hex já travados.
- Tamanhos de fonte/margens exatos para a versão paisagem — pode reusar os valores atuais (9-10pt corpo, 18-20pt título) se couberem bem na largura maior, ou ajustar levemente; não é uma decisão de produto.
- Mecanismo exato do `jspdf-autotable` para produzir "sem borda vertical + linha horizontal sutil + zebra" (tema `"plain"` com `borderStyle` customizado, ou outra combinação de opções da biblioteca) — decisão técnica do researcher/planner.
- Se o "PDF Export Layout Contract" em `10-UI-SPEC.md` deve ser atualizado in-place para refletir a nova paleta/estilo, ou se um novo documento substitui/complementa — decisão de onde documentar, não do que documentar (o que documentar já está travado acima).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Contrato de layout atual (a substituir)
- `.planning/phases/10-relat-rio-financeiro-dedicado/10-UI-SPEC.md` § "PDF Export Layout Contract" (linhas ~159-217) — o contrato atual completo (paleta verde, A4 retrato, tipografia, os três blocos estruturais, footer) que esta fase substitui na paleta/orientação/estilo de linha, mas cujos blocos estruturais (D-07) e disciplina de "adaptar referência, não copiar" (D-08) permanecem válidos.

### Módulos de PDF a modificar
- `web/src/components/reports/relatorio-financeiro-pdf.ts` — módulo completo do PDF do Relatório Financeiro (cores, tipografia, `theme: "grid"` nos blocos de cabeçalho/resumo hoje, `jspdf-autotable` para a lista).
- `web/src/components/reports/reconciliacao-pdf.ts` — módulo completo do PDF de Dinheiro da imobiliária, espelha o anterior bloco a bloco (Phase 19) — os dois devem evoluir juntos e continuar espelhados um no outro depois desta fase.

### Dados para a linha de Total
- `web/src/components/reports/relatorio-financeiro-dedicado.tsx` — onde `linhas`/`categorias` já são calculados e passados para `exportarRelatorioFinanceiroPDF`; a soma de Valor para a nova linha de Total pode ser calculada dentro do módulo de PDF a partir de `linhas`, sem mudança nesse componente.
- `web/src/components/reports/dinheiro-imobiliaria-view.tsx` — mesma coisa para `exportarReconciliacaoPDF`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `jspdf-autotable` — já em uso nos dois módulos; suas opções de tema/borda (`theme`, `styles.lineWidth`, `styles.lineColor`, cores alternadas) são reutilizáveis para o novo estilo, sem biblioteca nova.

### Established Patterns
- Os dois módulos de PDF já são espelhados bloco a bloco (mesma estrutura, mesmas constantes de cor, mesmo padrão de import dinâmico) — essa disciplina de manter os dois sincronizados deve continuar depois desta fase.
- Import dinâmico de `jspdf`/`jspdf-autotable` só dentro da função exportada, nunca no topo do módulo (pitfall documentado nos dois arquivos, motivo: SSR).

### Integration Points
- Nenhuma mudança fora dos dois módulos de PDF é esperada — os componentes de view (`relatorio-financeiro-dedicado.tsx`, `dinheiro-imobiliaria-view.tsx`) já passam `linhas`/totais para as funções de exportação; a linha de Total é calculada dentro do próprio módulo de PDF a partir do que já recebe.

</code_context>

<specifics>
## Specific Ideas

O usuário pediu, com um print de referência anexado (relatório "Contas a Pagar por Apropriação Financeira" do Sienge): PDF em paisagem, colunas de Dinheiro da imobiliária espelhando a tela (Data/Contrato com ID+proprietário/Inquilino/Tipo/Valor/Observação — já é o caso desde a Phase 20), cor cinza bem clara e sutil no lugar do verde atual, visual profissional/corporativo, linha de total no final, e "simples, objetivo, fácil entendimento, sem poluir". Foi explícito que a imagem é só um guia de estilo, não para copiar igual — "adapte para nossa realidade".

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)
None — nenhum todo pendente encontrado para esta fase.

</deferred>

---

*Phase: 21-Redesenho do modelo de PDF dos relatórios financeiros*
*Context gathered: 2026-08-28*
