# Phase 15: Exclusão de card com destrava e paginação - Research

**Researched:** 2026-08-26
**Domain:** (1) Relaxamento de um trigger/predicado de banco + widening de allowlist de cancelamento em Server Action existente; (2) paginação client-side de arrays já carregados, componente novo no design system Tailwind/shadcn do projeto.
**Confidence:** HIGH

## Summary

Esta fase tem duas capacidades independentes e ambas são mudanças mecânicas sobre padrões já estabelecidos no projeto — não há tecnologia nova, biblioteca nova, nem decisão de arquitetura em aberto.

A capacidade 1 (destrava) é uma alteração cirúrgica em três lugares que já mudam **juntos** há três fases (6.2, 13, agora 15): o predicado SQL do trigger `impedir_exclusao_de_card_com_lancamento()` (via `create or replace function`, nunca `create function`/`create trigger` novo), o pré-voo em `cardTemLancamento()` no app, e o allowlist `.in("tipo", [...])` de `cancelarLancamentoAction`. Confirmei com leitura direta do código que `somarLancamentos` (`web/src/lib/kanban/parcelas.ts:427-444`) nunca soma `tipo='destrava'` — logo relaxar as duas travas é seguro sem efeito colateral em `valorDevido`/`valorPago`/status. Confirmei também que **nenhuma tela de UI precisa de texto novo**: a mensagem `EXCLUSAO_BLOQUEADA_POR_LANCAMENTO` é genérica ("já tem lançamento financeiro registrado", sem citar tipos) e o texto do diálogo de exclusão (`excluir-contrato-dialog.tsx:120-123`) já enumera só "(pagamento, baixa parcial, acréscimo ou desconto)" — nunca mencionou "destrava", então nada fica desatualizado ali. O botão "Cancelar" para destrava se resolve **sem nenhum componente novo**: `CancelarLancamentoDialog` já aceita `acao: "lancamento" | "taxa" | "caucao"` e despacha para `cancelarLancamento()` (que chama `cancelarLancamentoAction`) sempre que `acao === "lancamento"` — destrava é só mais um `tipo` dentro desse mesmo balde. A única mudança de UI é uma condição de renderização em `parcela-historico-sheet.tsx:128`.

A capacidade 2 (paginação) não tem nenhum precedente no projeto (`components/ui/` não tem `pagination.tsx` nem `select.tsx` — confirmado por listagem direta do diretório) e as seis listagens-alvo já recebem arrays completos e já filtrados como prop, fazendo `.map()` client-side — confirmado arquivo por arquivo, não só por herança do scout do CONTEXT.md. A parte não-óbvia, que o CONTEXT.md não cobre e que encontrei ao ler os componentes pai: **quatro das seis listas são recarregadas via `router.refresh()` depois de mutações que não mudam o filtro** (cancelar lançamento, conciliar, desarquivar, editar percentuais) — se o "reset para página 1" for implementado ingenuamente como "toda vez que o array de itens mudar de referência", o usuário seria jogado de volta à página 1 toda vez que cancelasse um lançamento na página 3 do Financeiro. A recomendação abaixo evita essa armadilha amarrando o reset a uma **chave de identidade do filtro**, não à referência do array.

**Primary recommendation:** Widenar o predicado SQL e o allowlist de `.in("tipo", [...])` para excluir/incluir `destrava` respectivamente (duas mudanças de uma linha cada, mesmo padrão das Phases 13/14); estender a condição do botão "Cancelar" em `parcela-historico-sheet.tsx` para incluir `"destrava"`, sem tocar `CancelarLancamentoDialog`. Construir um componente `Pagination` + hook `usePagination` novos em `web/src/components/pagination.tsx`, com reset de página amarrado a uma chave de filtro explícita (não à referência do array) em cada um dos seis call sites.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Relaxar trava de exclusão de card (destrava) | Database (trigger) | API/Backend (Server Action pré-voo) | O backstop de verdade é o trigger `before delete`; a Server Action é conveniência de UX que espelha o mesmo predicado — os dois já mudam juntos por disciplina estabelecida em 3 fases anteriores |
| Cancelar lançamento tipo=destrava | API/Backend (Server Action) | Browser/Client (botão condicional) | `cancelarLancamentoAction` já existe; só o allowlist SQL (`.in`) e a condição de renderização do botão mudam — nenhuma rota nova |
| Paginação das 6 listagens | Browser/Client | — | Todas as 6 listas já recebem array completo filtrado como prop e fazem `.map()` no cliente; paginação é fatiamento em memória, sem Server Action nova, sem mudança de query |

## Standard Stack

Nenhuma biblioteca nova em nenhuma das duas capacidades. Ambas usam exclusivamente:

| Ferramenta | Já em uso | Papel nesta fase |
|---|---|---|
| React 19 (`useState`) | Sim (todo o projeto) | Estado de página local a cada listagem/hook |
| Tailwind + shadcn-style `components/ui/*` | Sim | Estilo visual do componente `Pagination` novo, mesmo padrão de `Button`/`Table` |
| PL/pgSQL `create or replace function` | Sim (Phases 6.2/13) | Relaxar o predicado do trigger |
| Supabase JS `.in("tipo", [...])` | Sim (Phase 12) | Widenar o allowlist de cancelamento |

