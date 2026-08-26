# Phase 14: Cancelamento de taxas e caução - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 9 (2 migration/schema, 3 lib, 4 components)
**Analogs found:** 9 / 9 (100% — fase é extensão pura de padrões já em produção; RESEARCH.md já fez boa parte deste trabalho linha a linha, esta tabela consolida para o planner)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/20260826000000_taxas_imobiliaria_lancamento_id.sql` (NOVO) | migration | CRUD (schema) | `supabase/migrations/20260824000000_dinheiro_imobiliaria.sql` | exact |
| `web/src/lib/kanban/actions.ts` → `cancelarTaxaImobiliariaAction` (NOVA função) | service (Server Action) | CRUD (DELETE condicionado) | `cancelarLancamentoAction` (mesmo arquivo, linhas 1415-1455) | exact |
| `web/src/lib/kanban/actions.ts` → `cancelarEventoCaucaoAction` (NOVA função) | service (Server Action) | CRUD (SELECT + DELETE condicionado, 2 etapas) | `destravarParcelaAction` (mesmo arquivo, linhas 1321-1396) — para a checagem de 2 etapas; `cancelarLancamentoAction` — para a forma do DELETE final | exact |
| `web/src/lib/kanban/actions.ts` → `registrarPagamentoAction` (MODIFICADA) | service (Server Action) | CRUD (INSERT) | ela mesma (linhas 1169-1182, INSERT de `taxas_imobiliaria`) | exact — só adicionar 1 campo ao payload |
| `web/src/lib/kanban/parcelas.ts` (tipos + `montarLinhas`) | model/transform | transform | ela mesma (`LancamentoDetalhado`, `ParcelaComCard`, `montarLinhas` linhas 21-30, 46-65, 444-487) | exact |
| `web/src/lib/kanban/queries.ts` (2 novos wrappers) | service (client wrapper) | request-response | `cancelarLancamento` (wrapper existente de `cancelarLancamentoAction`) | exact |
| `web/src/components/financeiro/taxa-origem-label.tsx` (NOVO) | component | transform (apresentação pura) | `web/src/components/financeiro/caucao-evento-label.tsx` (estrutura) e `TAXA_ORIGEM`/`TaxaOrigemBadge` de `dinheiro-imobiliaria-view.tsx:41-54` (conteúdo a promover) | exact |
| `web/src/components/financeiro/cancelar-lancamento-dialog.tsx` (MODIFICADO — generalizar) | component | request-response | ela mesma (versão atual, D-08 já generalizou de 1→3 tipos) | exact — precedente direto de generalização |
| `web/src/components/financeiro/parcela-historico-sheet.tsx` (MODIFICADO) | component | CRUD (render + trigger DELETE) | ela mesma (versão atual) | exact |
| `web/src/components/financeiro/caucao-historico-sheet.tsx` (MODIFICADO) | component | CRUD (render + trigger DELETE) | ela mesma (versão atual) + `parcela-historico-sheet.tsx` para o padrão de botão "Cancelar"/diálogo | exact |
| `web/src/app/(app)/financeiro/page.tsx` (SELECT_PARCELA_PADRAO/FILTRADA) | config (query string) | request-response | ela mesma (linhas 23-27, embed `parcela_lancamentos` já existente) | exact |

## Pattern Assignments

### `supabase/migrations/20260826000000_taxas_imobiliaria_lancamento_id.sql` (migration)

**Analog:** `supabase/migrations/20260824000000_dinheiro_imobiliaria.sql:111-157` (definição de `taxas_imobiliaria`, incluindo comentário-guarda de D-04 nas linhas 89-96)

**Padrão a copiar** — coluna aditiva nullable + FK com `on delete cascade` (100% das 7 FKs do schema usam esse padrão, zero exceção) + índice próprio, mesmo molde dos dois índices já existentes na tabela:

```sql
alter table public.taxas_imobiliaria
  add column if not exists lancamento_id uuid
    references public.parcela_lancamentos(id) on delete cascade;

