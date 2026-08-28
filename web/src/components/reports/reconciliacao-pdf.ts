import { formatCurrency, formatDate, formatInstantDateTime } from "@/lib/kanban/format"
import type {
  FiltroReconciliacaoValores,
  ReconciliacaoTotais,
} from "@/lib/kanban/reconciliacao"

/**
 * Módulo puro — sem "use client", sem `import` estático de `jspdf`/
 * `jspdf-autotable` no topo do arquivo (RESEARCH.md Pitfall #1: qualquer
 * import de topo de nível de módulo dessas duas bibliotecas quebra a
 * renderização SSR de `/relatorios/imobiliaria`, que é um Server Component
 * por padrão). As duas só entram via `import()` dinâmico, dentro da função
 * abaixo. Espelha `relatorio-financeiro-pdf.ts` bloco a bloco (D-05,
 * 19-CONTEXT.md).
 */

/** Mesma forma de `LinhaLista` (dinheiro-imobiliaria-view.tsx) — só os
 *  campos que este módulo realmente lê. `tipoLabel` (string), nunca `tipo`
 *  (JSX) — Pitfall #2. */
type LinhaListaPDF = {
  id: string
  data: string
  valor: number
  tipoLabel: string
  observacao: string | null
  cards: {
    endereco: string
    proprietario: string
    numero: number
    inquilino: string | null
  } | null
}

const mesFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long" })

/**
 * Mesma composição de `periodoLabel` em `relatorio-financeiro-pdf.ts` (não
 * exportado de lá, reimplementado aqui identicamente) — "YYYY-MM" vira "Mês
 * por extenso capitalizado + ano".
 */
function periodoLabel(periodo: string): string {
  const [ano, mes] = periodo.split("-").map(Number)
  const mesPorExtenso = mesFormatter.format(new Date(ano, mes - 1, 1))
  return mesPorExtenso.charAt(0).toUpperCase() + mesPorExtenso.slice(1) + ` de ${ano}`
}

export async function exportarReconciliacaoPDF(
  linhas: LinhaListaPDF[],
  totais: ReconciliacaoTotais,
  filtro: FiltroReconciliacaoValores,
  hojeISO: string
): Promise<void> {
  // RESEARCH.md Pitfall #1: só aqui dentro da função, nunca no topo do arquivo.
  const { jsPDF } = await import("jspdf")
  const { autoTable } = await import("jspdf-autotable")

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" })
  // jspdf-autotable atribui `lastAutoTable` na instância em runtime (não
  // documentado no tipo de `jsPDF`, confirmado em relatorio-financeiro-pdf.ts)
  // — necessário para encadear o `startY` do próximo bloco sem hardcodar
  // posições.
  const docComAutoTable = doc as unknown as { lastAutoTable?: { finalY: number } }

  // Mesmas cores (RGB explícito, mesmos hex) do "PDF Export Layout Contract"
  // em 10-UI-SPEC.md, já em uso por relatorio-financeiro-pdf.ts.
  const foreground: [number, number, number] = [24, 52, 28] // #18341c
  const muted: [number, number, number] = [92, 112, 96] // #5c7060
  const border: [number, number, number] = [219, 238, 212] // #dbeed4
  const rowShade: [number, number, number] = [234, 246, 230] // #eaf6e6

  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 40

  // --- Bloco de cabeçalho (página 1) ---
  doc.setFont("helvetica", "bold")
  doc.setFontSize(19)
  doc.setTextColor(...foreground)
  doc.text("Dinheiro da imobiliária", marginX, 50)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(...muted)
  doc.text(
    `Gerado em ${formatInstantDateTime(new Date().toISOString())}`,
    pageWidth - marginX,
    50,
    { align: "right" }
  )

  const periodoAtivo = /^\d{4}-\d{2}$/.test(filtro.periodo)
    ? periodoLabel(filtro.periodo)
    : "Todos"

  // --- Tabela de filtros ativos (5 linhas, D-03) ---
  autoTable(doc, {
    startY: 66,
    theme: "grid",
    body: [
      ["Imóvel", filtro.imovel.trim() || "Todos"],
      ["Proprietário", filtro.proprietario.trim() || "Todos"],
      ["Inquilino", filtro.inquilino.trim() || "Todos"],
      ["ID do contrato", filtro.id.trim() || "Todos"],
      ["Período", periodoAtivo],
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

  const afterFiltrosY = docComAutoTable.lastAutoTable?.finalY ?? 66

  // --- Bloco de resumo (mesmos 6 totais já mostrados em tela pelos StatTile) ---
  autoTable(doc, {
    startY: afterFiltrosY + 16,
    theme: "grid",
    body: [
      ["Administração", formatCurrency(totais.administracao)],
      ["Comissão 1º aluguel", formatCurrency(totais.comissao)],
      ["Total recebido", formatCurrency(totais.totalRecebido)],
      ["Caução recebida", formatCurrency(totais.caucaoRecebida)],
      ["Caução devolvida", formatCurrency(totais.caucaoDevolvida)],
      ["Caução usada", formatCurrency(totais.caucaoUsada)],
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

  const afterResumoY = docComAutoTable.lastAutoTable?.finalY ?? afterFiltrosY + 16

  // --- Lista ---
  if (linhas.length === 0) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.setTextColor(...muted)
    doc.text(
      "Nenhuma taxa ou movimento de caução encontrado para os filtros aplicados.",
      marginX,
      afterResumoY + 24
    )
  } else {
    autoTable(doc, {
      startY: afterResumoY + 16,
      head: [["Data", "Contrato", "Tipo", "Valor", "Observação"]],
      // linhas já vem ordenada (DESC — dinheiro-imobiliaria-view.tsx:91-98
      // "linhas" memo): nunca reordenar aqui (Anti-Pattern, 19-RESEARCH.md).
      body: linhas.map((l) => [
        formatDate(l.data),
        `#${l.cards?.numero ?? 0} ${l.cards?.endereco ?? ""}`,
        l.tipoLabel,
        formatCurrency(l.valor),
        l.observacao ?? "",
      ]),
      // Padrão da biblioteca: o cabeçalho repete em toda nova página.
      // `headerRows` não é uma propriedade real de `UserOptions` no
      // `jspdf-autotable` 5.0.8 instalado — `showHead: "everyPage"` é o
      // equivalente real, declarado explicitamente (Pitfall #4).
      showHead: "everyPage",
      styles: { fontSize: 9, textColor: foreground, lineColor: border },
      headStyles: { fontStyle: "bold", fillColor: [255, 255, 255], textColor: foreground },
      alternateRowStyles: { fillColor: rowShade },
      columnStyles: { 3: { halign: "right" } },
    })
  }

  // --- Rodapé (todas as páginas) ---
  // `getNumberOfPages()` é método de topo de `jsPDF`, não de `doc.internal`
  // (Pitfall #3, confirmado lendo `jspdf/types/index.d.ts`).
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

  // hojeISO ("YYYY-MM-DD") é seguro em nome de arquivo — nunca a data
  // "gerado em" bruta, que contém ":", inválido no Windows.
  doc.save(`dinheiro-imobiliaria-${hojeISO}.pdf`)
}