**Installation:** nenhuma — zero dependências novas em `package.json`.

## Package Legitimacy Audit

Não aplicável — esta fase não instala nenhum pacote novo em nenhum ecossistema. Nenhuma verificação de registry é necessária.

## Architecture Patterns

### System Architecture Diagram — Destrava

```
[Usuário clica "Excluir contrato"]
        |
        v
[ExcluirContratoDialog] --pré-voo--> [cardTemLancamentoAction] --> [cardTemLancamento()]
        |                                                                |
        | (permitido, sem parcela_lancamentos com tipo                  | consulta parcela_lancamentos
        |  pagamento/acrescimo/desconto, sem taxa, sem caução)          | filtrada por tipo (NOVO: destrava sai do filtro)
        v                                                                v
[deleteCard action] --DELETE cards--> [trigger cards_impede_exclusao_com_lancamento]
        |                                        |
        |                                        v
        |                          [impedir_exclusao_de_card_com_lancamento()]
        |                          predicado NOVO: só bloqueia se existir
        |                          parcela_lancamentos.tipo IN (pagamento,
        |                          acrescimo, desconto) OU taxas_imobiliaria
        |                          OU caucao_eventos ligados ao card
        v
[card + parcelas + lançamentos (inclusive destrava) apagados via cascade]
```

```
[Usuário clica "Cancelar" num lançamento destrava no histórico]
        |
        v
[ParcelaHistoricoSheet] -- condição NOVA inclui tipo==="destrava" e !parcelaConciliada -->
        |
        v
[CancelarLancamentoDialog acao="lancamento"] --confirmar--> [cancelarLancamento()] --> [cancelarLancamentoAction]
        |
        v
[exigirParcelaNaoConciliada] --passa--> [DELETE parcela_lancamentos WHERE id=... AND tipo IN (pagamento,acrescimo,desconto,destrava) NOVO]
        |
        v
[recalcularEGravarStatus] -- inócuo para destrava (somarLancamentos nunca soma esse tipo)
```

### System Architecture Diagram — Paginação

```
[Server Component / componente pai com filtro]
        |
        | array completo já filtrado (prop)
        v
[Componente de listagem (parcelas-table.tsx, etc.)]
        |
        | usePagination(items, resetKey, 10)
        v
   +----+----+
   | pageItems (slice de até 10) --> .map() --> <TableRow>
   | totalPages, page, setPage
   +----+----+
        |
        v
[<Pagination page totalPages onPageChange />] -- números 1..N + setas <>
```

### Recommended Project Structure

Nenhuma pasta nova. Um arquivo novo:
```
web/src/components/
├── pagination.tsx        # NOVO — componente <Pagination> + hook usePagination
├── search-field.tsx       # já existe — mesmo nível, precedente confirmado
└── ...
```

### Pattern 1: Relaxar predicado de trigger existente (`create or replace function`)

**What:** Alterar o corpo de `impedir_exclusao_de_card_com_lancamento()` para trocar o `exists (select 1 from parcela_lancamentos pl join parcelas p ...)` sem filtro de tipo por um `exists (... where pl.tipo in ('pagamento','acrescimo','desconto'))`.
**When to use:** Sempre que a regra de negócio muda sobre um trigger já existente neste projeto — nunca criar função/trigger novo.
**Example (corpo atual, lido em `supabase/migrations/20260824000000_dinheiro_imobiliaria.sql:239-280`):**
```sql
-- ANTES (atual em produção, sem filtro de tipo):
if exists (
  select 1
  from public.parcela_lancamentos pl
  join public.parcelas p on p.id = pl.parcela_id
  where p.card_id = old.id
) or exists (
  select 1 from public.taxas_imobiliaria t where t.card_id = old.id
) or exists (
  select 1 from public.caucao_eventos ce where ce.card_id = old.id
) then
  raise exception 'Contrato com lançamento financeiro registrado não pode ser excluído. Arquive o contrato em vez de excluir.';
end if;
```
```sql
-- DEPOIS (D-01/D-03, 15-CONTEXT.md — recomendação desta pesquisa):
if exists (
  select 1
  from public.parcela_lancamentos pl
  join public.parcelas p on p.id = pl.parcela_id
  where p.card_id = old.id
    and pl.tipo in ('pagamento', 'acrescimo', 'desconto')
) or exists (
  select 1 from public.taxas_imobiliaria t where t.card_id = old.id
) or exists (
  select 1 from public.caucao_eventos ce where ce.card_id = old.id
) then
  raise exception 'Contrato com lançamento financeiro registrado não pode ser excluído. Arquive o contrato em vez de excluir.';
end if;
```
[VERIFIED: supabase/migrations/20260824000000_dinheiro_imobiliaria.sql:256-280 — corpo atual lido integralmente nesta sessão]

### Pattern 2: Widenar allowlist `.in("tipo", [...])`