create index if not exists taxas_imobiliaria_lancamento_id_idx
  on public.taxas_imobiliaria (lancamento_id);
```

**Comentário-guarda obrigatório** (Pitfall 1 do RESEARCH.md): declarar explicitamente que esta migração reabre D-04 (13-CONTEXT.md) **só** para `on delete cascade`, nunca para join de status — copiar o espírito do comentário-guarda original (`20260824000000...sql:94-96`, quote: `"Se algum dia uma coluna ou índice parecer útil para 'juntar' as duas tabelas, isso é o sinal de que D-04 está sendo violado"`).

**RLS/policy:** nenhuma nova — a policy `"team full access taxas_imobiliaria"` já existente cobre a coluna nova automaticamente (mesma tabela, mesma policy `all`).

---

### `cancelarTaxaImobiliariaAction` (NOVA, em `actions.ts`)

**Analog:** `cancelarLancamentoAction`, `web/src/lib/kanban/actions.ts:1415-1455`

**Core pattern a copiar** (DELETE condicionado + trava de conciliada reusada verbatim):

```typescript
// web/src/lib/kanban/actions.ts:1415-1455 (cancelarLancamentoAction, analog exato)
export async function cancelarLancamentoAction(
  parcelaId: string,
  lancamentoId: string
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(parcelaId, "Parcela") ?? id(lancamentoId, "Lançamento")
  if (invalido) return { ok: false, error: invalido }

  const recusaConciliada = await exigirParcelaNaoConciliada(sessao.supabase, parcelaId)
  if (recusaConciliada) return { ok: false, error: recusaConciliada }

  const { data, error } = await sessao.supabase
    .from("parcela_lancamentos")
    .delete()
    .eq("id", lancamentoId)
    .eq("parcela_id", parcelaId)
    .in("tipo", ["pagamento", "acrescimo", "desconto"])
    .select("id")

  if (error) return { ok: false, error: erroDoBanco(error.code, "cancelar o lançamento") }
  if (!data || data.length === 0) return { ok: false, error: semLinhas("cancelar o lançamento") }

  const erroStatus = await recalcularEGravarStatus(sessao.supabase, parcelaId)
  if (erroStatus) return { ok: false, error: erroStatus }

  return { ok: true, data: undefined }
}
```

**Diferenças para `cancelarTaxaImobiliariaAction`** (já resolvidas pelo RESEARCH.md, Pattern 2):
- tabela `taxas_imobiliaria` em vez de `parcela_lancamentos`
- sem `.in("tipo", [...])` — não existe coluna `tipo`, cada linha já É uma taxa
- **SEM** chamar `recalcularEGravarStatus` no final (D-04 de 13-CONTEXT.md: taxa nunca participa de status)

**Trava de conciliada a reusar verbatim:**
```typescript
// web/src/lib/kanban/actions.ts:993-1012
async function exigirParcelaNaoConciliada(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parcelaId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("parcelas")
    .select("status")
    .eq("id", parcelaId)
    .maybeSingle()

  if (error || !data) {
    console.error("trava de conciliada da parcela (leitura)", error)
    return MENSAGEM_PARCELA_OCULTA.indeterminado
  }
  if (data.status === "conciliada") {
    return MENSAGEM_PARCELA_CONCILIADA
  }
  return null
}
```

---

### `cancelarEventoCaucaoAction` (NOVA, em `actions.ts`)

**Analog para checagem em 2 etapas:** `destravarParcelaAction`, `web/src/lib/kanban/actions.ts:1321-1396`

**Padrão a copiar** (leitura recente tolera janela de corrida pequena, mesmo trade-off já aceito pelo projeto):

```typescript
// web/src/lib/kanban/actions.ts:1378-1380 — comentário que documenta a janela tolerada,
// mesmo raciocínio a aplicar na checagem "sou o evento mais recente" da caução
// "Sem condição adicional de status no `.eq` — o SELECT acima já confirmou
// `conciliada` poucos milissegundos antes, e o INSERT que acabou de
// acontecer é o que autoriza esta gravação."
```

**Analog para forma do DELETE final:** `cancelarLancamentoAction` (dois `.eq()` — id do registro + id do dono, nunca um DELETE sem o segundo `.eq`, evita IDOR entre contratos).

**Assembled pattern** (já resolvido em detalhe pelo RESEARCH.md, Pattern 3 — reproduzido aqui para referência rápida do planner):

```typescript
export async function cancelarEventoCaucaoAction(
  cardId: string,
  eventoId: string
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(cardId, "Imóvel") ?? id(eventoId, "Evento de caução")
  if (invalido) return { ok: false, error: invalido }

  const { data: maisRecente, error: erroLeitura } = await sessao.supabase
    .from("caucao_eventos")
    .select("id")
    .eq("card_id", cardId)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (erroLeitura || !maisRecente) {
    return { ok: false, error: erroDoBanco(erroLeitura?.code, "cancelar o evento de caução") }
  }
  if (maisRecente.id !== eventoId) {
    return { ok: false, error: "Este não é mais o evento mais recente de caução — atualize a página." }
  }

  const { data, error } = await sessao.supabase
    .from("caucao_eventos")
    .delete()
    .eq("id", eventoId)
    .eq("card_id", cardId)
    .select("id")

  if (error) return { ok: false, error: erroDoBanco(error.code, "cancelar o evento de caução") }
  if (!data || data.length === 0) return { ok: false, error: semLinhas("cancelar o evento de caução") }

  return { ok: true, data: undefined }
}
```

---

### `registrarPagamentoAction` (MODIFICADA, em `actions.ts`)

**Analog:** ela mesma, `web/src/lib/kanban/actions.ts:1065-1193`

**O que muda:** o `id` do lançamento já está disponível na função, capturado ANTES do insert de taxa:

```typescript
// web/src/lib/kanban/actions.ts:1096-1109
const { data: inserido, error } = await sessao.supabase
  .from("parcela_lancamentos")
  .insert({ parcela_id: parcelaId, tipo: "pagamento", valor, data, observacao: observacao?.trim() || null, criado_por: sessao.user.id })
  .select("id")
