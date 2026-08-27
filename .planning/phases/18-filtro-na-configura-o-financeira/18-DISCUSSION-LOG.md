# Phase 18: Filtro na Configuração financeira - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-27
**Phase:** 18-filtro-na-configura-o-financeira
**Areas discussed:** Padrão do filtro, Campos da busca

---

## Padrão do filtro

| Option | Description | Selected |
|--------|-------------|----------|
| Padrão do filtro (área pré-formulada) | Drawer colapsável (Financeiro) vs. painel sempre visível (Relatório Financeiro dedicado) | |
| Campos do filtro (área pré-formulada) | Quais campos fazem sentido para esta tela | |
| **Other (resposta livre)** | "Quero um campo de busca! O mesmo input onde do relatório onde o usuário digita alguma informação do contrato e é filtrado." | ✓ |

**User's choice:** Nenhuma das duas áreas pré-formuladas batia exatamente com o que o usuário tinha em mente — ele quis um terceiro padrão que eu não tinha oferecido: o `SearchField` (campo de busca único, ao vivo, sem botão) já usado no Board e no relatório "Situação dos contratos" (`/relatorios`), não os dois padrões de filtro multi-campo (`FiltroParcelas`/`FiltroRelatorioFinanceiroLive`) que eu tinha em mente ao formular a pergunta original.
**Notes:** Encontrei o componente exato (`web/src/components/search-field.tsx`) e confirmei com o usuário antes de travar a decisão.

---

## Campos da busca

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, os três | Número do contrato, endereço e proprietário — os mesmos que já aparecem nas colunas da tabela | ✓ |
| Só endereço e proprietário | Sem buscar por número do contrato | |

**User's choice:** Sim, os três (Recomendado)
**Notes:** Apontei que `ContratoConfig` (tipo desta tela) não tem `inquilino`/`telefone` como o `Card` completo do Board, então o `buildMatcher` existente em `search.ts` não se aplica direto — a implementação vai precisar de um matcher próprio para os três campos visíveis desta tela.

---

## Claude's Discretion

- Posicionamento visual exato da `SearchField` na tela (mirar `reports-view.tsx` para consistência).
- Texto do estado vazio "busca sem resultado" (hoje só existem os estados `erro` e `linhas.length === 0`).
- Mecanismo exato de resetar a paginação quando a busca muda, sem resetar em refreshes de edição (percentuais/caução) — revisitar o Pitfall 3 de `15-RESEARCH.md`.
- Se a lógica de busca fica dentro de `ConfiguracaoFinanceiraView` ou em um componente novo.

## Deferred Ideas

Nenhuma — a discussão ficou dentro do escopo da fase.
