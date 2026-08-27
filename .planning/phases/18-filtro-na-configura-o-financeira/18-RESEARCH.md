# Phase 18: Filtro na Configuração financeira - Research

**Researched:** 2026-08-27
**Domain:** Client-side live search filter over an in-memory array, composed with an existing pagination hook. No new library, no server/database change.
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Padrão do filtro**
- **D-01:** Reusar o componente `SearchField` (`web/src/components/search-field.tsx`) exatamente como já é usado no Board e em `/relatorios` (relatório "Situação dos contratos", via `ReportsView`/`reports-view.tsx`) — busca ao vivo, sem botão de submit, cada tecla atualiza a lista na hora, filtragem inteiramente no cliente sobre os dados já carregados. Não é o padrão do drawer colapsável de `FiltroParcelas` (Financeiro) nem o painel sempre-visível de `FiltroRelatorioFinanceiroLive` (Relatório Financeiro dedicado) — o usuário pediu especificamente "o mesmo input onde do relatório", identificado como o `SearchField` do relatório de Situação dos contratos.
- **D-02:** A busca filtra a lista de verdade (remove linhas que não batem), não apenas realça — mesmo comportamento dos relatórios (`matchingIds`/filtro real), diferente do Board (que só realça para não atrapalhar o drag-and-drop, D-doc em `search.ts`). Não existe conceito de arrastar nesta tela, então filtrar de verdade é o comportamento certo e mais simples.

**Campos da busca**
- **D-03:** A busca olha três campos, os mesmos já visíveis nas colunas da tabela: **número do contrato** (ID), **endereço** e **proprietário**. Confirmado explicitamente pelo usuário depois de eu apontar que `ContratoConfig` (o tipo desta tela) não tem `inquilino`/`telefone`/`observacoes` como o `Card` completo do Board — o `buildMatcher`/`searchableText` existentes em `search.ts` são tipados para `Card` e não se aplicam diretamente a `ContratoConfig`; a implementação precisa de um matcher próprio (ou uma adaptação) para os três campos desta tela. Mesma UX esperada: sem distinção de acento, múltiplos termos (cada termo precisa bater em algum dos três campos, mesmo espírito de `buildMatcher`).

### Claude's Discretion
- Onde exatamente a `SearchField` fica posicionada na tela (acima da tabela, ao lado do título, etc.) — mirar o posicionamento já usado em `reports-view.tsx` para consistência visual, mas o researcher/planner decide o detalhe.
- Texto do estado vazio quando a busca não encontra nada (hoje `ConfiguracaoFinanceiraView` só trata `erro` e `linhas.length === 0` "Nenhum contrato cadastrado ainda." — precisa de uma terceira mensagem para "filtrou e não achou nada", mirando o padrão já usado nos relatórios).
- Como a paginação (`usePagination`, resetKey hoje é a string constante `"config"` — D-PAGIN-03) precisa mudar para resetar a página quando o termo de busca muda, sem resetar quando o usuário só edita percentuais/caução (`router.refresh()`) — mesmo cuidado do Pitfall 3 documentado em `15-RESEARCH.md`, que o researcher desta fase deve reconfirmar contra o código atual.
- Se a busca deve rodar dentro do próprio `ConfiguracaoFinanceiraView` (componente client já existente) ou precisa de um componente novo — decisão de implementação, não de produto.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