// ...
// linhas 1169-1182 — INSERT de taxas_imobiliaria, hoje SEM lancamento_id:
const { data: taxaInserida, error: erroTaxa } = await sessao.supabase
  .from("taxas_imobiliaria")
  .insert({
    parcela_id: parcelaId,
    card_id: cardIdDaTaxa,
    origem,
    valor: taxaImobiliaria,
    data,
    observacao: null,
    criado_por: sessao.user.id,
    // ADICIONAR: lancamento_id: inserido[0].id,
  })
  .select("id")
```

**Pitfall a evitar** (RESEARCH.md Pitfall 2): esquecer este único ponto de escrita faz a cascata nunca disparar para pagamentos novos — teste manual obrigatório após implementar.

---

### `web/src/lib/kanban/parcelas.ts` (tipos + `montarLinhas`)

**Analog:** ela mesma — `LancamentoDetalhado` (linhas 21-30), `ParcelaComCard` (linhas 46-65), `montarLinhas` (linhas 444-487)

**Tipos atuais a espelhar:**

```typescript
// web/src/lib/kanban/parcelas.ts:21-30
export type LancamentoDetalhado = {
  id: string
  tipo: "pagamento" | "acrescimo" | "desconto" | "destrava"
  valor: number
  data: string
  observacao: string | null
  motivo: string | null
  criado_em: string
  profiles: { full_name: string | null; email: string | null } | null
}