**What:** Adicionar `"destrava"` ao array de tipos aceitos em `cancelarLancamentoAction`.
**Example (código atual, `web/src/lib/kanban/actions.ts:1436-1442`):**
```typescript
// ANTES:
const { data, error } = await sessao.supabase
  .from("parcela_lancamentos")
  .delete()
  .eq("id", lancamentoId)
  .eq("parcela_id", parcelaId)
  .in("tipo", ["pagamento", "acrescimo", "desconto"])
  .select("id")
```
```typescript
// DEPOIS:
  .in("tipo", ["pagamento", "acrescimo", "desconto", "destrava"])
```
[VERIFIED: web/src/lib/kanban/actions.ts:1420-1460 — lido integralmente nesta sessão]

A trava de parcela conciliada (`exigirParcelaNaoConciliada`, chamada na linha 1433, definida em `web/src/lib/kanban/actions.ts:993-1012`) já roda **antes** do DELETE e não precisa de nenhuma mudança — herda a proteção automaticamente para destrava também, exatamente como D-03 do CONTEXT.md prevê.

### Pattern 3: Extensão da condição de botão "Cancelar" no histórico

**What:** Incluir `"destrava"` no array de tipos elegíveis que decide se o botão "Cancelar" aparece.
**Example (código atual, `web/src/components/financeiro/parcela-historico-sheet.tsx:128`):**
```tsx
// ANTES:
{(item.kind === "taxa" || ["pagamento", "acrescimo", "desconto"].includes(item.tipo)) && !parcelaConciliada && (
```
```tsx
// DEPOIS:
{(item.kind === "taxa" || ["pagamento", "acrescimo", "desconto", "destrava"].includes(item.tipo)) && !parcelaConciliada && (
```
[VERIFIED: web/src/components/financeiro/parcela-historico-sheet.tsx:93-139 — lido integralmente nesta sessão, condição citada verbatim linha 128]

**Nenhuma mudança em `CancelarLancamentoDialog`** (`web/src/components/financeiro/cancelar-lancamento-dialog.tsx`): quando o item clicado tem `item.kind === "lancamento"` (que é o caso de destrava — `LinhaHistoricoParcela = (LancamentoDetalhado & { kind: "lancamento" }) | (TaxaHistorico & { kind: "taxa" })`, `web/src/lib/kanban/parcelas.ts:54-56`), `rotuloDoItem()` já resolve o rótulo certo via `TIPO[item.tipo].label` (`lancamento-tipo-label.tsx:27-31` já tem a entrada `destrava: { icon: Unlock, label: "Destrava", ... }` desde a Phase 7), e `ParcelaHistoricoSheet` já passa `acao={cancelando?.kind ?? "lancamento"}` — que resolve para `"lancamento"` automaticamente, disparando `cancelarLancamento()` no `handleConfirm` do diálogo (`cancelar-lancamento-dialog.tsx:84-86`). A frase de efeito (`descricaoEfeito`, linha 104) — "O lançamento é apagado e o status da parcela é recalculado a partir do que sobrar" — continua tecnicamente correta para destrava (a recalculação roda mas é inócua), não precisa de texto condicional novo. [VERIFIED: web/src/components/financeiro/cancelar-lancamento-dialog.tsx e lancamento-tipo-label.tsx — lidos integralmente nesta sessão]

### Pattern 4: Componente `Pagination` + hook `usePagination`

**What:** Um componente novo, colocado em `web/src/components/pagination.tsx` (mesmo nível de `search-field.tsx` — não existe pasta `hooks/` no projeto hoje, confirmado por `Glob "web/src/**/use-*.ts*"` sem resultados, então colocar o hook no mesmo arquivo é consistente com o resto do projeto, que não tem uma convenção de hooks separada).

**Reset de página — a armadilha real encontrada nesta pesquisa:** um `useEffect(() => setPage(1), [items])` ingênuo dispara toda vez que o array muda de **referência**, não só quando o **filtro** muda de valor. Isso quebra em pelo menos 4 dos 6 call sites, porque ações de mutação chamam `router.refresh()` (Next.js re-renderiza o Server Component pai e gera um array novo, mesma composição) sem o filtro ter mudado:
- `parcelas-table.tsx` — `handleConciliar` chama `router.refresh()` (linha 58)
- `arquivados-view.tsx` — `handleDesarquivar` chama `router.refresh()` (linha 57)
- `cancelar-lancamento-dialog.tsx` — `handleConfirm` chama `router.refresh()` (linha 88), usado a partir de `parcela-historico-sheet.tsx` dentro de `parcelas-table.tsx`
- `configuracao-financeira-view.tsx` — `ConfigurarPercentuaisDialog`/`CaucaoHistoricoSheet` provavelmente chamam `router.refresh()` também (não lido linha a linha, mas mesmo padrão do projeto)

A recomendação é amarrar o reset a uma **chave de identidade do filtro** (`resetKey`), comparada durante a renderização (padrão oficial do React para "resetar estado quando uma prop muda", preferível a `useEffect` porque evita um render extra com dado desatualizado):

