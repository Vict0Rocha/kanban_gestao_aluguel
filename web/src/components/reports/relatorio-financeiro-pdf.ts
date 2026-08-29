import { formatCurrency, formatDate, formatInstantDateTime } from "@/lib/kanban/format"
import { situacaoDaParcela, somarLancamentos } from "@/lib/kanban/parcelas"
import {
  SITUACAO_RELATORIO_ORDEM,
  type CategoriaRelatorio,
  type FiltroRelatorioValores,
  type ParcelaRelatorio,
  type SituacaoRelatorio,
} from "@/lib/kanban/relatorio-financeiro"

/**
 * Módulo puro — sem "use client", sem `import` estático de `jspdf`/
 * `jspdf-autotable` no topo do arquivo (RESEARCH.md Pitfall #3: qualquer
 * import de topo de nível de módulo dessas duas bibliotecas quebra a
 * renderização SSR desta rota, que é um Server Component por padrão). As
 * duas só entram via `import()` dinâmico, dentro da função abaixo.
 */

/** Intervalo de/até ("YYYY-MM-DD" cada) vira "dd/mm/aaaa a dd/mm/aaaa" — cada lado vazio relaxa aquele limite. */
function periodoLabel(periodoInicio: string, periodoFim: string): string {
  if (!periodoInicio && !periodoFim) return "Todos"
  if (periodoInicio && periodoFim)
    return `${formatDate(periodoInicio)} a ${formatDate(periodoFim)}`
  if (periodoInicio) return `A partir de ${formatDate(periodoInicio)}`
  return `Até ${formatDate(periodoFim)}`
}

/** Mesmo rótulo plural do bloco de resumo em tela (`StatTile`, Task 1 desta plano). */
const SITUACAO_ROTULO_PLURAL: Record<SituacaoRelatorio, string> = {
  paga: "Pagas",
  a_vencer: "A vencer",
  vencida: "Vencidas",
  conciliada: "Conciliadas",
}

/** Mesmo rótulo singular do `ParcelaSituacaoBadge` — usado na coluna Situação da lista. */
const SITUACAO_ROTULO_SINGULAR: Record<SituacaoRelatorio, string> = {
  paga: "Paga",
  a_vencer: "A vencer",
  vencida: "Vencida",
  conciliada: "Conciliada",
}