// web/src/lib/kanban/parcelas.ts:46-65
export type ParcelaComCard = {
  id: string
  card_id: string
  competencia: string
  vencimento: string
  valor_original: number
  status: StatusParcela
  cards: { /* ... */ } | null
  parcela_lancamentos: LancamentoDetalhado[] | null
  // NOVO: taxas_imobiliaria: TaxaHistorico[] | null
}
```

**Sort/merge pattern a estender** (já ordena `parcela_lancamentos` por `criado_em` desc — o novo histórico unificado usa exatamente a mesma comparação):

```typescript
// web/src/lib/kanban/parcelas.ts:454-458
const lancamentos = [...(parcela.parcela_lancamentos ?? [])].sort(
  (a, b) => (a.criado_em < b.criado_em ? 1 : a.criado_em > b.criado_em ? -1 : 0)
)
```

**Extensão recomendada (RESEARCH.md Pattern 1)** — mesmo comparador, aplicado a um array fundido:

```typescript
export type TaxaHistorico = {
  id: string
  origem: "administracao" | "comissao_primeiro_aluguel"
  valor: number
  data: string
  observacao: string | null
  criado_em: string
  profiles: { full_name: string | null; email: string | null } | null
}

export type LinhaHistoricoParcela =
  | (LancamentoDetalhado & { kind: "lancamento" })
  | (TaxaHistorico & { kind: "taxa" })

const historico: LinhaHistoricoParcela[] = [
  ...(parcela.parcela_lancamentos ?? []).map((l) => ({ ...l, kind: "lancamento" as const })),
  ...(parcela.taxas_imobiliaria ?? []).map((t) => ({ ...t, kind: "taxa" as const })),
].sort((a, b) => (a.criado_em < b.criado_em ? 1 : a.criado_em > b.criado_em ? -1 : 0))
```

**Não replicar:** o `React.useMemo` de merge client-side de `dinheiro-imobiliaria-view.tsx:84-98` — esse padrão existe só porque o relatório não tem filtro de parcela nenhum (lê todas as taxas de todos os contratos). Aqui há FK direta 1:N parcela→taxa, então o merge deve acontecer server-side em `montarLinhas`, não em `useMemo` de componente cliente.

---

### `web/src/app/(app)/financeiro/page.tsx` (SELECT_PARCELA_PADRAO/FILTRADA)

**Analog:** elas mesmas — embed `parcela_lancamentos` já existente nas mesmas constantes

```typescript
// web/src/app/(app)/financeiro/page.tsx:23-27 (texto exato hoje)
const SELECT_PARCELA_PADRAO =
  "id, card_id, competencia, vencimento, valor_original, status, cards!inner(endereco, proprietario, numero, ativo, periodo_inicio, periodo_fim, arquivado_em, percentual_administracao, percentual_comissao_primeiro_aluguel), parcela_lancamentos(id, tipo, valor, data, observacao, motivo, criado_em, profiles(full_name, email))"

const SELECT_PARCELA_FILTRADA =
  "id, card_id, competencia, vencimento, valor_original, status, cards!inner(endereco, proprietario, numero, inquilino, ativo, periodo_inicio, periodo_fim, arquivado_em, percentual_administracao, percentual_comissao_primeiro_aluguel), parcela_lancamentos(id, tipo, valor, data, observacao, motivo, criado_em, profiles(full_name, email))"
```

**A adicionar** (segundo embed, mesma forma de `parcela_lancamentos`):
```
, taxas_imobiliaria(id, origem, valor, data, observacao, criado_em, profiles(full_name, email))
```

---

### `web/src/components/financeiro/taxa-origem-label.tsx` (NOVO)

**Analog de estrutura:** `web/src/components/financeiro/caucao-evento-label.tsx` (arquivo completo, 41 linhas)

**Conteúdo a promover:** `TAXA_ORIGEM`/`TaxaOrigemBadge`, hoje local em `dinheiro-imobiliaria-view.tsx:41-54`

```typescript
// web/src/components/reports/dinheiro-imobiliaria-view.tsx:41-54 (conteúdo a mover/promover)
const TAXA_ORIGEM: Record<OrigemTaxa, { icon: LucideIcon; label: string }> = {
  administracao: { icon: Percent, label: "Administração" },
  comissao_primeiro_aluguel: { icon: Sparkles, label: "Comissão 1º aluguel" },
}