```typescript
// web/src/components/pagination.tsx
"use client"
import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const TAMANHO_PAGINA = 10

export function usePagination<T>(itens: T[], resetKey: unknown) {
  const [pagina, setPagina] = React.useState(1)
  const [ultimaChave, setUltimaChave] = React.useState(resetKey)

  // Ajusta o estado durante a renderização (padrão React para resetar
  // estado quando um input externo muda) em vez de useEffect — evita um
  // frame extra mostrando a página errada antes do reset.
  if (resetKey !== ultimaChave) {
    setUltimaChave(resetKey)
    setPagina(1)
  }

  const totalPaginas = Math.max(1, Math.ceil(itens.length / TAMANHO_PAGINA))
  const paginaEfetiva = Math.min(pagina, totalPaginas)
  const inicio = (paginaEfetiva - 1) * TAMANHO_PAGINA
  const itensDaPagina = itens.slice(inicio, inicio + TAMANHO_PAGINA)

  return { itensDaPagina, pagina: paginaEfetiva, totalPaginas, setPagina }
}

export function Pagination({
  pagina,
  totalPaginas,
  onPaginaChange,
}: {
  pagina: number
  totalPaginas: number
  onPaginaChange: (pagina: number) => void
}) {
  if (totalPaginas <= 1) return null

  return (
    <div className="mt-4 flex items-center justify-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        disabled={pagina === 1}
        aria-label="Página anterior"
        onClick={() => onPaginaChange(pagina - 1)}
      >
        <ChevronLeft className="size-4" />
      </Button>
      {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
        <Button
          key={n}
          variant={n === pagina ? "default" : "ghost"}
          size="icon"
          aria-current={n === pagina ? "page" : undefined}
          onClick={() => onPaginaChange(n)}
        >
          {n}
        </Button>
      ))}
      <Button
        variant="ghost"
        size="icon"
        disabled={pagina === totalPaginas}
        aria-label="Próxima página"
        onClick={() => onPaginaChange(pagina + 1)}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
```

**Nota sobre breakpoints mobile:** o número de botões numerados pode crescer muito com listas grandes (ex.: ~46 imóveis / 10 por página = 5 páginas — no volume atual do projeto isso nunca passa de ~5-6 botões, então uma versão simples sem truncamento ("1 2 3 4 5") já cobre o caso real; não vale a pena construir lógica de elipse ("1 2 … 8 9") para este volume — mesmo raciocínio de escala que `docs/data-model.md` já usa para justificar decisões simples no volume atual (~46-48 registros) do projeto). Ver "Claude's Discretion" no CONTEXT.md — desenho visual exato é discricionário.

### Per-call-site wiring (as seis listagens)

