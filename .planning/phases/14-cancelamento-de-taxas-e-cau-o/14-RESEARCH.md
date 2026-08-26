# Phase 14: Cancelamento de taxas e caução - Research

**Researched:** 2026-08-26
**Domain:** Internal pattern-extension (Server Actions, React/Next.js components, additive Postgres migration) — no new external technology
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** No histórico da parcela, a taxa entra na **mesma lista cronológica** que pagamento/
  acréscimo/desconto — não uma seção separada. Rótulo próprio (ex.: "Taxa · Administração" / "Taxa ·
  Comissão 1º aluguel"), mesmo espírito do mapa `TAXA_ORIGEM`/`TaxaOrigemBadge` já criado em
  `dinheiro-imobiliaria-view.tsx` (13-07) — mas esta fase é a segunda tela a precisar rotular taxa por
  origem, então esse mapa deixa de ser "só desta view" (A-03, 13-07-PLAN.md) e deve virar um componente
  compartilhado, mesmo padrão de `CaucaoEventoLabel`/`LancamentoTipoLabel`.
- **D-02:** Cancelar uma taxa é bloqueado quando a parcela está conciliada — mesma trava
  (`exigirParcelaNaoConciliada`) já usada por pagamento/acréscimo/desconto (CONCIL-02, D-03 em
  `cancelarLancamentoAction`). Nenhuma trava nova a inventar, reuso direto.
- **D-03:** Cancelar um lançamento `tipo="pagamento"` (CANPAG) cancela automaticamente a taxa
  vinculada àquele pagamento específico — "fica junto automaticamente". Precisa de uma coluna nova em
  `taxas_imobiliaria` (nullable, FK para `parcela_lancamentos.id`) — migração aditiva. Linhas de taxa já
  existentes em produção ficam com essa coluna `null` — sem backfill. Reversibility: one-way, aditiva,
  baixo risco.
- **D-04:** Além da cascata (D-03), a taxa também tem seu **próprio botão "Cancelar"** no histórico,
  igual aos outros três tipos — permite cancelar só a taxa, sem cancelar o pagamento que a gerou.
- **D-05:** No histórico de caução, só o **evento mais recente** pode ser cancelado por vez — nunca um
  do meio da linha do tempo. Motivo: `statusCaucao()` decide devolvida/usada pelo evento mais recente por
  `criado_em`. A trava é sempre "só o topo atual" reaplicada — depois de cancelar o mais recente, o que
  sobrou no topo passa a ser cancelável, permitindo desfazer o ciclo inteiro, evento por evento.
- **D-06:** O diálogo de confirmação para cancelar taxa ou evento de caução é o **mesmo padrão** já
  usado em `CancelarLancamentoDialog`: valor + tipo, sem motivo obrigatório, "não pode ser desfeito",
  DELETE real. Generalizar o componente existente (mesmo espírito de D-08 em 12-CONTEXT.md) em vez de
  criar dois diálogos novos — a forma final (um componente para os cinco tipos, ou dois lado a lado)
  fica para o pattern-mapper decidir.

### Claude's Discretion

- Nome exato da coluna nova em `taxas_imobiliaria` (ex.: `lancamento_id`, `pagamento_id`) e se tem
  `on delete cascade`/`on delete set null`.
- Como a cascata é implementada — `DELETE` explícito em `cancelarLancamentoAction`, ou constraint
  `on delete cascade` no banco.
- Componentização exata do rótulo de origem de taxa (extrair `TAXA_ORIGEM`/`TaxaOrigemBadge` para
  arquivo compartilhado, mesmo padrão de `caucao-evento-label.tsx`).
- Como o botão "Cancelar" do evento mais recente de caução decide "sou eu o mais recente".

### Deferred Ideas (OUT OF SCOPE)

None novo nesta discussão — o único item adiado do domínio (refinamento mais amplo do relatório de
reconciliação) já está registrado em `13-CONTEXT.md § Deferred` e continua fora do escopo desta fase.
Fora de escopo explícito nesta fase: mudanças no relatório de reconciliação além do reflexo automático;
editar valor/data de taxa ou evento de caução (só cancelar existe); cancelamento de eventos de caução do
meio do histórico.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CANIMOB-01 | Taxa aparece no histórico da parcela (`ParcelaHistoricoSheet`), na mesma lista cronológica que pagamento/acréscimo/desconto, com rótulo de origem | § Architecture Patterns → Pattern 1 (embed `taxas_imobiliaria` no SELECT de `parcelas`, estender `montarLinhas`/`LinhaParcela`); § Don't Hand-Roll (reuso de `TaxaOrigemBadge` promovido) |
| CANIMOB-02 | Cada taxa tem botão "Cancelar" (mesmo diálogo simples), bloqueado quando parcela conciliada | § Architecture Patterns → Pattern 2 (`cancelarTaxaImobiliariaAction`); reuso de `exigirParcelaNaoConciliada` (actions.ts:993-1012) |
| CANIMOB-03 | Cancelar um `pagamento` cancela automaticamente a(s) taxa(s) vinculada(s) a ele | § Standard Stack → migração aditiva (coluna `lancamento_id` + `on delete cascade`); § Common Pitfalls (Pitfall 1) |
| CANIMOB-04 | No histórico de caução, botão "Cancelar" só no evento mais recente, liberando o anterior a cada cancelamento | § Architecture Patterns → Pattern 3 (`cancelarEventoCaucaoAction`, checagem servidor "sou o mais recente") |
| CANIMOB-05 | Diálogo de confirmação de taxa/caução segue o mesmo padrão já existente | § Architecture Patterns → Pattern 4 (generalização de `CancelarLancamentoDialog` via prop `rotulo: string`) |
</phase_requirements>

## Summary

Esta fase é 100% extensão de padrões já em produção neste exato código-base — nenhuma tecnologia nova,
nenhum pacote npm novo. As cinco decisões (D-01 a D-06) já resolvem o *o quê*; a pesquisa abaixo resolve
o *como*, verificado linha a linha contra o código atual (não contra memória de treinamento), e recomenda
respostas concretas para os quatro itens de "Claude's Discretion" deixados em aberto pelo CONTEXT.md.

A descoberta mais importante: o schema atual de `taxas_imobiliaria`/`caucao_eventos`/`parcela_lancamentos`
usa **`on delete cascade` em 100% das suas FKs** (7 de 7, confirmado por grep em todas as 7 migrações do
projeto, zero exceção). Isso resolve a cascata pagamento→taxa (D-03/CANIMOB-03) com uma única coluna nova
(`taxas_imobiliaria.lancamento_id`, nullable, FK para `parcela_lancamentos.id` com `on delete cascade`) e
**zero mudança de código** em `cancelarLancamentoAction` — o DELETE que já existe hoje passa a arrastar a
taxa junto, de graça, no próprio banco. Isso é mais consistente com o padrão dominante do schema do que
parecia à primeira vista quando o CONTEXT.md descreveu "actions.ts hoje faz tudo explicitamente em código"
— essa frase descreve *lógica de negócio* (recálculo de status), não *integridade referencial* (limpeza de
linha filha), que é exatamente o problema que `on delete cascade` resolve, e que este schema já usa sempre
que uma linha some porque seu "dono" sumiu.

Para a taxa aparecer no histórico da parcela (CANIMOB-01), a pesquisa recomenda **não** replicar o padrão
de merge client-side via `useMemo` de `dinheiro-imobiliaria-view.tsx` (13-07) — aquele padrão existe porque
o relatório de reconciliação lê `taxas_imobiliaria`/`caucao_eventos` como duas listas independentes, sem
nenhuma linha "pai" comum a fazer join. Aqui existe uma FK direta e já indexada
(`taxas_imobiliaria.parcela_id -> parcelas.id`), exatamente a mesma forma que `parcela_lancamentos.parcela_id`
já usa no mesmíssimo SELECT de `financeiro/page.tsx` — a resposta idiomática é um segundo embed PostgREST na
mesma query, resolvido num único round-trip, com o merge cronológico feito em `parcelas.ts` (`montarLinhas`,
que já ordena `parcela_lancamentos` hoje), não em um `useMemo` de componente cliente.

Para a caução (CANIMOB-04), a trava "só o mais recente" não é expressável em uma única chamada PostgREST via
supabase-js (não há subquery correlacionada no query builder) — a recomendação é o mesmo padrão de duas
etapas que `destravarParcelaAction` já usa e já documenta explicitamente a janela de corrida tolerada
("o SELECT acima já confirmou... poucos milissegundos antes"), em vez de inventar uma função RPC nova
(que seria a primeira do projeto e quebraria a convenção de "toda escrita é uma operação de tabela simples
via supabase-js").

**Primary recommendation:** migração aditiva de uma coluna (`lancamento_id`, nullable, `on delete cascade`)
+ duas novas Server Actions espelhando `cancelarLancamentoAction`/`conciliarParcelaAction`/
`destravarParcelaAction` + um segundo embed PostgREST na query de `financeiro/page.tsx` + generalização de
`CancelarLancamentoDialog` trocando o prop `tipo` por um `rotulo: string` já resolvido pelo chamador.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cascata pagamento → taxa (CANIMOB-03) | Database / Storage | API / Backend | `on delete cascade` na FK nova resolve no banco; a Server Action que já faz o DELETE não precisa saber que a cascata existe |
| Cancelar taxa isolada (CANIMOB-02) | API / Backend | Browser / Client | `cancelarTaxaImobiliariaAction` reconfirma a trava de conciliada no servidor; o botão no cliente só dispara |
| Cancelar evento de caução mais recente (CANIMOB-04) | API / Backend | Browser / Client | "sou eu o mais recente" tem que ser reconfirmado no servidor (nunca confiar que o botão só apareceu no evento certo) — mesmo princípio de toda trava já existente no arquivo |
| Taxa na lista cronológica da parcela (CANIMOB-01) | API / Backend | Browser / Client | O embed PostgREST + `montarLinhas` (parcelas.ts) monta a lista já ordenada; o Sheet só renderiza |
| Rótulo de origem de taxa compartilhado (D-01) | Browser / Client | — | Componente de apresentação puro, sem lógica de servidor |
| Diálogo de confirmação generalizado (D-06) | Browser / Client | — | Componente de apresentação puro, recebe dados já resolvidos via props |

## Standard Stack

Nenhum pacote novo. Esta fase usa exclusivamente o que já está instalado: Next.js 16.3 (Server
Components/Actions), React 19.2.4, `@supabase/supabase-js`, Tailwind 4, `lucide-react` (ícones dos novos
rótulos, mesmo padrão de `CaucaoEventoLabel`/`LancamentoTipoLabel`). Confirmado em
`web/package.json` — `"next": "^16.3.0"`, `"react": "19.2.4"` `[VERIFIED: web/package.json]`.

**Se a pesquisa/plano encontrar necessidade de qualquer pacote novo, isso é uma mudança real de plano — não
uma nota de rodapé.** Nada encontrado aqui.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `on delete cascade` na FK `lancamento_id` | DELETE explícito em `cancelarLancamentoAction` (segunda query) | Mais código, replica uma decisão que o próprio schema já toma para toda FK do projeto (7/7); só se justificaria se a cascata precisasse de lógica condicional além de "linha filha desaparece com a pai" — não é o caso aqui |
| Embed PostgREST de `taxas_imobiliaria` na mesma query de `parcelas` | Query irmã + merge client-side via `useMemo` (padrão 13-07) | 13-07 usou merge client-side porque não há FK comum entre as duas listas que lê (taxas de TODOS os cards, caução de TODOS os cards); aqui existe FK direta parcela→taxa, então o embed é estritamente mais barato (1 round-trip em vez de 2, sem hook) |
| Duas leituras (SELECT + DELETE condicionado) para a trava "mais recente" de caução | Função RPC/SQL com subquery correlacionada num único round-trip | Seria a primeira função RPC de negócio do projeto — todas as escritas hoje são operações de tabela simples via supabase-js; inconsistente com a convenção estabelecida, e o padrão de 2 leituras já é tolerado (`destravarParcelaAction`) |

## Package Legitimacy Audit

**N/A — esta fase não instala nenhum pacote novo.** Nenhuma verificação de registry necessária.

## Architecture Patterns

### System Architecture Diagram

```
Browser (ParcelaHistoricoSheet)                Browser (CaucaoHistoricoSheet)
  |  clica "Cancelar" numa taxa                   |  clica "Cancelar" no evento do topo
  v                                                v
cancelarTaxaImobiliariaAction(parcelaId, taxaId)  cancelarEventoCaucaoAction(cardId, eventoId)
  |                                                |
  |-- exigirParcelaNaoConciliada (reuso)           |-- SELECT id mais recente WHERE card_id=X
  |-- DELETE taxas_imobiliaria                     |     ORDER BY criado_em DESC LIMIT 1
  |     WHERE id=taxaId AND parcela_id=parcelaId   |-- compara com eventoId recebido
  |-- (NUNCA chama recalcularEGravarStatus)         |     mismatch -> erro "não é mais o mais
  v                                                |     recente"
router.refresh()                                   |-- DELETE caucao_eventos
                                                    |     WHERE id=eventoId AND card_id=cardId
                                                    v
                                                  router.refresh()

Browser (ParcelaHistoricoSheet)
  |  clica "Cancelar" num pagamento
  v
cancelarLancamentoAction(parcelaId, lancamentoId)   [já existe, Phase 11]
  |-- exigirParcelaNaoConciliada (já existe)
  |-- DELETE parcela_lancamentos WHERE id=lancamentoId
  |     |
  |     `-- Postgres dispara ON DELETE CASCADE em
  |         taxas_imobiliaria.lancamento_id -> parcela_lancamentos.id
  |         (nenhum código novo aqui — a cascata é 100% do banco)
  |-- recalcularEGravarStatus (já existe, nunca lê taxas_imobiliaria)
  v
router.refresh()

Server render (financeiro/page.tsx)
  |
  |-- SELECT_PARCELA_PADRAO/FILTRADA agora também traz o embed:
  |     taxas_imobiliaria(id, origem, valor, data, observacao, criado_em, profiles(...))
  |     (mesmo shape do embed parcela_lancamentos já existente na mesma query)
  v
montarLinhas (parcelas.ts) — funde parcela_lancamentos[] + taxas_imobiliaria[] num único
  array `historico[]` ordenado por criado_em desc (mesma ordenação que já existe hoje só
  para lancamentos)
  v
ParcelaHistoricoSheet renderiza `historico[]` — LancamentoTipoLabel ou TaxaOrigemBadge
  conforme o discriminante de cada item
```

### Recommended Project Structure

Nenhuma pasta nova. Arquivos alterados/criados dentro da estrutura já existente:

```
supabase/migrations/
└── 20260826000000_taxas_imobiliaria_lancamento_id.sql   # NOVO — coluna + índice + comentário
web/src/lib/kanban/
├── actions.ts            # + cancelarTaxaImobiliariaAction, cancelarEventoCaucaoAction;
│                          #   registrarPagamentoAction grava lancamento_id
├── parcelas.ts            # LinhaParcela/ParcelaComCard ganham o campo do histórico unificado
├── queries.ts              # + wrappers client-side das 2 novas actions
└── taxas.ts                 # (sem mudança de lógica — só consumido pelos tipos acima)
web/src/components/financeiro/
├── taxa-origem-label.tsx    # NOVO — TAXA_ORIGEM/TaxaOrigemBadge promovido de dinheiro-imobiliaria-view.tsx
├── cancelar-lancamento-dialog.tsx  # generalizado: prop `tipo` -> prop `rotulo: string`
├── parcela-historico-sheet.tsx     # renderiza histórico unificado, novo botão Cancelar p/ taxa
├── caucao-historico-sheet.tsx      # novo botão Cancelar só no último evento (ordem ascendente)
└── (dinheiro-imobiliaria-view.tsx passa a importar de taxa-origem-label.tsx, sem duplicar)
```

### Pattern 1: Embed de `taxas_imobiliaria` na query de parcelas (CANIMOB-01)

**What:** Adicionar `taxas_imobiliaria(id, origem, valor, data, observacao, criado_em, profiles(full_name, email))`
como um segundo embed nas mesmas constantes `SELECT_PARCELA_PADRAO`/`SELECT_PARCELA_FILTRADA`
`[VERIFIED: web/src/app/(app)/financeiro/page.tsx:23-27]` — quote exata do embed atual:
`"id, card_id, competencia, vencimento, valor_original, status, cards!inner(...), parcela_lancamentos(id, tipo, valor, data, observacao, motivo, criado_em, profiles(full_name, email))"`.
O embed novo tem exatamente a mesma forma (`parcela_lancamentos` já embeda `profiles(full_name, email)`
da mesma maneira que `taxas_imobiliaria` precisaria).

**When to use:** Sempre que uma tela precisa mostrar dado de uma tabela filha ligada por FK direta a
`parcelas` numa única leitura — `taxas_imobiliaria.parcela_id` já é essa FK
`[VERIFIED: supabase/migrations/20260824000000_dinheiro_imobiliaria.sql:113]`, quote:
`"parcela_id uuid not null references public.parcelas(id) on delete cascade,"`.

**Example (extensão de `ParcelaComCard`/`montarLinhas`):**
```typescript
// Source: web/src/lib/kanban/parcelas.ts:21-30, 46-65, 444-487 (lidos nesta sessão)
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

// ParcelaComCard ganha:
//   taxas_imobiliaria: TaxaHistorico[] | null

// dentro de montarLinhas — mesmo padrão do sort já existente para
// parcela_lancamentos (parcelas.ts:456-458):
const historico: LinhaHistoricoParcela[] = [
  ...(parcela.parcela_lancamentos ?? []).map((l) => ({ ...l, kind: "lancamento" as const })),
  ...(parcela.taxas_imobiliaria ?? []).map((t) => ({ ...t, kind: "taxa" as const })),
].sort((a, b) => (a.criado_em < b.criado_em ? 1 : a.criado_em > b.criado_em ? -1 : 0))
```

**Por que não replicar o `useMemo` de 13-07:** `[VERIFIED: web/src/components/reports/dinheiro-imobiliaria-view.tsx:84-119]`
— aquele merge (`React.useMemo` combinando `taxas`+`caucaoEventos` em `linhas`) existe porque o relatório
lê as duas tabelas **sem filtro de parcela nenhum** (todas as taxas de todos os contratos) e precisa
recalcular ao vivo a cada mudança do filtro de período (`periodo` é estado local, linha 77-82). Aqui o
requisito é diferente: uma taxa pertence a exatamente uma parcela via FK já existente, e o Sheet não tem
filtro ao vivo — os dados já chegam prontos como prop do servidor (mesmo comentário já presente em
`caucao-historico-sheet.tsx:26-29`: "lê os eventos que a própria página... já buscou... sem
`useEffect`/fetch próprio"). Fundir no servidor (`montarLinhas`) é estritamente mais barato.

### Pattern 2: Cancelar taxa isolada (CANIMOB-02, D-04)

**What:** Nova Server Action `cancelarTaxaImobiliariaAction`, espelhando `cancelarLancamentoAction`
`[VERIFIED: web/src/lib/kanban/actions.ts:1415-1455]` — DELETE condicionado + trava de conciliada, SEM
o `.in("tipo", [...])` (não existe coluna `tipo` em `taxas_imobiliaria`, cada linha já É uma taxa) e SEM
chamar `recalcularEGravarStatus` (D-04 de 13-CONTEXT.md continua valendo — taxa nunca participa do
cálculo de status).

**Example:**
```typescript
// Source: espelha web/src/lib/kanban/actions.ts:1415-1455 (cancelarLancamentoAction, lido nesta sessão)
export async function cancelarTaxaImobiliariaAction(
  parcelaId: string,
  taxaId: string
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(parcelaId, "Parcela") ?? id(taxaId, "Taxa")
  if (invalido) return { ok: false, error: invalido }

  // D-02 (14-CONTEXT.md): mesma trava de cancelarLancamentoAction, reuso verbatim.
  const recusaConciliada = await exigirParcelaNaoConciliada(sessao.supabase, parcelaId)
  if (recusaConciliada) return { ok: false, error: recusaConciliada }

  const { data, error } = await sessao.supabase
    .from("taxas_imobiliaria")
    .delete()
    .eq("id", taxaId)
    .eq("parcela_id", parcelaId)
    .select("id")

  if (error) return { ok: false, error: erroDoBanco(error.code, "cancelar a taxa") }
  if (!data || data.length === 0) return { ok: false, error: semLinhas("cancelar a taxa") }

  // Deliberadamente SEM recalcularEGravarStatus — D-04 (13-CONTEXT.md) continua valendo.
  return { ok: true, data: undefined }
}
```

`exigirParcelaNaoConciliada` confirmada linha a linha
`[VERIFIED: web/src/lib/kanban/actions.ts:993-1012]`, quote: `"if (data.status === "conciliada") { return MENSAGEM_PARCELA_CONCILIADA }"`.

### Pattern 3: Cancelar evento de caução mais recente (CANIMOB-04, D-05)

**What:** A trava "sou eu o evento mais recente" não é expressável como uma única chamada supabase-js
(não há subquery correlacionada no query builder do PostgREST/supabase-js) — usa o mesmo padrão de
**duas etapas** que `destravarParcelaAction` já usa e já documenta a janela de corrida tolerada
`[VERIFIED: web/src/lib/kanban/actions.ts:1321-1394]`, quote do comentário que reconhece a janela:
linha ~1378-1380, `"Sem condição adicional de status no .eq — o SELECT acima já confirmou 'conciliada'
poucos milissegundos antes, e o INSERT que acabou de acontecer é o que autoriza esta gravação."` Este é o
precedente direto e mais próximo no próprio arquivo para "ler o estado, decidir, e confiar na leitura
recente por uma janela pequena" — o mesmo raciocínio se aplica à checagem "sou o mais recente" da caução.

**Example:**
```typescript
// Source: padrão espelhado de web/src/lib/kanban/actions.ts:1321-1394 (destravarParcelaAction)
// e :1415-1455 (cancelarLancamentoAction, forma do DELETE condicionado)
export async function cancelarEventoCaucaoAction(
  cardId: string,
  eventoId: string
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(cardId, "Imóvel") ?? id(eventoId, "Evento de caução")
  if (invalido) return { ok: false, error: invalido }

  // D-05 (14-CONTEXT.md): reconfirma no servidor que este é o evento mais
  // recente — nunca confia que o botão só apareceu no evento certo na tela
  // (mesmo princípio de toda trava financeira do arquivo).
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
    return {
      ok: false,
      error: "Este não é mais o evento mais recente de caução — atualize a página.",
    }
  }

  const { data, error } = await sessao.supabase
    .from("caucao_eventos")
    .delete()
    .eq("id", eventoId)
    .eq("card_id", cardId)
    .select("id")

  if (error) return { ok: false, error: erroDoBanco(error.code, "cancelar o evento de caução") }
  if (!data || data.length === 0) return { ok: false, error: semLinhas("cancelar o evento de caução") }

  // Nunca toca parcela_lancamentos/taxas_imobiliaria — caução é uma terceira
  // tabela isolada (D-06, 13-CONTEXT.md).
  return { ok: true, data: undefined }
}
```

**Janela de corrida assumida:** entre o SELECT e o DELETE, um evento novo poderia, em teoria, ser
inserido concorrentemente, tornando a checagem "mais recente" ligeiramente obsoleta. Este é o mesmo tipo
e a mesma ordem de grandeza de janela que `destravarParcelaAction` já tolera hoje em produção
(comentário citado acima) — não é um risco novo introduzido por esta fase, é o mesmo trade-off já
aceito pelo projeto para operações financeiras de baixa concorrência (equipe pequena, um usuário por vez
na prática).

**No cliente:** `CaucaoHistoricoSheet` já ordena os eventos **ascendente** (mais antigo primeiro)
`[VERIFIED: web/src/components/financeiro/caucao-historico-sheet.tsx:76-101]` — "o mais recente" é
`eventos[eventos.length - 1]` (o último item da lista renderizada), e só esse item recebe o botão
"Cancelar". Isso implementa o discretion item "reusar a mesma ordenação por `criado_em`... comparando o
id do último item da lista".

### Pattern 4: Generalização de `CancelarLancamentoDialog` (D-06)

**What:** O componente atual é tipado a `Extract<LancamentoDetalhado["tipo"], "pagamento" | "acrescimo" |
"desconto">` e lê o rótulo via `TIPO[tipo].label`
`[VERIFIED: web/src/components/financeiro/cancelar-lancamento-dialog.tsx:9,40,50,87]`, quote:
`'tipo: Extract<LancamentoDetalhado["tipo"], "pagamento" | "acrescimo" | "desconto">'` e
`"const rotulo = TIPO[tipo].label.toLowerCase()"`. O precedente D-08 (12-CONTEXT.md) generalizou esse
mesmo componente de 1 tipo para 3 **porque os três compartilham o mesmo union
(`LancamentoDetalhado["tipo"]`) e o mesmo mapa `TIPO`** `[VERIFIED: .planning/phases/12-cancelamento-de-ajustes/12-CONTEXT.md:44,60]`,
quote: `"o comportamento da trava (.eq("tipo", "pagamento") hoje) precisa passar a aceitar os três tipos
elegíveis"` e `"TIPO[tipo].label, os rótulos... já centralizados, a reusar no texto do diálogo
generalizado (D-08)"`. Taxa (`OrigemTaxa`) e caução (`TipoCaucao`) **não compartilham esse union nem esse
mapa** — alargar `Extract<>` mais uma vez não compila.

**Recommendation:** trocar a prop `tipo` por uma prop `rotulo: string` já resolvida pelo chamador — cada
Sheet (parcela/caução) já tem o componente de rótulo certo (`LancamentoTipoLabel`/`TaxaOrigemBadge`/
`CaucaoEventoLabel`) e passa o texto pronto (`TIPO[tipo].label`, `TAXA_ORIGEM[origem].label`,
`CAUCAO_TIPO[tipo].label`) para o diálogo. Isso é a mesma generalização de D-08 aplicada um nível acima:
em vez de alargar o union de tipos aceitos, remove a dependência de um union específico — um componente
só, cobrindo os cinco tipos possíveis, sem discriminated union de 3 domínios diferentes.

```typescript
// Source: web/src/components/financeiro/cancelar-lancamento-dialog.tsx:29-45 (lido nesta sessão),
// generalizado
export function CancelarLancamentoDialog({
  parcelaId,
  lancamentoId,
  rotulo,        // "Pagamento" | "Acréscimo" | "Desconto" | "Taxa · Administração" | "Caução recebida" ...
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
  // ... resto idêntico, trocando TIPO[tipo].label por `rotulo`/`rotuloMinusculo`
}
```

Isso também simplifica a chamada de Server Action: o componente pode receber uma função `onConfirm:
() => Promise<void>` (ou continuar recebendo `parcelaId`/`lancamentoId` e ganhar um terceiro modo via
prop `acao: "lancamento" | "taxa"`) — **decisão de forma final deixada para o planner**, conforme
D-06/discretion do CONTEXT.md; a pesquisa só resolve por que o `Extract<>` não escala e qual é o próximo
passo natural de generalização.

### Anti-Patterns to Avoid

- **Fazer `somarLancamentos`/`statusDeParcela` ler `taxas_imobiliaria`:** violaria D-04 (13-CONTEXT.md),
  que continua em vigor — a nova FK é só para cascata de DELETE, nunca para cálculo de status.
- **Checar "é o evento mais recente de caução" só no cliente:** toda trava financeira deste projeto é
  reconfirmada no servidor (`exigirParcelaNaoConciliada`, `.eq("status","paga")` de
  `conciliarParcelaAction`) — a checagem de D-05 precisa seguir o mesmo padrão.
- **Criar uma função RPC/SQL nova para a checagem atômica da caução:** seria a primeira do projeto;
  inconsistente com "toda escrita é uma operação de tabela simples via supabase-js".
- **Reescrever `20260824000000_dinheiro_imobiliaria.sql`:** a migração da Phase 13 é imutável — qualquer
  mudança de schema é um arquivo novo, aditivo (mesma disciplina de todas as migrações anteriores).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cascata de exclusão pai→filho | DELETE explícito em `cancelarLancamentoAction` para limpar `taxas_imobiliaria` | `on delete cascade` na FK nova | O schema inteiro (7/7 FKs) já resolve "linha filha desaparece quando a pai desaparece" assim; reinventar em código duplicaria uma decisão já tomada |
| Composição AlertDialog + Sheet para confirmação dentro de um painel lateral | Um modal customizado do zero | A composição já validada em Phase 11 (`ParcelaHistoricoSheet` + `CancelarLancamentoDialog`, `11-01-PLAN.md`: "composição AlertDialog+Sheet (inédita neste projeto) não quebra visualmente — confirmado em produção") | Já resolvido e testado em produção; reusar em vez de recriar |
| Sanitização de erro do Postgres | Expor `error.message` cru | `erroDoBanco()` | Já é o padrão de todo o arquivo `actions.ts`, sem exceção |

**Key insight:** nada nesta fase é um problema novo — é a mesma forma (DELETE condicionado + trava
reconfirmada no servidor + confirmação simples) aplicada a duas tabelas que ainda não tinham essa forma.

## Common Pitfalls

### Pitfall 1: Achar que a nova FK reabre D-04 (isolamento estrutural) por completo

**What goes wrong:** um mantenedor futuro vê a coluna `lancamento_id` em `taxas_imobiliaria` e assume que
a tabela deixou de ser "estruturalmente paralela" a `parcela_lancamentos`, e começa a ler `taxas_imobiliaria`
dentro de `somarLancamentos`/`statusDeParcela`.

**Why it happens:** o comentário de guarda na migração da Phase 13 é explícito e forte
`[VERIFIED: supabase/migrations/20260824000000_dinheiro_imobiliaria.sql:94-96]`, quote: `"Se algum dia
uma coluna ou índice parecer útil para 'juntar' as duas tabelas, isso é o sinal de que D-04 está sendo
violado — pare e releia 13-CONTEXT.md antes de prosseguir."` Um leitor apressado que só vê essa linha, sem
ler 14-CONTEXT.md, pode concluir que qualquer FK nova é proibida.

**How to avoid:** o comentário-cabeçalho da migração NOVA desta fase deve declarar explicitamente que
D-03 (14-CONTEXT.md) reabre esse ponto **pontualmente**: a FK existe só para `on delete cascade` (limpeza
de linha órfã quando o pagamento que a gerou é cancelado), nunca para join de cálculo de status — D-04
(13-CONTEXT.md) continua em vigor sem mudança nenhuma no lado do cálculo.

**Warning signs:** qualquer PR/plano que adicione `taxas_imobiliaria` a um `select` dentro de
`somarLancamentos`, `statusDeParcela` ou `recalcularEGravarStatus`.

### Pitfall 2: Esquecer de gravar `lancamento_id` no INSERT de `registrarPagamentoAction`

**What goes wrong:** a coluna existe no banco, mas o único ponto de INSERT em `taxas_imobiliaria`
continua gravando `null` sempre — a cascata de D-03/CANIMOB-03 nunca dispara para pagamentos novos.

**Why it happens:** o INSERT de taxa já está pronto e funcionando (Phase 13); é fácil rodar a migração
e esquecer de tocar o código que grava a linha.

**How to avoid:** o id do lançamento já está disponível na própria função, capturado ANTES do insert de
taxa `[VERIFIED: web/src/lib/kanban/actions.ts:1096-1109]`, quote:
`"const { data: inserido, error } = await sessao.supabase.from("parcela_lancamentos").insert({... }).select("id")"`
— o `insert` de `taxas_imobiliaria` (linha 1169-1182) precisa adicionar `lancamento_id: inserido[0].id`
ao payload.

**Warning signs:** teste manual — cancelar um pagamento que gerou taxa e a taxa continuar visível no
histórico depois do cancelamento.

### Pitfall 3: Botão "Cancelar" de caução aparecer em mais de um evento ao mesmo tempo

**What goes wrong:** um bug de índice (`eventos[0]` em vez de `eventos[eventos.length - 1]`, ou usar a
ordem descendente de outro lugar do código por engano) faz o botão aparecer no evento mais ANTIGO, ou em
todos.

**Why it happens:** `CaucaoHistoricoSheet` ordena ascendente
`[VERIFIED: web/src/components/financeiro/caucao-historico-sheet.tsx:26-30]` (mais antigo primeiro), mas
o relatório de reconciliação (`dinheiro-imobiliaria-view.tsx:111-118`) ordena descendente — os dois
existem lado a lado no mesmo código-base, com comentário explícito reconhecendo a divergência
deliberada.

**How to avoid:** o "mais recente" no `CaucaoHistoricoSheet` é sempre o **último** elemento do array
`eventos` (ordem ascendente), nunca o primeiro.

**Warning signs:** teste manual com 2+ eventos de caução — só o card mais abaixo na lista deve ter
"Cancelar".

## Code Examples

Ver Patterns 1-4 acima — todos os exemplos já incluem o código recomendado com a fonte verificada.

### Migração aditiva (D-03/CANIMOB-03)

```sql
-- Source: molde direto de supabase/migrations/20260824000000_dinheiro_imobiliaria.sql:111-157
-- (lido integralmente nesta sessão) — mesma disciplina: aditiva, idempotente, RLS via is_team_member()
-- já herdada (nenhuma policy nova necessária, a policy "team full access taxas_imobiliaria" já cobre
-- update/delete/select desta coluna nova).

-- D-03 (14-CONTEXT.md) reabre PONTUALMENTE o isolamento estrutural descrito em
-- 20260824000000_dinheiro_imobiliaria.sql linhas 89-96: esta coluna existe só para
-- "on delete cascade" (limpar a taxa quando o pagamento que a gerou é cancelado,
-- CANIMOB-03) — nunca para join de cálculo de status. D-04 (13-CONTEXT.md) continua
-- em vigor: somarLancamentos/statusDeParcela nunca leem taxas_imobiliaria.

alter table public.taxas_imobiliaria
  add column if not exists lancamento_id uuid
    references public.parcela_lancamentos(id) on delete cascade;

-- Nullable, sem default, sem backfill (mesmo padrão de cards.arquivado_em,
-- docs/data-model.md linha 138: "nasceu nulável, sem default e sem backfill... nulo
-- já significa [estado válido]"). Linhas de taxa geradas antes desta fase ficam com
-- lancamento_id = null para sempre — não há como inferir retroativamente qual
-- pagamento gerou qual taxa quando uma parcela paga em partes acumulou mais de uma
-- taxa (D-03, 14-CONTEXT.md).

create index if not exists taxas_imobiliaria_lancamento_id_idx
  on public.taxas_imobiliaria (lancamento_id);
-- Mesmo padrão dos outros dois índices desta tabela (taxas_imobiliaria_card_id_idx,
-- taxas_imobiliaria_parcela_id_idx, linhas 142-145 da migração original).
```

**Precedente de 100% das FKs do schema usando `on delete cascade`**
`[VERIFIED: grep em todas as 7 migrações de supabase/migrations/]` — as 7 ocorrências de `on delete`
neste projeto são todas `on delete cascade`, zero `on delete set null`/`restrict`:
`init_schema.sql:11,46,59,102`; `financeiro_schema.sql:47,162`; `dinheiro_imobiliaria.sql:113,114,180`.

## State of the Art

Não aplicável — nenhuma mudança de ferramenta/framework nesta fase, apenas extensão de padrões já
estabelecidos no próprio projeto (Phases 11/12 para o mecanismo de cancelamento, Phase 13 para o schema
sendo estendido).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Nome de coluna recomendado `lancamento_id` (em vez de `pagamento_id`) — escolhido por seguir a convenção de nomear pela tabela referenciada no singular (`parcela_id`→`parcelas`, `card_id`→`cards`), não pelo tipo de lançamento que ela hoje sempre referencia | Standard Stack / Code Examples | Baixo — é só um nome de coluna; renomear depois da migração aplicada exige nova migração aditiva (rename de coluna é o único tipo de mudança que este projeto trata como não-aditiva, então vale acertar o nome já na primeira aplicação) |
| A2 | Nenhum CHECK novo é necessário na coluna `lancamento_id` além da própria FK | Code Examples | Baixo — se o planner decidir que só lançamentos `tipo='pagamento'` podem ser referenciados, isso teria que ser um CHECK cruzando tabelas (não suportado nativamente por CHECK simples do Postgres) ou confiado à disciplina de `registrarPagamentoAction` (que já é o único ponto de escrita) |

**Nenhuma claim de negócio/compliance foi assumida sem verificação** — as duas entradas acima são
detalhes de nomenclatura/constraint, não decisões de produto (essas já vieram travadas do CONTEXT.md).

## Open Questions

1. **Forma final do diálogo generalizado (D-06)** — um componente só com prop `rotulo: string` e uma
   prop de ação genérica, ou dois componentes lado a lado com a mesma estrutura?
   - What we know: o precedente D-08 (12-CONTEXT.md) generalizou por union type porque os 3 tipos
     compartilhavam o mesmo mapa de rótulo; taxa/caução não compartilham.
   - What's unclear: se o planner prefere manter 3 diálogos "de lançamento" via union ampliado e criar
     UM diálogo irmão para taxa+caução (2 componentes), ou generalizar tudo em 1 componente com
     `rotulo: string`.
   - Recommendation: 1 componente com `rotulo: string` (Pattern 4 acima) — menos duplicação de JSX/lógica
     de loading/erro, e a prop já elimina a dependência de qualquer union específico. Deixado como
     recomendação, não trava — CONTEXT.md explicitamente deixa a forma final para o pattern-mapper/planner.

## Environment Availability

Não aplicável — esta fase não introduz nenhuma dependência de ambiente nova (sem CLI, sem serviço
externo, sem runtime novo). Todo o trabalho roda sobre a mesma stack Next.js/Supabase já em produção.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V4 Access Control | yes | RLS via `is_team_member()` já cobre `taxas_imobiliaria`/`caucao_eventos` para `all` (select/insert/update/delete) `[VERIFIED: supabase/migrations/20260824000000_dinheiro_imobiliaria.sql:152-157,212-217]` — nenhuma policy nova necessária para as duas novas Server Actions, elas herdam a policy existente |
| V5 Input Validation | yes | Reuso dos validadores já existentes em `actions.ts` (`id()`, `valorLancamento`, etc.) — nenhum validador novo necessário, os dois novos DELETEs só validam `id()` nos dois parâmetros |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| TOCTOU (time-of-check-time-of-use) na checagem "evento mais recente" de caução | Tampering | Janela de corrida pequena, mesma ordem de grandeza já tolerada por `destravarParcelaAction`; mitigada por reconfirmar no servidor a cada chamada (nunca confiar no estado do cliente) — não eliminada, mas consistente com o resto do projeto |
| Aba desatualizada tentando cancelar taxa de parcela já conciliada em outra aba | Tampering | `exigirParcelaNaoConciliada` reconsulta o banco a cada chamada, mesma trava já usada por pagamento/ajuste |
| DELETE sem `.eq(parcela_id)`/`.eq(card_id)` (IDOR entre contratos) | Elevation of Privilege | Todo DELETE recomendado nesta pesquisa usa dois `.eq()` (id do registro + id do dono), mesmo padrão de `cancelarLancamentoAction` |

## Sources

### Primary (HIGH confidence — lido diretamente nesta sessão)

- `.planning/phases/14-cancelamento-de-taxas-e-cau-o/14-CONTEXT.md` — decisões travadas
- `.planning/ROADMAP.md` (Phase 14) — goal + 5 critérios de sucesso
- `.planning/REQUIREMENTS.md` (§ CANIMOB) — CANIMOB-01..05
- `supabase/migrations/20260824000000_dinheiro_imobiliaria.sql` — schema atual de `taxas_imobiliaria`/`caucao_eventos`, íntegra
- `supabase/migrations/20260816000000_financeiro_schema.sql` — schema de `parcelas`/`parcela_lancamentos`, FKs cascade
- `web/src/lib/kanban/actions.ts` — `registrarPagamentoAction`, `cancelarLancamentoAction`,
  `exigirParcelaNaoConciliada`, `conciliarParcelaAction`, `destravarParcelaAction`, `registrarEventoCaucaoAction`
- `web/src/lib/kanban/parcelas.ts`, `web/src/lib/kanban/taxas.ts`, `web/src/lib/kanban/queries.ts`
- `web/src/app/(app)/financeiro/page.tsx`, `web/src/app/(app)/financeiro/configuracao/page.tsx`
- `web/src/components/financeiro/parcela-historico-sheet.tsx`, `caucao-historico-sheet.tsx`,
  `cancelar-lancamento-dialog.tsx`, `lancamento-tipo-label.tsx`, `caucao-evento-label.tsx`,
  `configuracao-financeira-view.tsx`
- `web/src/components/reports/dinheiro-imobiliaria-view.tsx`
- `docs/data-model.md` — decisões de design citadas (D-04/D-06 Phase 13, cascata, cancelamento Phase 11/12)
- `.planning/phases/12-cancelamento-de-ajustes/12-CONTEXT.md` — precedente D-08
- `web/package.json` — versões confirmadas (Next 16.3.0, React 19.2.4)
- `.planning/config.json` — `nyquist_validation: false`, `security_enforcement: true`, `commit_docs: true`

Nenhuma pesquisa externa (WebSearch/Context7) foi necessária — esta fase é 100% verificação interna de
código já em produção, sem tecnologia nova.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nenhum pacote novo, versões confirmadas em `package.json`
- Architecture: HIGH — todos os padrões recomendados são espelhos diretos de código lido nesta sessão, com linha e quote
- Pitfalls: HIGH — derivados de comentários explícitos já presentes no código (guarda de D-04, ordenação divergente de caução)

**Research date:** 2026-08-26
**Valid until:** Enquanto o schema de `taxas_imobiliaria`/`caucao_eventos`/`parcela_lancamentos` não mudar de novo — sem prazo fixo (projeto interno, sem dependência externa datada)