function TaxaOrigemBadge({ origem }: { origem: OrigemTaxa }) {
  const { icon: Icon, label } = TAXA_ORIGEM[origem]
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
      <Icon className="size-3.5 shrink-0" />
      {label}
    </span>
  )
}
```

**Forma final a copiar exatamente** (mesmo padrão de export/nomeação de `CaucaoEventoLabel`):

```typescript
// web/src/components/financeiro/caucao-evento-label.tsx:1-42 (molde completo, exceto o mapa em si)
import { cn } from "@/lib/utils"
import type { OrigemTaxa } from "@/lib/kanban/taxas"

export const TAXA_ORIGEM = {
  administracao: { icon: Percent, label: "Administração", className: "text-status-good" },
  comissao_primeiro_aluguel: { icon: Sparkles, label: "Comissão 1º aluguel", className: "text-status-warning" },
} as const

export function TaxaOrigemBadge({ origem }: { origem: OrigemTaxa }) {
  const { icon: Icon, label, className } = TAXA_ORIGEM[origem]
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", className)}>
      <Icon className="size-3.5 shrink-0" />
      {label}
    </span>
  )
}
```

**Depois da extração:** `dinheiro-imobiliaria-view.tsx` deve importar `TaxaOrigemBadge` de `taxa-origem-label.tsx` em vez de defini-lo localmente — atualizar o comentário na linha 36-39 que hoje diz "mapa local só desta view" (ficou obsoleto, esta é a segunda tela).

---

### `cancelar-lancamento-dialog.tsx` (MODIFICADO — generalizar, D-06)

**Analog:** ele mesmo, versão atual — `web/src/components/financeiro/cancelar-lancamento-dialog.tsx` (arquivo completo, 111 linhas)

**Estado atual (a generalizar):**

```typescript
// web/src/components/financeiro/cancelar-lancamento-dialog.tsx:29-50
export function CancelarLancamentoDialog({
  parcelaId,
  lancamentoId,
  tipo,
  valor,
  data,
  open,
  onOpenChange,
}: {
  parcelaId: string
  lancamentoId: string
  tipo: Extract<LancamentoDetalhado["tipo"], "pagamento" | "acrescimo" | "desconto">
  valor: number
  data: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // ...
  const rotulo = TIPO[tipo].label.toLowerCase()
```

**Por que `Extract<>` não escala mais** (RESEARCH.md Pattern 4): `OrigemTaxa` e `TipoCaucao` não compartilham o union `LancamentoDetalhado["tipo"]` nem o mapa `TIPO` — alargar `Extract<>` mais uma vez não compila.

**Recomendação (Pattern 4, RESEARCH.md):** trocar a prop `tipo` por `rotulo: string` já resolvida pelo chamador — cada Sheet passa o texto pronto (`TIPO[tipo].label`, `TAXA_ORIGEM[origem].label`, `CAUCAO_TIPO[tipo].label`):

```typescript
export function CancelarLancamentoDialog({
  parcelaId,
  lancamentoId,
  rotulo,   // "Pagamento" | "Acréscimo" | "Desconto" | "Taxa · Administração" | "Caução recebida" ...
  valor,
  data,
  open,
  onOpenChange,
}: {
  parcelaId: string
  lancamentoId: string
  rotulo: string
  valor: number
  data: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const rotuloMinusculo = rotulo.toLowerCase()
  // ... resto idêntico ao arquivo atual, trocando TIPO[tipo].label por `rotulo`/`rotuloMinusculo`
}
```

**Decisão de forma final (a resolver no planner):** como o diálogo dispara a Server Action certa — manter `parcelaId`/`lancamentoId` genéricos e adicionar uma prop `acao: "lancamento" | "taxa" | "caucao"` (3 valores, dispatch interno), ou receber `onConfirm: () => Promise<void>` já fechado pelo chamador. O restante do componente (estado `saving`/`error`, resync `wasOpen`, `AlertDialog` com `variant="destructive"`) é copiado sem mudança — só o texto de erro genérico (`"Não foi possível cancelar o ${rotulo}"`) muda de `${rotulo}` fixo em "lançamento" para o rótulo passado.

**Estrutura completa a preservar** (loading state, resync, AlertDialog):

```typescript
// web/src/components/financeiro/cancelar-lancamento-dialog.tsx:52-79 (padrão a manter idêntico)
const [wasOpen, setWasOpen] = React.useState(open)
if (open !== wasOpen) {
  setWasOpen(open)
  if (open) {
    setSaving(false)
    setError(null)
  }
}

async function handleConfirm() {
  setSaving(true)
  setError(null)
  try {
    await cancelarLancamento(parcelaId, lancamentoId)
    onOpenChange(false)
    router.refresh()
  } catch (err) {
    setError(err instanceof Error ? err.message : `Não foi possível cancelar o ${rotulo}. Tente novamente.`)
    setSaving(false)
  }
}
```

---

### `parcela-historico-sheet.tsx` (MODIFICADO)

**Analog:** ele mesmo, versão atual — `web/src/components/financeiro/parcela-historico-sheet.tsx` (arquivo completo, 139 linhas)

**Padrão de botão "Cancelar" condicional a estender** (hoje só para 3 tipos elegíveis, adicionar `kind === "taxa"`):

```typescript
// web/src/components/financeiro/parcela-historico-sheet.tsx:107-118
{["pagamento", "acrescimo", "desconto"].includes(lancamento.tipo) && !parcelaConciliada && (
  <div className="flex justify-end">
    <Button variant="ghost" size="xs" onClick={() => setCancelando(lancamento)}>
      <Trash2 className="size-3" />
      Cancelar
    </Button>
  </div>
)}
```

**Renderização a estender** (`historico[]` unificado em vez de só `lancamentos`, discriminando por `kind` para escolher `LancamentoTipoLabel` vs `TaxaOrigemBadge`):

```typescript
// web/src/components/financeiro/parcela-historico-sheet.tsx:76-121 (estrutura do .map a espelhar)
{lancamentos.map((lancamento) => {
  const quem = lancamento.profiles?.full_name ?? lancamento.profiles?.email ?? "—"
  return (
    <li key={lancamento.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <LancamentoTipoLabel tipo={lancamento.tipo} />
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {prefixoValor(lancamento.tipo, lancamento.valor)}
        </span>
      </div>
      {/* ... data, observacao, motivo, botão Cancelar */}
    </li>
  )
})}
```

**Dialog wiring atual (a trocar de `tipo=` para `rotulo=` após a generalização do D-06):**

```typescript
// web/src/components/financeiro/parcela-historico-sheet.tsx:126-136
<CancelarLancamentoDialog
  parcelaId={parcelaId}
  lancamentoId={cancelando?.id ?? ""}
  tipo={(cancelando?.tipo ?? "pagamento") as "pagamento" | "acrescimo" | "desconto"}
  valor={cancelando?.valor ?? 0}
  data={cancelando?.data ?? ""}
  open={cancelando !== null}
  onOpenChange={(open) => { if (!open) setCancelando(null) }}
/>
```

---

### `caucao-historico-sheet.tsx` (MODIFICADO)

**Analog:** ele mesmo, versão atual — `web/src/components/financeiro/caucao-historico-sheet.tsx` (arquivo completo, 135 linhas); e `parcela-historico-sheet.tsx` para o padrão de botão condicional + diálogo.

**Comentário a invalidar** (hoje explicitamente diz que não há cancelamento):
```typescript
// web/src/components/financeiro/caucao-historico-sheet.tsx:32-33 (comentário a atualizar)
// "Sem botão de cancelar por evento — caução é
// append-only sem mecanismo de cancelamento nesta fase."
```

**Ordenação confirmada** (base da regra "sou eu o mais recente" no cliente — RESEARCH.md Pitfall 3):
```typescript
// web/src/components/financeiro/caucao-historico-sheet.tsx:26-30 (comentário existente)
// "Ordem cronológica ASCENDENTE (mais antigo primeiro)"
```
→ "o mais recente" é sempre `eventos[eventos.length - 1]` (o último item do array `eventos` renderizado), **nunca** `eventos[0]`. Só esse item recebe o botão "Cancelar".

**Estrutura do `.map` a estender** (adicionar botão condicional no último item, mesmo padrão do sheet de parcela):

```typescript
// web/src/components/financeiro/caucao-historico-sheet.tsx:76-100 (estrutura atual)
{eventos.map((evento) => {
  const quem = evento.profiles?.full_name ?? evento.profiles?.email ?? "—"
  return (
    <li key={evento.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <CaucaoEventoLabel tipo={evento.tipo} />
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {prefixoValorCaucao(evento.tipo, evento.valor)}
        </span>
      </div>
      {/* ... data, observacao — ADICIONAR aqui o botão condicional só se evento === eventos[eventos.length-1] */}
    </li>
  )
})}
```

## Shared Patterns

### Trava de conciliada (CANIMOB-02, D-02)
**Source:** `exigirParcelaNaoConciliada`, `web/src/lib/kanban/actions.ts:993-1012`
**Apply to:** `cancelarTaxaImobiliariaAction` — reuso verbatim, mesma função, mesma chamada de `cancelarLancamentoAction:1428`.

### DELETE condicionado com dois `.eq()` (evita IDOR entre contratos)
**Source:** `cancelarLancamentoAction`, `web/src/lib/kanban/actions.ts:1431-1437`
**Apply to:** `cancelarTaxaImobiliariaAction` (`.eq("id", taxaId).eq("parcela_id", parcelaId)`) e `cancelarEventoCaucaoAction` (`.eq("id", eventoId).eq("card_id", cardId)`) — nunca um DELETE com um único `.eq`.

### Sanitização de erro do Postgres
**Source:** `erroDoBanco()`, usado em 100% do `actions.ts`
**Apply to:** todas as duas novas Server Actions — nunca expor `error.message` cru.

### Ícone + rótulo, nunca cor sozinha
**Source:** `TIPO`/`LancamentoTipoLabel` (`lancamento-tipo-label.tsx:11-47`), `CAUCAO_TIPO`/`CaucaoEventoLabel` (`caucao-evento-label.tsx:14-41`)
**Apply to:** `taxa-origem-label.tsx` (novo) — mesmo formato `Record<Chave, {icon, label, className}>` + componente `<span className="inline-flex items-center gap-1.5 text-xs font-semibold ...">`.

### Confirmação simples, DELETE real, sem motivo
**Source:** `CancelarLancamentoDialog` inteiro (`cancelar-lancamento-dialog.tsx`)
**Apply to:** generalização única (D-06) cobrindo taxa e caução — nenhum diálogo novo, um componente só com prop `rotulo: string`.

### Reconfirmar toda trava financeira no servidor, nunca confiar no cliente
**Source:** padrão geral do arquivo `actions.ts` (`exigirParcelaNaoConciliada`, `.eq("status","paga")` em `conciliarParcelaAction`, checagem de status em `destravarParcelaAction`)
**Apply to:** `cancelarEventoCaucaoAction` — a checagem "sou o mais recente" precisa reconsultar o banco, nunca confiar que o botão só apareceu no evento certo na tela.

## No Analog Found

Nenhum. Todos os 11 arquivos/funções desta fase têm analog exato dentro do próprio código-base (fase 100% extensão de padrão já em produção, confirmado por RESEARCH.md).

## Metadata

**Analog search scope:** `web/src/lib/kanban/` (actions.ts, parcelas.ts, taxas.ts, queries.ts), `web/src/components/financeiro/` (todos os arquivos), `web/src/components/reports/dinheiro-imobiliaria-view.tsx`, `web/src/app/(app)/financeiro/page.tsx`, `supabase/migrations/*.sql`
**Files scanned:** 9 arquivos lidos integral ou parcialmente nesta sessão (actions.ts em 3 trechos não sobrepostos: 985-1034, 1065-1193, 1321-1456; parcelas.ts em 2 trechos: 1-80, 440-490; demais arquivos lidos inteiros por serem pequenos)
**Pattern extraction date:** 2026-08-26
