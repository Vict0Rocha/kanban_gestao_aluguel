# Phase 10: Relatório Financeiro dedicado - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-21
**Phase:** 10-relatorio-financeiro-dedicado
**Areas discussed:** Filtro dinâmico + papel do botão, Lista de contratos, Conteúdo e geração do PDF, Nome e local da rota nova

---

## Filtro dinâmico + papel do botão "Gerar relatório"

| Option | Description | Selected |
|--------|-------------|----------|
| Vira só "Exportar PDF" | O filtro já atualiza a tela sozinho. O botão vira "Exportar PDF", que gera o PDF do que está na tela agora | ✓ |
| Os dois botões convivem | Mantém um botão "Aplicar"/"Atualizar" redundante e adiciona um botão separado "Exportar PDF" | |

**User's choice:** Vira só "Exportar PDF" (opção recomendada).
**Notes:** Nenhuma ressalva adicional.

---

## Lista de contratos

| Option | Description | Selected |
|--------|-------------|----------|
| Uma linha por parcela | Mesmo nível de detalhe dos 4 cards — cada linha é uma parcela, com endereço, proprietário, competência, vencimento, situação e valor | ✓ |
| Uma linha por contrato | Cada linha é um imóvel/contrato — endereço, proprietário, e um resumo da situação | |

**User's choice:** Uma linha por parcela (opção recomendada).
**Notes:** Nenhuma ressalva adicional.

---

## Conteúdo e geração do PDF

| Option | Description | Selected |
|--------|-------------|----------|
| Cartões + lista + filtros aplicados | Os 4 totais, a lista completa filtrada, e um cabeçalho com os filtros ativos e a data de geração | ✓ |
| Só a lista de parcelas | Só a tabela detalhada, sem cartões nem cabeçalho de filtros | |
| Só os cartões-resumo | Só os 4 totais, sem a lista linha-a-linha | |

**User's choice:** Cartões + lista + filtros aplicados (opção recomendada).
**Notes:** Geração (biblioteca/abordagem client vs server) ficou como Claude's Discretion — o usuário só se importou com o conteúdo.

---

## Nome e local da rota nova

| Option | Description | Selected |
|--------|-------------|----------|
| /relatorios/financeiro, mesma aba | Sub-rota de /relatorios, o botão navega direto sem sair do fluxo | ✓ |
| /relatorios/financeiro, nova aba | Mesma URL, mas abre em target="_blank" | |
| Outro caminho | Usuário digitaria outro nome | |

**User's choice:** /relatorios/financeiro, mesma aba (opção recomendada).
**Notes:** Nenhuma ressalva adicional.

---

## Claude's Discretion

- Estratégia de dado ao vivo: buscar uma vez ao carregar a página e filtrar em memória a cada tecla, vs. buscar do servidor a cada mudança de campo. Buscar uma vez foi a recomendação registrada em CONTEXT.md, dado o volume real do projeto (~48 contratos).
- Biblioteca/abordagem de geração do PDF (client-side print, jsPDF/html2canvas, ou server-side) — nenhuma preferência de produto declarada.
- Estado inicial do painel de filtro (fechado por padrão, mesmo padrão da Phase 8).
- Texto exato e posição do botão "Relatório financeiro" dentro de `/relatorios` — fica para a UI-SPEC.

## Deferred Ideas

- **Rastrear dinheiro recebido pela imobiliária** (taxa de administração, primeiro aluguel, caução, taxas de gestão) — levantado pelo usuário como resposta "Other" à pergunta de quais áreas discutir. Identificado como capacidade nova de modelo de dados (não uma variação de relatório), fora do escopo desta fase. Sugerido como fase futura própria (Phase 11), a definir quando o usuário quiser seguir.