| # | Componente | `"use client"` hoje? | Onde o `.map()` roda | Onde o filtro vive | `resetKey` recomendado |
|---|---|---|---|---|---|
| 1 | `web/src/components/financeiro/parcelas-table.tsx` | Sim (linha 1) | `ParcelasTable`, linha 234 | URL searchParams, lido em `web/src/app/(app)/financeiro/page.tsx:44-70`, passado como prop `filtroInicial: FiltroValores` por `financeiro-view.tsx:37/84` | Nova prop `resetKey={JSON.stringify(filtroInicial)}` threaded de `FinanceiroView` → `ParcelasTable` |
| 2 | `web/src/components/reports/contracts-table.tsx` | **Não** (sem diretiva própria — mas só é importado por `reports-view.tsx`, que É `"use client"`; um componente sem diretiva própria, importado exclusivamente por um Client Component, já roda no cliente, `useState` funciona sem adicionar `"use client"` — mas adicionar por clareza é aceitável) | `ContractsTable`, linha 42 | `web/src/components/reports/reports-view.tsx:94-98` (`statusFilters`, `columnFilters`, `query`, todos `useState` locais) | Nova prop `resetKey` calculada em `ReportsView`, ex.: `` `${query}\|${[...statusFilters].sort().join(",")}\|${[...columnFilters].sort().join(",")}` `` |
| 3 | `web/src/components/reports/relatorio-financeiro-lista.tsx` | **Não** (mesma situação do #2 — só importado por `relatorio-financeiro-dedicado.tsx`, que É `"use client"`) | `RelatorioFinanceiroLista`, linha 58 | `web/src/components/reports/relatorio-financeiro-dedicado.tsx:56-58` (`filtro: FiltroRelatorioValores`, `useState`) | Nova prop `resetKey={JSON.stringify(filtro)}` |
| 4 | `web/src/components/reports/dinheiro-imobiliaria-view.tsx` | Sim (linha 1) | dentro do próprio componente, linha 166 | dentro do próprio componente — `periodo` (linha 56, `useState`) | `resetKey={periodo}` — sem prop nova, hook chamado dentro do próprio componente |
| 5 | `web/src/components/financeiro/configuracao-financeira-view.tsx` | Sim (linha 1) | `ConfiguracaoFinanceiraView`, linha 167 | **Nenhum filtro nesta tela** (confirmado por leitura integral — só recebe `linhas`/`todayISO`/`erro`) | `resetKey` constante (ex.: `"config"`) — não há filtro para resetar; página deliberadamente não muda sozinha após `router.refresh()` de uma edição de percentuais/caução |
| 6 | `web/src/components/arquivados/arquivados-view.tsx` | Sim (linha 1) | `ArquivadosView`, linha 114 | **Nenhum filtro nesta tela** (confirmado — só recebe `contratos`/`erroCarregamento`, UI-SPEC já documenta "sem filtro, estacionamento de baixo tráfego") | `resetKey` constante — mesma razão do #5; sem isso, desarquivar um contrato na página 2 (via `router.refresh()`) não deve jogar o usuário de volta à página 1 |

Todas as seis já recebem array completo já filtrado como prop e fazem `.map()` client-side — nenhuma paginação de servidor, nenhuma Server Action nova, confirmado por leitura de cada arquivo (não herdado do scout do CONTEXT.md sem checar).

### Anti-Patterns to Avoid
- **`useEffect(() => setPage(1), [items])` como reset:** dispara em todo `router.refresh()`, não só quando o filtro muda — ver "a armadilha real" acima. Use `resetKey` explícito comparado durante a renderização.
- **Paginação de servidor (nova query com `.range()`):** fora de escopo — D-04/D-06 do CONTEXT.md e o scout confirmam client-side; nenhuma das seis listas precisa de mudança de query, e o volume atual (~46-48 registros) não justifica o custo.
- **Um componente de paginação por listagem:** contraria D-06 explicitamente ("mesmo espírito de `IdPill`/`ParcelaSituacaoBadge`... não seis implementações duplicadas").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Paginação numerada | Lógica de paginação from scratch em cada uma das 6 telas | `usePagination`/`Pagination` únicos em `web/src/components/pagination.tsx` | Mesmo padrão de componente pequeno e genérico já usado (`IdPill`, `ParcelaSituacaoBadge`) — D-06 do CONTEXT.md pede isso explicitamente |
| Reset de estado ao mudar prop | `useEffect` de sincronização | Comparação de `resetKey` durante a renderização | Padrão oficial do React para "resetar estado quando um input externo muda" — evita frame extra com dado desatualizado, e evita o bug de resetar em todo `router.refresh()` |

**Key insight:** nenhuma das duas capacidades desta fase introduz complexidade nova de domínio — ambas são extensões mecânicas de padrões que o projeto já reusa há várias fases (allowlist `.in()`, `create or replace function` sobre o mesmo trigger, componente pequeno genérico ao lado de `IdPill`).

## Common Pitfalls

### Pitfall 1: Trigger e app dessincronizados (banco continua bloqueando, app promete "pode excluir")
**What goes wrong:** Se só `cardTemLancamento()` (app) for relaxado sem a migração `create or replace function` correspondente, o diálogo de exclusão mostra "permitido" e o `deleteCardAction` cai no branch de erro `P0001`, exibindo a mesma mensagem de bloqueio — não quebra, mas é uma regressão de UX silenciosa (o pré-voo mentiu).
**Why it happens:** As duas verificações (SQL trigger e função TypeScript `cardTemLancamento`) implementam o mesmo predicado em dois lugares, por design (defesa em profundidade) — mas isso significa que **os dois precisam mudar na mesma PR/deploy**.
**How to avoid:** A migração SQL e a mudança de `cardTemLancamento`/`cancelarLancamentoAction` devem estar no mesmo plano de execução, aplicadas antes de qualquer verificação manual do usuário.
**Warning signs:** Diálogo de exclusão mostra "permitido" mas o clique final falha com a mensagem de bloqueio.

### Pitfall 2: `docs/data-model.md` fica com frases factualmente erradas depois desta fase
**What goes wrong:** Duas frases existentes em `docs/data-model.md` descrevem o comportamento ATUAL (pré-fase) como definitivo e ficam erradas assim que a migração for aplicada:
- Linha 141: "A trava dispara para qualquer `parcela_lancamentos` ligado ao card, **de qualquer tipo (pagamento, acréscimo, desconto, destrava** e, no futuro, conciliação)"
- Linha 152: "`tipo='destrava'` **fica permanentemente fora** deste mecanismo [de cancelamento] — é um registro de auditoria... não um valor lançado por engano, e apagá-lo removeria esse rastro sem desfazer o destravamento em si"

Ambas ficam falsas no dia em que esta fase for para produção.
**Why it happens:** O projeto documenta decisões não-óbvias em `docs/data-model.md` (mesmo padrão de FINDOC-01/CANIMOB/IMOB) — mas cada fase nova que reabre uma decisão anterior precisa **também** revisitar essas duas frases, não só escrever uma entrada nova.
**How to avoid:** O plano desta fase deve incluir uma tarefa explícita: (a) atualizar a linha 141 para refletir "pagamento, acréscimo, desconto — `destrava` deliberadamente excluído desde a Phase 15" e (b) atualizar/substituir a linha 152 explicando a reabertura pontual, no mesmo estilo textual das entradas de "Decisões de design" já existentes (ver linha 152 inteira como referência de estilo: cita a fase, cita o D- da 12-CONTEXT.md, explica o trade-off, e agora precisa citar 15-CONTEXT.md como a exceção pontual).
**Warning signs:** Nenhum — é um doc, não quebra build/lint. Só fica desatualizado silenciosamente se ninguém lembrar.

### Pitfall 3: Reset de paginação amarrado à referência do array em vez do filtro (ver Pattern 4 acima)
**What goes wrong:** Usuário na página 3 do Financeiro cancela um lançamento → `router.refresh()` → array `linhas` tem nova referência (mesmo conteúdo/mesma contagem de parcelas) → se o reset for `useEffect(..., [linhas])`, a tela pula de volta para a página 1, perdendo a posição do usuário no meio de uma tarefa.
**Why it happens:** É o erro mais fácil de cometer implementando "resetar ao mudar o filtro" literalmente como "resetar ao mudar os dados" — os dois parecem a mesma coisa até alguém notar que toda mutação nesse projeto chama `router.refresh()`.
**How to avoid:** `resetKey` explícito por filtro (ver tabela de wiring acima), nunca a referência do array de itens.
**Warning signs:** Ao testar manualmente, cancelar/pagar/conciliar/desarquivar um item que não está na primeira página faz a tela "pular" para a página 1.

### Pitfall 4: Ensaio de migração perdendo o `begin;`/`rollback;` (hazard D-19 do projeto)
**What goes wrong:** O SQL Editor do Supabase às vezes executa `begin;`/`rollback;` como blocos separados em vez de uma única transação, se colados/rodados em cliques distintos — isso já causou pelo menos 3 pushes acidentais em produção neste projeto.
**Why it happens:** Comportamento de pooling de conexão do SQL Editor, documentado como D-19 no histórico do projeto.
**How to avoid:** O ensaio da migração desta fase (relaxar o predicado do trigger) deve ser um único bloco colável — ideal: um `do $$ ... $$` que termina em `raise exception` deliberado, ou o script inteiro (`begin; ... rollback;`) colado e executado de uma vez, nunca em blocos separados.
**Warning signs:** Se o ensaio "aplicar" silenciosamente sem pedir confirmação humana explícita (checkpoint:decision) antes do apply real, é sinal de que o ciclo ensaio→aplicar→verificar não foi seguido à risca.

## Code Examples

Ver seção "Architecture Patterns" acima — os quatro exemplos de código (SQL do trigger, `.in()` do cancelamento, condição do botão, `Pagination`/`usePagination`) já são os exemplos completos e prontos para uso desta fase, cada um com a leitura de arquivo que os embasa.

## State of the Art

Não aplicável — não há "abordagem antiga vs. nova" de ferramenta externa aqui; são extensões de padrões internos já em vigor no próprio histórico do projeto (Phases 6.2 → 13 → 15 para o trigger; Phase 11 → 12 → 15 para o cancelamento).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ConfigurarPercentuaisDialog`/`CaucaoHistoricoSheet` (usados em `configuracao-financeira-view.tsx`) também chamam `router.refresh()` após mutação, mesmo padrão do resto do projeto | Pattern 4, "a armadilha real" | Baixo — mesmo se não chamarem, a recomendação de `resetKey` constante para essa tela (sem filtro) continua correta e não piora nada |
| A2 | O desenho visual exato do componente `Pagination` (tamanho de botão, ícones `ChevronLeft`/`ChevronRight` do `lucide-react`, ausência de elipse de truncamento no volume atual) está dentro do espaço de discrição do usuário (CONTEXT.md "Claude's Discretion") | Pattern 4 | Baixo — é explicitamente discricionário; se o volume de dados crescer muito além de ~46-48 registros por listagem, a decisão de não truncar precisa ser revisitada |
| A3 | Nenhuma outra tela/componente fora dos seis listados referencia `parcelas-table.tsx`/`contracts-table.tsx`/etc. de um jeito que quebraria com a introdução de paginação (ex.: nenhum teste de scroll infinito, nenhum outro consumidor do array completo) | Per-call-site wiring | Baixo — não há suíte de testes automatizada no projeto (verificação é manual), então qualquer quebra apareceria na verificação manual do operador antes de produção |

**Se esta tabela parecer maior que o normal:** ainda assim, nenhuma das três é uma claim de fato de negócio ou de schema — são inferências de baixo risco sobre comportamento de UI já observado em componentes irmãos do mesmo projeto.

## Open Questions

1. **`ConfigurarPercentuaisDialog`/`CaucaoHistoricoSheet` chamam `router.refresh()`?**
   - What we know: `configuracao-financeira-view.tsx` foi lido integralmente e não expõe diretamente essa chamada (ela estaria dentro dos componentes de diálogo, não lidos nesta sessão).
   - What's unclear: se sim, confirma a necessidade do `resetKey` constante ali; se não, a paginação nessa tela é ainda mais simples (nunca precisa resetar).
   - Recommendation: não bloqueia o planning — o `resetKey` constante recomendado é seguro nos dois casos.

2. **Nome exato da migração e timestamp**
   - What we know: a última migração aplicada é `20260826000000_taxas_imobiliaria_lancamento_id.sql` (mesma data de hoje, 2026-08-26).
   - What's unclear: qual HHMMSS usar para a próxima (o projeto usa o padrão `YYYYMMDDHHMMSS`, incrementando o segmento de hora dentro do mesmo dia quando há mais de uma migração — ver `20260811000000` → `20260811010000`).
   - Recommendation: planner escolhe algo como `20260826010000_relaxar_exclusao_destrava.sql` ou o timestamp real de quando a migração for de fato escrita — só precisa ser posterior ao último arquivo existente.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase SQL Editor (acesso manual do operador) | Aplicar a migração da capacidade 1 | ✓ (mesma ferramenta usada em todas as fases anteriores) | — | — |
| Nenhuma dependência nova de runtime/pacote | Ambas capacidades | ✓ | — | — |

Nenhuma dependência externa nova nesta fase — mesmo ambiente já usado desde a Phase 4.

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` (`.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Não | Nenhuma mudança de autenticação nesta fase |
| V3 Session Management | Não | Server Actions continuam rodando com `sessao.supabase` (sessão do usuário), nunca `service_role` — sem mudança |
| V4 Access Control | Sim | RLS via `is_team_member()` já cobre `parcela_lancamentos`/`cards` — nenhuma policy nova, nenhuma mudança de perímetro. O trigger relaxado continua `security invoker` (não `definer`) — confirmado por leitura do corpo atual, que não declara `security definer` |
| V5 Input Validation | Sim | `id()`/`textoObrigatorio()` já validam `parcelaId`/`lancamentoId` em `cancelarLancamentoAction` — sem mudança de validação necessária, só o `.in()` allowlist muda |
| V6 Cryptography | Não | N/A |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Vazamento de "existe lançamento" para quem não é `is_team_member()` via trigger `security definer` | Information Disclosure | O trigger permanece `security invoker` (default do Postgres) — não declarar `security definer` na nova versão da função, mesma disciplina das migrações anteriores |
| Bypass do allowlist de tipo via chamada direta da Server Action fora da UI | Tampering | `cancelarLancamentoAction` já valida `parcelaId`/`lancamentoId` e aplica `.in("tipo", [...])` no próprio DELETE — o allowlist widenado continua sendo a única superfície de tipos aceitos, servidor é o portão de verdade (mesma disciplina D-15 já documentada em `deleteCardAction`) |
| Diálogo de exclusão mostrando "permitido" quando o banco na verdade bloqueia (pré-voo dessincronizado) | — (não é STRIDE, é correção funcional, mas afeta confiança do usuário na trava) | Ver Pitfall 1 — migração SQL e mudança de app no mesmo plano/deploy |

## Sources

### Primary (HIGH confidence — leitura direta de código nesta sessão)
- `web/src/lib/kanban/actions.ts` (linhas 576-802, 980-1500) — `tabelaTemCard`, `cardTemLancamento`, `deleteCardAction`, `cardTemLancamentoAction`, `exigirParcelaNaoConciliada`, `destravarParcelaAction`, `cancelarLancamentoAction`, `cancelarTaxaImobiliariaAction`
- `web/src/lib/kanban/parcelas.ts` (linhas 400-490) — `situacaoDaParcela`, `somarLancamentos`, `statusDeParcela`, `LinhaHistoricoParcela`, `LancamentoDetalhado`
- `supabase/migrations/20260819000000_cards_arquivado_em.sql` — criação original do trigger
- `supabase/migrations/20260824000000_dinheiro_imobiliaria.sql` (linhas 180-300) — corpo atual da função via `create or replace`
- `web/src/components/kanban/excluir-contrato-dialog.tsx` — texto de UI do diálogo de exclusão
- `web/src/lib/kanban/visibilidade.ts` (linhas 164-170) — `EXCLUSAO_BLOQUEADA_POR_LANCAMENTO`
- `web/src/components/financeiro/parcela-historico-sheet.tsx` — condição do botão "Cancelar"
- `web/src/components/financeiro/cancelar-lancamento-dialog.tsx` — `acao`/`rotulo`/`handleConfirm`
- `web/src/components/financeiro/lancamento-tipo-label.tsx` — `TIPO` map, entrada `destrava` já existente
- `web/src/components/financeiro/parcelas-table.tsx`, `web/src/components/reports/contracts-table.tsx`, `web/src/components/reports/reports-view.tsx`, `web/src/components/reports/relatorio-financeiro-lista.tsx`, `web/src/components/reports/relatorio-financeiro-dedicado.tsx`, `web/src/components/reports/dinheiro-imobiliaria-view.tsx`, `web/src/components/financeiro/configuracao-financeira-view.tsx`, `web/src/components/arquivados/arquivados-view.tsx` — as seis listagens e seus pais diretos, lidos integralmente
- `web/src/app/(app)/financeiro/page.tsx` — origem do filtro server-side de `parcelas-table.tsx`
- `web/src/components/financeiro/financeiro-view.tsx` — threading de `filtroInicial`
- `docs/data-model.md` (linhas 110-160) — estilo de "Decisões de design" e as duas frases que ficam desatualizadas (linhas 141, 152)
- `.planning/config.json` — `nyquist_validation: false`, `security_enforcement: true`, `security_asvs_level: 1`
- Listagem de diretório `web/src/components/ui/` e `web/src/components/*.tsx` — confirma ausência de `pagination.tsx`/`select.tsx` e a existência de `search-field.tsx` como precedente de componente pequeno no nível raiz de `components/`
- Listagem de `supabase/migrations/` — confirma o último arquivo (`20260826000000_taxas_imobiliaria_lancamento_id.sql`) para nomear a próxima migração

### Secondary (MEDIUM confidence)
- Nenhuma — toda a pesquisa desta fase foi feita por leitura direta do código-fonte do próprio projeto, sem necessidade de documentação externa (não há biblioteca nova envolvida)

### Tertiary (LOW confidence)
- Nenhuma

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero dependências novas, tudo já em uso no projeto
- Architecture: HIGH — todos os arquivos relevantes foram lidos integralmente nesta sessão, não inferidos de memória
- Pitfalls: HIGH — os quatro pitfalls (dessincronia trigger/app, doc desatualizado, reset de paginação por referência de array, hazard de ensaio D-19) foram encontrados por leitura direta do código dos componentes pai (`router.refresh()`) e do próprio `docs/data-model.md`, não por suposição

**Research date:** 2026-08-26
**Valid until:** próxima mudança estrutural no schema financeiro ou nos componentes de listagem — sem prazo fixo, projeto sem dependências externas voláteis nesta fase

---

## Requisitos sugeridos (REQUIREMENTS.md ainda não tem IDs para esta fase)

Seguindo o precedente de prefixos pós-milestone do projeto (CANPAG, CANAJU, IMOB, CANIMOB — cada capacidade nova ganha um prefixo de 3-7 letras ligado ao tema, não ao número da fase):

### CANDEST — Cancelamento/exclusão com destrava (pós-milestone, Phase 15)
- **CANDEST-01**: Um card com histórico de destrava, mas sem nenhuma parcela conciliada, pode ser excluído de verdade — nem o pré-voo do app nem o trigger de banco bloqueiam mais por causa só de `tipo='destrava'`
- **CANDEST-02**: Um lançamento `tipo='destrava'` ganha o mesmo botão "Cancelar" já usado para pagamento/acréscimo/desconto/taxa/caução, usando o mesmo `CancelarLancamentoDialog`
- **CANDEST-03**: Uma parcela conciliada continua bloqueando tanto a exclusão do card quanto o cancelamento de qualquer lançamento seu (incluindo destrava) — nenhuma trava nova, a existente (`exigirParcelaNaoConciliada`) já cobre

### PAGIN — Paginação de listagens (pós-milestone, Phase 15)
- **PAGIN-01**: As seis listagens fora do Board (Financeiro, Situação dos contratos, Relatório Financeiro dedicado, Relatório da imobiliária, Configuração financeira, Arquivados) mostram no máximo 10 itens por página
- **PAGIN-02**: A navegação entre páginas é numerada (1, 2, 3… + setas anterior/próxima), não apenas Anterior/Próxima
- **PAGIN-03**: Mudar um filtro em qualquer uma das seis telas volta a listagem para a página 1

<phase_requirements>
## Phase Requirements

Nenhum requisito com ID formal existe ainda em `REQUIREMENTS.md` para esta fase (confirmado — a tabela de Traceability vai até CANIMOB-05/Phase 14). A tabela abaixo usa os IDs sugeridos acima; o planner deve confirmar/ajustar os IDs reais ao adicionar a seção correspondente em `REQUIREMENTS.md`.

| ID sugerido | Descrição | Research Support |
|----|-------------|------------------|
| CANDEST-01 | Excluir card com histórico de destrava (sem conciliada) | Pattern 1 — SQL exato do trigger relaxado, `web/src/lib/kanban/actions.ts:603-638` (`cardTemLancamento`) a widenar em paralelo |
| CANDEST-02 | Botão "Cancelar" em lançamento destrava | Pattern 3 — condição exata em `parcela-historico-sheet.tsx:128`, confirmação de que `CancelarLancamentoDialog` não precisa mudar |
| CANDEST-03 | Parcela conciliada continua travando os dois fluxos | Confirmado por leitura de `exigirParcelaNaoConciliada` (`actions.ts:993-1012`), já chamada em `cancelarLancamentoAction` antes do DELETE |
| PAGIN-01 | Máx. 10 itens/página nas 6 listagens | Pattern 4 — `usePagination`/`Pagination`, confirmado que as 6 já recebem array completo filtrado client-side |
| PAGIN-02 | Paginação numerada (não só anterior/próxima) | Pattern 4 — componente `Pagination` com botões numerados + setas |
| PAGIN-03 | Reset para página 1 ao mudar filtro | Pattern 4 + tabela "Per-call-site wiring" — `resetKey` por componente, evitando a armadilha do Pitfall 3 |
</phase_requirements>
