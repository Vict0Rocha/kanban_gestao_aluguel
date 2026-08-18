---
sketch: 001
name: consulta-financeiro
question: "Como a barra de filtros (proprietário, inquilino, período, ID do contrato) convive com o seletor Mês atual/Próximo mês já em produção, sem virar duas telas concorrentes?"
winner: "B"
tags: [financeiro, filtros, consulta, layout]
---

# Sketch 001: Consulta Financeiro

## Design Question

O usuário pediu uma tela de consulta/filtros para a aba Financeiro, inspirada em ERPs profissionais (referência: Sienge), mas sem perder o design já aprovado nas Phases 5/6. Decisão já fechada: o seletor "Mês atual / Próximo mês" continua sendo a visão padrão ao abrir a aba — os filtros são uma camada adicional para refinar ou buscar fora desse padrão, não uma substituição.

A pergunta de design: **onde os filtros ficam, visualmente, para não competir com o seletor que já existe?**

## How to View

Abra `.planning/sketches/001-consulta-financeiro/index.html` no navegador (já deve estar aberto no painel).

## Variants

- **A: Filtros sempre visíveis** — uma barra compacta com os 4 campos (Proprietário, Inquilino, Período, ID) fica sempre acima do seletor, no estilo denso do Sienge adaptado à nossa paleta. O seletor Mês atual/Próximo mês fica logo abaixo, sempre visível também.
- **B: Filtros atrás de um botão** — o seletor Mês atual/Próximo mês fica sozinho no topo, dominante, como está hoje em produção. Um botão "🔍 Filtrar" ao lado abre/fecha um painel com os mesmos 4 campos, só quando o usuário precisa.

Ambas as variantes usam os mesmos dados fictícios e a mesma tabela de resultado (com a coluna **ID** nova e a coluna **Ações** já aprovada na Phase 6 — Pagamento/Ajustar/Histórico).

## What to Look For

- **Peso visual**: a variante A deixa a tela mais "cheia" desde o primeiro segundo (mais parecida com o ERP de referência); a B mantém a tela enxuta até você pedir os filtros.
- **A pílula do ID** (`#1`, `#2`...) — repare no tamanho e peso; ela também apareceria no card do Board, então precisa ficar discreta o bastante para não competir com o valor do aluguel lá.
- **Teste os filtros de verdade**: digite um nome de proprietário (ex.: "Marcos") ou um ID (ex.: "3") e clique Consultar — os dois combinam entre si (E lógico, não OU). Clique Limpar para voltar ao normal.
- **Estado vazio**: filtre por um proprietário que não existe (ex.: "xyz") para ver a mensagem de "nenhum resultado".
- Os botões de ação (Pagamento/Ajustar/Histórico) só mostram um alerta explicando que já existem de verdade no app — não são o foco deste sketch.

## Winner: B

Escolhida pelo usuário, com um ajuste importante em relação ao rascunho original: **o seletor "Mês atual / Próximo mês" foi removido**, substituído por uma visão padrão "Vencendo hoje" (só as parcelas cujo vencimento é a data de hoje). Aplicar qualquer filtro troca o cabeçalho para "Resultado da busca" e substitui a lista padrão — não há mais um estado "mês inteiro" sem filtro.

Essa mudança de escopo (e as regras de negócio que vieram junto — vencimento derivado do dia do contrato com fallback dia 20, geração de parcelas pelo período completo do contrato quando as duas datas existem, incluindo retroativo) estão registradas na conversa que gerou este sketch — ver histórico da sessão. Este README documenta só a decisão visual; as regras de geração/backfill precisam de tratamento próprio (consulta de impacto em produção antes de qualquer execução).