No formal requirement IDs exist yet for this phase in `REQUIREMENTS.md` (confirmed by grep — the Traceability table stops at Phase 17's `EXCOL-01..04`). Following the project's post-milestone prefix convention (`CANDEST`, `PAGIN`, `REORD`, `EXCOL` — a short theme-linked prefix, not the phase number), this research suggests **`FILTCFG`** (Filtro Configuração). The planner should confirm/adjust when adding the `REQUIREMENTS.md` section.

| ID sugerido | Description | Research Support |
|----|-------------|------------------|
| FILTCFG-01 | Campo de busca ao vivo (`SearchField`, sem botão) filtra `linhas` de verdade por número, endereço e proprietário, sem acento-sensibilidade, com AND multi-termo | Code Examples § Matcher dedicado — sketch completo abaixo |
| FILTCFG-02 | Mudar o termo de busca volta a paginação para a página 1; editar percentuais/caução (`router.refresh()`) NÃO reseta a página | Code Examples § Composição do `resetKey` — reconfirma Pitfall 3 de `15-RESEARCH.md` contra o código atual |
| FILTCFG-03 | Busca sem resultado mostra uma mensagem distinta de "nenhum contrato cadastrado" | Common Pitfalls § Pitfall 1 — terceiro branch condicional, cópia alinhada ao precedente de `contracts-table.tsx` |
| FILTCFG-04 | `SearchField` posicionado de forma consistente com `reports-view.tsx` | Architecture Patterns § Posicionamento |
</phase_requirements>

## Summary

Esta é uma fase pequena e mecânica: adicionar um campo de busca ao vivo a uma única tela que já carrega todos os dados de uma vez no servidor (`ConfiguracaoFinanceiraPage`, Server Component, não muda nesta fase) e já pagina esses dados no cliente desde a Phase 15 (`usePagination`/`Pagination`, `web/src/components/pagination.tsx`). Não há biblioteca nova, não há mudança de schema, não há Server Action nova — o trabalho inteiro acontece dentro de `web/src/components/financeiro/configuracao-financeira-view.tsx`.

A única decisão técnica real (D-03) é como filtrar `ContratoConfig[]`, um tipo bespoke desta tela (`id, numero, endereco, proprietario, percentualAdministracao, percentualComissaoPrimeiroAluguel, caucaoEventos`) que **não tem** os campos (`inquilino`, `telefone`, `observacoes`, `valor`) que `buildMatcher`/`searchableText` em `web/src/lib/kanban/search.ts` esperam — essas duas funções são tipadas para `Card` (importado explicitamente no topo do arquivo: `import type { Card, Column } from "./types"`) e não compilam contra `ContratoConfig`. A recomendação desta pesquisa é **não tocar `search.ts`** (ele é o módulo de busca do Board/Relatórios, coeso em torno de `Card`/`Column`) e, em vez disso, escrever um matcher pequeno e local dentro de `configuracao-financeira-view.tsx`, reexportando só `normalizeText` (já genérico, já exportado, já testado na prática pelo Board e pelos Relatórios). Isso segue o mesmo espírito do próprio `ContratoConfig`, que já é um tipo bespoke desta tela em vez de um subtipo de `Card` — o comentário no arquivo já cita esse precedente ("mesmo padrão de `ContratoFiltro`/`CardVisibilidade`").

A segunda parte não-trivial é a composição do `resetKey` de `usePagination`. Hoje é a string constante `"config"` — comentada explicitamente como proposital, "para o `router.refresh()` de editar percentuais/caução nunca resetar a posição do usuário (Pitfall 3, 15-RESEARCH.md)". Essa fase precisa do oposto parcial: resetar quando a busca muda, sem resetar quando `router.refresh()` dispara por uma mutação não relacionada ao filtro. A composição correta — confirmada por leitura de `usePagination` e por dois precedentes já em produção (`reports-view.tsx`'s `contractsResetKey`, uma string composta de `query`+filtros; `dinheiro-imobiliaria-view.tsx`'s `resetKey={periodo}`, um valor de estado único passado direto) — é trocar a string constante pelo próprio estado `query` (`useState`, vive dentro do componente, sobrevive a re-renders de `router.refresh()` porque não é derivado da prop `linhas`). Nenhuma lógica de `useEffect` é necessária; `usePagination` já compara `resetKey` durante a própria renderização.

**Primary recommendation:** Adicionar `const [query, setQuery] = React.useState("")` e um matcher local (`buildContratoMatcher`, sketch completo abaixo) dentro de `ConfiguracaoFinanceiraView`; filtrar `linhas` num `React.useMemo` antes de passar para `usePagination`; trocar o `resetKey` constante `"config"` pelo próprio `query`; renderizar `SearchField` dentro do card já existente, acima da tabela, só quando há dado para buscar (`linhas.length > 0`); adicionar um terceiro branch condicional para "filtrou e não achou nada".

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Campo de busca ao vivo (`SearchField`) | Browser / Client | — | Componente já existente, `"use client"`, estado local (`value`/`onChange`) — nenhuma lógica de servidor envolvida |
| Filtragem por número/endereço/proprietário | Browser / Client | — | Filtra `linhas` (array já trazido pela carga inicial do Server Component) inteiramente em memória, sem round-trip |
| Reset de paginação ao mudar a busca | Browser / Client | — | `usePagination`/`resetKey`, comparação durante a própria renderização (React, sem `useEffect`) |
| Carga inicial dos contratos (`cards` + `caucao_eventos`) | API / Backend (Server Component) | Database (Supabase/RLS) | **Não muda nesta fase** — `ConfiguracaoFinanceiraPage` continua fazendo a mesma query sem filtro de visibilidade (A-02); citada aqui só para deixar explícito que o filtro roda inteiramente depois dessa fronteira |

## Standard Stack

Nenhuma biblioteca nova. A fase inteira usa ferramentas já em uso no projeto:

| Ferramenta | Já em uso | Papel nesta fase |
|---|---|---|
| React 19 (`useState`, `useMemo`) | Sim (todo o projeto) | Estado de `query`, filtragem memoizada |
| `SearchField` (`web/src/components/search-field.tsx`) | Sim (Board, `reports-view.tsx`) | Componente de input reusado sem alteração (D-01) |
| `normalizeText` (`web/src/lib/kanban/search.ts`) | Sim (Board, Relatórios) | Normalização acento-insensível reusada, sem alteração |
| `usePagination`/`Pagination` (`web/src/components/pagination.tsx`) | Sim (Phase 15, já em uso nesta mesma tela) | Composição do `resetKey` com o novo estado `query` |

**Installation:** nenhuma — zero dependências novas em `package.json`.

## Package Legitimacy Audit

Não aplicável — esta fase não instala nenhum pacote novo em nenhum ecossistema. Nenhuma verificação de registry é necessária.

## Architecture Patterns

### System Architecture Diagram

```
[ConfiguracaoFinanceiraPage — Server Component, INALTERADO]
        |
        | supabase.from("cards").select(...) sem filtro de visibilidade (A-02)
        v
[linhas: ContratoConfig[]] --prop--> [ConfiguracaoFinanceiraView — Client Component]
        |
        | React.useState("") -> query
        v
[buildContratoMatcher(query)] --filtra em memória-->
        |
        v
[linhasFiltradas: ContratoConfig[]]
        |
        | usePagination(linhasFiltradas, resetKey=query)  <-- NOVO: era resetKey="config"
        v
   +----+-------------------------------------------+
   | itensDaPagina (slice de até 12) --> .map() --> <TableRow>   |
   | pagina, totalPaginas, setPagina                              |
   +----+-------------------------------------------+
        |
        v
[<Pagination pagina totalPaginas onPaginaChange={setPagina} />]

Ao lado, sem afetar o fluxo acima:
[ConfigurarPercentuaisDialog / CaucaoHistoricoSheet] --router.refresh()--> re-renderiza
[ConfiguracaoFinanceiraPage] com `linhas` de referência NOVA, mas `query` (estado do
componente client) sobrevive intacto entre renders -> resetKey não muda -> página não reseta.
```

Um leitor consegue seguir o caso de uso principal (digitar "joao" → tabela filtra e volta pra página 1) e o caso de contraste (editar percentuais → `router.refresh()` → tabela atualiza dado mas mantém a página) só olhando as setas acima.

### Recommended Project Structure

Nenhum arquivo novo. Toda a mudança fica dentro de um arquivo já existente:

```
web/src/components/financeiro/
└── configuracao-financeira-view.tsx   # MODIFICADO — matcher local + useState(query) + resetKey novo
```

`web/src/lib/kanban/search.ts` **não muda** — permanece coeso em torno de `Card`/`Column` (Board + Relatórios).

### Pattern 1: Matcher dedicado para `ContratoConfig` (resposta à Open Question 1)

**What:** Uma função pequena, local a `configuracao-financeira-view.tsx`, que reusa `normalizeText` (import de `search.ts`) mas não reusa `buildMatcher`/`searchableText` (tipados para `Card`).

**Why local, not in `search.ts`:** `search.ts` importa `Card`/`Column` no topo e é consumido pelo Board e pelos Relatórios — um segundo matcher para um terceiro tipo (`ContratoConfig`) quebraria a coesão do módulo sem ganhar reuso real (nenhum outro consumidor precisa filtrar `ContratoConfig`). O próprio `ContratoConfig` já é declarado como tipo bespoke desta tela (comentário na linha 22-27 do arquivo: "tipo bespoke desta tela, não o `Card` completo — mesmo padrão de `ContratoFiltro`/`CardVisibilidade`"), então um matcher bespoke ao lado dele é consistente com o próprio precedente do arquivo. [VERIFIED: web/src/components/financeiro/configuracao-financeira-view.tsx:22-36 — lido integralmente nesta sessão; comentário citado verbatim acima]

**Example (sketch pronto, mesmo contrato de `buildMatcher` — AND multi-termo, acento-insensível):**
```typescript
// web/src/components/financeiro/configuracao-financeira-view.tsx
import { normalizeText } from "@/lib/kanban/search"

/**
 * D-03 (18-CONTEXT.md): ContratoConfig não tem inquilino/telefone/
 * observacoes como o Card completo do Board, então buildMatcher/
 * searchableText de search.ts (tipados para Card) não se aplicam aqui —
 * matcher próprio para os três campos já visíveis na tabela: número,
 * endereço, proprietário. Mesmo contrato de buildMatcher: todos os termos
 * precisam bater, cada um em qualquer um dos três campos.
 */
function searchableText(linha: ContratoConfig): string {
  return normalizeText(
    [String(linha.numero), linha.endereco, linha.proprietario].join(" ")
  )
}

function buildContratoMatcher(query: string): (linha: ContratoConfig) => boolean {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return () => true

  return (linha) => {
    const text = searchableText(linha)
    return terms.every((term) => text.includes(term))
  }
}
```
[VERIFIED: web/src/lib/kanban/search.ts:8-13, 43-70 — `normalizeText`, `parseTerms`, `buildMatcher` lidos integralmente; a assinatura de `buildContratoMatcher` acima espelha `buildMatcher` termo a termo, trocando `searchableText(card)`/`searchableDigits(card)` por um único `searchableText(linha)` de três campos, já que `ContratoConfig` não tem campo de telefone/valor equivalente]

`String(linha.numero)` cobre o caso de o usuário digitar o número do contrato (`numero: number`, confirmado no `type ContratoConfig` — [VERIFIED: web/src/components/financeiro/configuracao-financeira-view.tsx:28-36, quote: `numero: number`]) — sem precisar da lógica de `onlyDigits` que `search.ts` usa para telefone/valor, porque `numero` já é um inteiro simples sem máscara.

### Pattern 2: Composição do `resetKey` (resposta à Open Question 2)

**What:** Trocar a string constante `"config"` pelo próprio estado `query`.

**Current code (antes desta fase):**
```typescript
// PAGIN-03: tela sem filtro — chave constante, para o `router.refresh()`
// de editar percentuais/caução nunca resetar a posição do usuário
// (Pitfall 3, 15-RESEARCH.md).
const { itensDaPagina, pagina, totalPaginas, setPagina } = usePagination(
  linhas,
  "config"
)
```
[VERIFIED: web/src/components/financeiro/configuracao-financeira-view.tsx:144-150 — lido integralmente nesta sessão, código citado verbatim]

**Recommended (depois desta fase):**
```typescript
const [query, setQuery] = React.useState("")

const matchesQuery = React.useMemo(() => buildContratoMatcher(query), [query])
const linhasFiltradas = React.useMemo(
  () => linhas.filter(matchesQuery),
  [linhas, matchesQuery]
)

// FILTCFG-02: query (estado local do componente) sobrevive a um
// router.refresh() sem mudar — a prop `linhas` recebe referência nova, mas
// resetKey não muda, então a página do usuário não é perdida (mesmo cuidado
// do Pitfall 3, 15-RESEARCH.md, agora com um filtro real nesta tela pela
// primeira vez). Mudar o texto da busca, por outro lado, muda `query` e
// volta a paginação para a página 1 (FILTCFG-02, primeira metade).
const { itensDaPagina, pagina, totalPaginas, setPagina } = usePagination(
  linhasFiltradas,
  query
)
```

**Por que isso é seguro e por que funciona (reconfirmação do Pitfall 3 contra o código atual, pedida pelo CONTEXT.md):** `usePagination` (lido integralmente — [VERIFIED: web/src/components/pagination.tsx:35-56]) compara `resetKey !== ultimaChave` **durante a própria renderização**, nunca num `useEffect`. `router.refresh()` dispara um novo render do Server Component pai (`ConfiguracaoFinanceiraPage`), que passa uma nova referência de array `linhas` para `ConfiguracaoFinanceiraView` — mas `query` é `useState` local do **próprio** `ConfiguracaoFinanceiraView`, que não é remontado por um `router.refresh()` (o componente client permanece montado; só a prop `linhas` muda de valor). Logo `query` mantém seu valor entre um `router.refresh()` e outro, `resetKey` não muda, e a paginação não reseta — exatamente o comportamento que os dois precedentes já em produção validam:
- `reports-view.tsx:133` — `contractsResetKey` é uma string composta que inclui `query` (mesmo `useState` local da própria `ReportsView`) — [VERIFIED: web/src/components/reports/reports-view.tsx:98, 129-133, quote: `const [query, setQuery] = React.useState("")` / `` const contractsResetKey = `${query}|${[...statusFilters].sort().join(",")}|${[...columnFilters].sort().join(",")}` ``]
- `dinheiro-imobiliaria-view.tsx` — `resetKey={periodo}`, um valor de estado único passado direto sem composição, mesmo padrão simples recomendado aqui já que esta tela só ganha **um** filtro (a busca), não múltiplos como Relatórios [CITED: web/src/components/reports/dinheiro-imobiliaria-view.tsx — descrito na tabela "Per-call-site wiring" de 15-RESEARCH.md linha 286; não relido nesta sessão, tratado como MEDIUM confidence porque a citação vem de pesquisa anterior, não de leitura direta desta sessão]

### Pattern 3: Posicionamento do `SearchField` (resposta à Open Question 4)

**What:** Dentro do card `rounded-2xl` já existente (`ConfiguracaoFinanceiraView` retorna um único `<div className="rounded-2xl border border-border bg-card p-6">`), acima da tabela — mesma posição relativa que `reports-view.tsx` usa (`SearchField` no topo do bloco de filtro, antes das `FilterRow`/tabela).

**Diferença desta tela:** `reports-view.tsx` tem um cabeçalho de página (`<h1>Relatórios</h1>`) fora do bloco de filtro, e o `SearchField` fica dentro de um segundo card dedicado a filtros, separado do card da tabela. `ConfiguracaoFinanceiraView` não tem essa separação — o título "Configuração financeira" já vive em `page.tsx` (Server Component, fora deste componente), e o componente inteiro é um único card. A recomendação é colocar o `SearchField` **dentro** desse único card, como uma linha própria acima do `<Table>`, sem criar um segundo card de filtro (que seria over-engineering para um único campo de busca, sem chips/toggles como em Relatórios).

**Example (sketch, dentro do `return` de `ConfiguracaoFinanceiraView`):**
```tsx
return (
  <div className="rounded-2xl border border-border bg-card p-6">
    {!erro && linhas.length > 0 && (
      <div className="mb-4">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Buscar por número, endereço ou proprietário..."
          resultSummary={`${linhasFiltradas.length} de ${linhas.length} contratos`}
        />
      </div>
    )}
    {erro ? (
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar os dados agora. Tente novamente.
      </p>
    ) : linhas.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        Nenhum contrato cadastrado ainda.
      </p>
    ) : linhasFiltradas.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        Nenhum contrato corresponde à busca.
      </p>
    ) : (
      <div>
        <Table>{/* ... inalterado, exceto itensDaPagina já vem filtrado ... */}</Table>
        <Pagination pagina={pagina} totalPaginas={totalPaginas} onPaginaChange={setPagina} />
      </div>
    )}
  </div>
)
```

O `SearchField` fica **fora** do bloco condicional `erro`/`linhas.length === 0`/`linhasFiltradas.length === 0`/tabela — assim ele continua visível mesmo quando a busca atual não encontra nada (para o usuário poder editar o termo sem precisar limpar primeiro), mas some quando não há nenhum dado carregado (`linhas.length === 0`) ou em erro, porque não faz sentido buscar num conjunto vazio ou indisponível.

**`placeholder` custom obrigatório:** o `placeholder` default de `SearchField` é `"Buscar por proprietário, endereço, inquilino..."` [VERIFIED: web/src/components/search-field.tsx:17, quote: `placeholder = "Buscar por proprietário, endereço, inquilino..."`] — cita `inquilino`, campo que **não existe** em `ContratoConfig`/não é buscado nesta tela (D-03 é número/endereço/proprietário). Este componente **precisa** passar um `placeholder` explícito para não prometer um campo que a busca não cobre.

### Anti-Patterns to Avoid
- **Estender `buildMatcher`/`searchableText` de `search.ts` para aceitar `ContratoConfig`:** exigiria ou um union type ou generics genéricos sobre um módulo hoje monomórfico em `Card` — mais complexidade do que o problema pede, para um único consumidor novo. O matcher local (Pattern 1) resolve com menos código e sem risco de regressão no Board/Relatórios.
- **`useEffect(() => setQuery(""), [linhas])` ou qualquer sincronização de `query` com a prop `linhas`:** não há necessidade nenhuma — `query` é estado do usuário, não deve ser resetado por um `router.refresh()` de edição de percentuais/caução (o usuário pode estar no meio de uma busca quando abre um desses diálogos).
- **Criar um segundo card de filtro separado, como em `reports-view.tsx`:** over-engineering para um único campo sem chips — o campo cabe dentro do card único já existente (Pattern 3).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Campo de busca com ícone, botão limpar, atalho Esc | Input custom novo | `SearchField` (`web/src/components/search-field.tsx`) | D-01 explícito — componente já pronto, já acessível (`aria-label`, `resultSummary` para leitor de tela), reusado sem alteração |
| Normalização de texto acento-insensível | `String.prototype.normalize` reimplementado inline | `normalizeText` (`web/src/lib/kanban/search.ts`) | Já genérico, já testado na prática pelo Board e Relatórios — reexportar, não duplicar |
| Paginação numerada com reset de página | Lógica de paginação nova | `usePagination`/`Pagination` (`web/src/components/pagination.tsx`) | Mesmo hook já em uso nesta mesma tela desde a Phase 15 — só a composição do `resetKey` muda |

**Key insight:** esta fase não introduz nenhuma peça de infraestrutura nova — é 100% composição de peças já existentes (`SearchField`, `normalizeText`, `usePagination`) mais um matcher de ~10 linhas específico dos três campos desta tela.

## Common Pitfalls

### Pitfall 1: Terceiro branch de estado vazio esquecido, ou colidindo com o segundo
**What goes wrong:** Hoje `ConfiguracaoFinanceiraView` só distingue `erro` e `linhas.length === 0`. Se o filtro for aplicado só dentro do `usePagination`/`Table` sem um branch explícito para "filtrou e não achou nada", a tabela renderiza com `<TableBody>` vazio (zero `<TableRow>`, cabeçalho sozinho) — não é um erro, mas é uma UX pior que uma mensagem explícita, e diverge do precedente já estabelecido em `contracts-table.tsx:37-40` (`Nenhum imóvel corresponde aos filtros selecionados.`) e `parcelas-table.tsx:35` (`Nenhuma parcela encontrada para os filtros aplicados.`) — dois lugares no mesmo projeto que já resolvem exatamente este caso. [VERIFIED: web/src/components/reports/contracts-table.tsx:37-40, quote: `Nenhum imóvel corresponde aos filtros selecionados.`]
**Why it happens:** É fácil pensar "eu já tenho um branch para lista vazia" (`linhas.length === 0`) e esquecer que `linhasFiltradas.length === 0` é uma condição **diferente** (dataset não-vazio, filtro reduziu a zero).
**How to avoid:** Três branches explícitos e mutuamente exclusivos, na ordem: `erro` → `linhas.length === 0` (dataset vazio) → `linhasFiltradas.length === 0` (filtro sem match) → tabela. Ver Pattern 3 acima para o sketch completo.
**Warning signs:** Digitar um termo que não bate com nada mostra um cabeçalho de tabela vazio (sem linhas, sem mensagem) em vez de uma frase explicando o motivo.

### Pitfall 2: Resetar página pela referência de `linhas` em vez de por `query` (recorrência do Pitfall 3 de 15-RESEARCH.md, agora nesta tela específica)
**What goes wrong:** Se o reset de página for implementado como "sempre que os itens filtrados mudarem" (ex.: `resetKey={linhasFiltradas.length}` ou pior, `resetKey={linhasFiltradas}`), o usuário na página 2 que abre "Editar percentuais" e salva dispara `router.refresh()` → `linhas` ganha nova referência → mesmo se o **conteúdo** filtrado for idêntico, `linhasFiltradas` também é recriada (novo array, `.filter()` roda de novo) → se o `resetKey` depender dessa referência/tamanho de forma incidental, a página pode saltar de volta para a 1 sem o usuário ter mudado a busca.
**Why it happens:** É a mesma armadilha documentada em `15-RESEARCH.md` Pitfall 3, mas esta tela é a primeira vez que ela tem um filtro real — até agora o `resetKey` era uma constante porque não havia nada para resetar. É fácil, ao introduzir o primeiro filtro real da tela, copiar um padrão de "resetar quando os dados mudam" de fora do projeto em vez de seguir o padrão já estabelecido aqui (`resetKey` = identidade do **filtro**, nunca dos **dados**).
**How to avoid:** `resetKey` deve ser **exatamente** `query` (ou uma derivação pura de `query`, se no futuro outro filtro for adicionado) — nunca `linhas`, `linhasFiltradas`, ou qualquer valor derivado do array de dados. Ver Pattern 2 acima.
**Warning signs:** Editar percentuais/caução de um contrato que está na página 2+ faz a tela voltar para a página 1 depois do salvamento — teste manual explícito recomendado no plano desta fase (mesma ressalva que `15-RESEARCH.md` já registrou como não 100% testada interativamente nesta mesma tela).

### Pitfall 3: `placeholder` default do `SearchField` cita um campo que esta tela não busca
**What goes wrong:** Se o desenvolvedor esquecer de passar `placeholder` explícito, o campo mostra "Buscar por proprietário, endereço, inquilino..." — mas `ContratoConfig` não tem `inquilino`, e a busca desta tela (D-03) nem tenta olhar esse campo (não existe). Usuário digita um nome de inquilino esperando achar o contrato e não acha nada, sem entender por quê.
**Why it happens:** `placeholder` tem um default pensado para o Board/Relatórios (que têm `inquilino`); é fácil esquecer de sobrescrevê-lo ao reusar o componente numa tela com campos diferentes.
**How to avoid:** Sempre passar `placeholder="Buscar por número, endereço ou proprietário..."` (ou texto equivalente) explicitamente. Ver Pattern 3.
**Warning signs:** Nenhum em tempo de build/lint — é um bug de UX silencioso, só visível testando manualmente com um termo de inquilino.

## Code Examples

Ver "Architecture Patterns" acima — os três patterns (matcher dedicado, composição do `resetKey`, posicionamento) já são os exemplos completos e prontos para uso desta fase, cada um com a leitura de arquivo que os embasa.

## State of the Art

Não aplicável — não há "abordagem antiga vs. nova" de ferramenta externa aqui; é composição de padrões internos já em produção no próprio projeto (`SearchField` desde o Board original; `usePagination`/`resetKey` desde a Phase 15).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ConfigurarPercentuaisDialog` e `CaucaoHistoricoSheet` (os dois diálogos já existentes nesta tela) chamam `router.refresh()` após salvar, como o resto do projeto — não relidos linha a linha nesta sessão (mesma lacuna já registrada como A1 em `15-RESEARCH.md`) | Pattern 2 | Baixo — mesmo se algum dos dois não chamar `router.refresh()`, a recomendação de `resetKey={query}` continua correta: ela só reage a mudanças de `query`, nunca depende de saber se/quando `router.refresh()` dispara |
| A2 | Nenhum outro consumidor de `ContratoConfig` fora de `configuracao-financeira-view.tsx` precisaria do matcher — busca por `Grep` de `ContratoConfig` não foi executada nesta sessão além da leitura do próprio arquivo | Pattern 1 | Baixo — `ContratoConfig` é declarado e exportado só deste arquivo (comentário confirma "tipo bespoke desta tela"); mesmo que outro consumidor apareça no futuro, um matcher local não impede reuso posterior por extração |
| A3 | `dinheiro-imobiliaria-view.tsx` usa `resetKey={periodo}` como valor único de estado, sem composição — citado de `15-RESEARCH.md` (pesquisa anterior), não relido diretamente nesta sessão | Pattern 2 | Baixo — mesmo se o precedente citado estiver desatualizado, o padrão recomendado aqui (`resetKey={query}`) é auto-suficiente e já verificado contra o `usePagination` atual lido nesta sessão |

**Se esta tabela parecer pequena:** a maior parte das claims desta pesquisa foi verificada por leitura direta do código-fonte nesta sessão (`search.ts`, `search-field.tsx`, `pagination.tsx`, `configuracao-financeira-view.tsx`, `reports-view.tsx`, `contracts-table.tsx`, `page.tsx`) — as três entradas acima são as únicas inferências não confirmadas por leitura direta nesta sessão específica, e todas de risco baixo.

## Open Questions

1. **`ConfigurarPercentuaisDialog`/`CaucaoHistoricoSheet` chamam `router.refresh()`?**
   - What we know: `configuracao-financeira-view.tsx` foi lido integralmente; os dois componentes de diálogo são importados mas seus arquivos internos não foram lidos nesta sessão.
   - What's unclear: se sim, confirma que `router.refresh()` é o mecanismo real disparando o cenário do Pitfall 2; se não, a tela ainda assim se beneficia da mesma recomendação (nenhuma mudança na recomendação nos dois casos).
   - Recommendation: não bloqueia o planning — `resetKey={query}` é seguro nos dois casos, mas o plano desta fase deve incluir um `<human-check>` ou verificação manual explícita de "editar percentuais na página 2+ não reseta a página" (mesma ressalva já registrada em `15-RESEARCH.md`/`STATE.md` como não 100% testada interativamente até agora).

2. **Prefixo de requisito formal (`FILTCFG` vs. outro nome)**
   - What we know: nenhum ID existe ainda em `REQUIREMENTS.md`; o projeto usa prefixos curtos ligados ao tema (`CANDEST`, `PAGIN`, `REORD`, `EXCOL`), não ao número da fase.
   - What's unclear: se o usuário/planner prefere um nome diferente de `FILTCFG`.
   - Recommendation: planner confirma ou ajusta o prefixo ao escrever a seção nova em `REQUIREMENTS.md` — não é uma decisão técnica que bloqueie o plano.

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` (`.planning/config.json`, `workflow.security_asvs_level`). [VERIFIED: .planning/config.json:47-49, quote: `"security_enforcement": true, "security_asvs_level": 1, "security_block_on": "high"`]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Não | Nenhuma mudança de autenticação nesta fase |
| V3 Session Management | Não | `ConfiguracaoFinanceiraPage` continua usando a mesma sessão/RLS já existente — nenhuma mudança |
| V4 Access Control | Não | Nenhuma policy nova, nenhuma mudança de perímetro — o filtro roda depois que os dados já passaram pela RLS existente (`is_team_member()`, inalterada). A busca não expõe nenhum dado que o usuário autorizado já não recebesse antes desta fase — apenas esconde/mostra linhas do mesmo conjunto já autorizado |
| V5 Input Validation | Sim (mínimo) | O termo de busca (`query`) nunca é enviado ao servidor, nunca vira parte de uma query SQL, e é renderizado apenas via JSX padrão do React (`{value}` em `<Input>`, auto-escapado) — sem `dangerouslySetInnerHTML` em nenhum componente tocado nesta fase. Nenhuma validação de servidor é necessária porque não há escrita nem leitura nova disparada pela busca |
| V6 Cryptography | Não | N/A |

### Known Threat Patterns for este stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via termo de busca refletido na tela | Tampering / Information Disclosure | Não aplicável de forma prática aqui — `SearchField` usa `<Input value={value} onChange={...}>` (controlled input padrão do React/shadcn), e o `resultSummary` opcional é renderizado como texto simples (`{resultSummary}`), nunca HTML. Nenhum `dangerouslySetInnerHTML` em `search-field.tsx` [VERIFIED: web/src/components/search-field.tsx:1-86 — lido integralmente nesta sessão, nenhuma ocorrência de `dangerouslySetInnerHTML`] |
| Vazamento de dado não-autorizado via filtro client-side | Information Disclosure | Não aplicável — o filtro opera sobre `linhas`, que já é o conjunto completo que a RLS/Server Component autorizou para este usuário antes desta fase; filtrar no cliente nunca amplia o que já estava acessível, só reduz visualmente |

## Sources

### Primary (HIGH confidence — leitura direta de código nesta sessão)
- `.planning/phases/18-filtro-na-configura-o-financeira/18-CONTEXT.md` — decisões travadas (D-01/D-02/D-03), discrição do planner
- `web/src/components/search-field.tsx` — componente completo, lido integralmente
- `web/src/lib/kanban/search.ts` — `normalizeText`, `buildMatcher`, `searchableText`, `matchingIds`, `isSearching`, lidos integralmente
- `web/src/components/reports/reports-view.tsx` — uso de referência do `SearchField`, composição de `contractsResetKey`, lido integralmente
- `web/src/app/(app)/financeiro/configuracao/page.tsx` — Server Component, query sem filtro de visibilidade (A-02), lido integralmente
- `web/src/components/financeiro/configuracao-financeira-view.tsx` — componente a modificar, tipo `ContratoConfig`, `usePagination` atual com `resetKey="config"`, lido integralmente
- `web/src/components/pagination.tsx` — `usePagination`/`Pagination`, mecanismo de comparação de `resetKey` durante a renderização, lido integralmente
- `web/src/components/reports/contracts-table.tsx` — precedente de mensagem de estado vazio filtrado ("Nenhum imóvel corresponde aos filtros selecionados."), lido integralmente
- `.planning/config.json` — `security_enforcement: true`, `security_asvs_level: 1`, `workflow.nyquist_validation: false`
- `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` (seção Phase 18) — contexto de projeto e histórico

### Secondary (MEDIUM confidence)
- `.planning/phases/15-exclus-o-de-card-com-destrava-e-pagina-o/15-RESEARCH.md` — Pitfall 3 (reset por referência de array vs. por filtro), tabela "Per-call-site wiring" citando `dinheiro-imobiliaria-view.tsx`'s `resetKey={periodo}` — não relido diretamente nesta sessão, tratado como citação de pesquisa anterior já verificada em sua própria sessão

### Tertiary (LOW confidence)
- Nenhuma

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero dependências novas, todas as peças (SearchField, normalizeText, usePagination) já em produção e lidas integralmente nesta sessão
- Architecture: HIGH — todos os arquivos diretamente afetados (`configuracao-financeira-view.tsx`, `search.ts`, `search-field.tsx`, `pagination.tsx`) foram lidos integralmente nesta sessão, não inferidos de memória
- Pitfalls: HIGH — os três pitfalls (branch de estado vazio esquecido, reset por referência de array, placeholder default incorreto) foram encontrados por leitura direta do código atual e por comparação com precedentes já em produção no mesmo projeto (`contracts-table.tsx`, `parcelas-table.tsx`)

**Research date:** 2026-08-27
**Valid until:** próxima mudança estrutural em `ConfiguracaoFinanceiraView`, `search.ts` ou `pagination.tsx` — sem prazo fixo, fase sem dependências externas voláteis