export async function exportarRelatorioFinanceiroPDF(
  linhas: ParcelaRelatorio[],
  categorias: CategoriaRelatorio[],
  filtro: FiltroRelatorioValores,
  hojeISO: string
): Promise<void> {
  // RESEARCH.md Pitfall #3: só aqui dentro da função, nunca no topo do arquivo.
  const { jsPDF } = await import("jspdf")
  const { autoTable } = await import("jspdf-autotable")

  const geradoEmISO = new Date().toISOString()

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
  // jspdf-autotable atribui `lastAutoTable` na instância em runtime (não
  // documentado no tipo de `jsPDF`, mas confirmado lendo o próprio pacote
  // instalado, dist/jspdf.plugin.autotable.mjs:1640) — necessário para
  // encadear o `startY` do próximo bloco sem hardcodar posições.
  const docComAutoTable = doc as unknown as { lastAutoTable?: { finalY: number } }

  // Cores (RGB explícito, convertido dos hex do "PDF Export Layout Contract"
  // em 10-UI-SPEC.md) — nenhuma outra cor aparece no documento.
  const foreground: [number, number, number] = [38, 38, 38] // #262626
  const headerFill: [number, number, number] = [242, 242, 242] // #f2f2f2
  const border: [number, number, number] = [217, 217, 217] // #d9d9d9
  const muted: [number, number, number] = [107, 107, 107] // #6b6b6b
  const rowShade: [number, number, number] = [247, 247, 247] // zebra, distinct from headerFill

  // jsPDF só tem dois estilos nativos de fonte via `doc.setFont(fontName,
  // style)` — "normal"/"bold" — sem um terceiro estilo intermediário. O
  // orçamento de 2 pesos do contrato (400 regular / 600 semibold) mapeia
  // direto para "normal"/"bold" respectivamente: é o próprio vocabulário do
  // jsPDF, não uma introdução de peso 700/800.

  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 40

  // --- Bloco de cabeçalho (página 1) ---
  doc.setFont("helvetica", "bold")
  doc.setFontSize(19)
  doc.setTextColor(...foreground)
  doc.text("Relatório Financeiro", marginX, 50)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(...muted)
  doc.text(`Gerado em ${formatInstantDateTime(geradoEmISO)}`, pageWidth - marginX, 50, {
    align: "right",
  })

  const situacoesAtivas =
    filtro.situacoes.size === 0
      ? "Todas"
      : SITUACAO_RELATORIO_ORDEM.filter((s) => filtro.situacoes.has(s))
          .map((s) => SITUACAO_ROTULO_PLURAL[s])
          .join(", ")

  const periodoAtivo = periodoLabel(filtro.periodoInicio, filtro.periodoFim)

  autoTable(doc, {
    startY: 66,
    theme: "grid",
    body: [
      ["Imóvel", filtro.imovel.trim() || "Todos"],
      ["Proprietário", filtro.proprietario.trim() || "Todos"],
      ["Período", periodoAtivo],
      ["Situação", situacoesAtivas],
    ],
    styles: {
      fontSize: 9,
      textColor: foreground,
      lineColor: border,
      cellPadding: 5,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 90 },
    },
  })

  // --- Bloco de resumo (mesmos 4 totais já mostrados em tela pelos StatTile) ---
  const afterFiltrosY = docComAutoTable.lastAutoTable?.finalY ?? 66

  autoTable(doc, {
    startY: afterFiltrosY + 16,
    theme: "grid",
    body: SITUACAO_RELATORIO_ORDEM.map((situacao) => {
      const categoria = categorias.find((c) => c.situacao === situacao)
      const quantidade = categoria?.quantidade ?? 0
      const total = categoria?.total ?? 0
      return [SITUACAO_ROTULO_PLURAL[situacao], `${quantidade} · ${formatCurrency(total)}`]
    }),
    styles: {
      fontSize: 9,
      textColor: foreground,
      lineColor: border,
      cellPadding: 5,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 90 },
    },
  })

  const afterResumoY = docComAutoTable.lastAutoTable?.finalY ?? afterFiltrosY + 16

  // --- Lista ---
  if (linhas.length === 0) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.setTextColor(...muted)
    doc.text(
      "Nenhuma parcela encontrada para os filtros aplicados.",
      marginX,
      afterResumoY + 24
    )
  } else {
    // bodyRows computado uma única vez — o `valor` situação-dependente é
    // reusado tanto na célula renderizada quanto na soma do Total (Don't
    // Hand-Roll, RESEARCH.md); nunca re-derivado uma segunda vez.
    const bodyRows = linhas.map((l) => {
      const situacao = situacaoDaParcela(
        l.status,
        l.vencimento,
        hojeISO
      ) as SituacaoRelatorio
      const { valorDevido, valorPago } = somarLancamentos(
        l.valor_original,
        l.parcela_lancamentos
      )
      const valor =
        situacao === "paga" || situacao === "conciliada"
          ? valorPago
          : Math.max(valorDevido - valorPago, 0)
      return {
        valor,
        cells: [
          l.cards?.endereco ?? "",
          l.cards?.proprietario ?? "",
          l.cards?.inquilino ?? "",
          formatDate(l.vencimento),
          SITUACAO_ROTULO_SINGULAR[situacao],
          formatCurrency(valor),
        ],
      }
    })
    const totalValor = bodyRows.reduce((acc, r) => acc + r.valor, 0)

    autoTable(doc, {
      startY: afterResumoY + 16,
      theme: "plain",
      head: [["Imóvel", "Proprietário", "Inquilino", "Vencimento", "Situação", "Valor"]],
      // Mesma ordenação cronológica (linhas já vem ordenada por vencimento de
      // quem chamou — não reordenada aqui).
      body: bodyRows.map((r) => r.cells),
      foot: [
        [
          { content: "Total", colSpan: 5 },
          { content: formatCurrency(totalValor), styles: { halign: "right" } },
        ],
      ],
      // showFoot explícito: nunca deixar no default "everyPage" da
      // biblioteca, que repetiria o Total em cada página de um export com
      // 2+ páginas (Pitfall 3, RESEARCH.md).
      showFoot: "lastPage",
      // Padrão da biblioteca: o cabeçalho repete em toda nova página. Não
      // desligar — RESEARCH.md "Don't Hand-Roll" e o Layout Contract §4
      // exigem isso na escala de produção (~350+ parcelas). `headerRows: 1`
      // (citado no plano/RESEARCH.md) não é uma propriedade real de
      // `UserOptions` no `jspdf-autotable` 5.0.8 de fato instalado —
      // confirmado lendo `node_modules/jspdf-autotable/dist/index.d.ts`
      // (zero ocorrências de "headerRows" em todo o pacote). O equivalente
      // real nesta versão é `showHead: "everyPage"`, cujo próprio valor
      // padrão já é "everyPage" (confirmado em
      // dist/jspdf.plugin.autotable.mjs:749) — declarado explicitamente
      // abaixo pela mesma razão que o plano pedia `headerRows: 1`: para que
      // uma manutenção futura não desative por engano.
      showHead: "everyPage",
      styles: {
        fontSize: 9,
        textColor: foreground,
        lineColor: border,
        // Linha horizontal sutil só embaixo de cada célula — nunca `top`
        // junto com `bottom`, dobraria a linha renderizada em cada fronteira
        // de linha (Anti-Pattern, RESEARCH.md).
        lineWidth: { top: 0, right: 0, bottom: 0.75, left: 0 },
        cellPadding: 5,
      },
      headStyles: { fontStyle: "bold", fillColor: headerFill, textColor: foreground },
      footStyles: { fontStyle: "bold", fillColor: headerFill, textColor: foreground },
      alternateRowStyles: { fillColor: rowShade },
      columnStyles: { 5: { halign: "right" } },
    })
  }

  // --- Rodapé (todas as páginas) ---
  // O total de páginas só é conhecido depois do layout da tabela terminar.
  // `getNumberOfPages()` é método de topo de `jsPDF`, não de `doc.internal`
  // (RESEARCH.md/UI-SPEC citam `doc.internal.getNumberOfPages()`, mas o
  // pacote 4.2.1 realmente instalado tipa só `doc.getNumberOfPages()` —
  // confirmado lendo `jspdf/types/index.d.ts`).
  const totalPaginas = doc.getNumberOfPages()
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...muted)
    doc.text(
      `Página ${i} de ${totalPaginas}`,
      doc.internal.pageSize.getWidth() - marginX,
      doc.internal.pageSize.getHeight() - 20,
      { align: "right" }
    )
    doc.text(
      "Kanban Aluguel — gerado em " + formatDate(hojeISO),
      marginX,
      doc.internal.pageSize.getHeight() - 20
    )
  }

  // hojeISO ("YYYY-MM-DD") é seguro em nome de arquivo — nunca geradoEmISO
  // bruto, que contém ":", inválido no Windows.
  doc.save(`relatorio-financeiro-${hojeISO}.pdf`)
}
