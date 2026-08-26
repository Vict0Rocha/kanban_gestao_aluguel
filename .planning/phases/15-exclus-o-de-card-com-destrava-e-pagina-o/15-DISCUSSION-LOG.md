# Phase 15: Exclusão de card com destrava e paginação - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-26
**Phase:** 15-exclusão-de-card-com-destrava-e-paginação
**Areas discussed:** Escopo destrava, Efeito no status, Escopo paginação, Estilo paginação

---

## Escopo destrava (feito antes do `/gsd-phase`, na primeira resposta do usuário ao pedido)

| Option | Description | Selected |
|--------|-------------|----------|
| Ambas (Recomendado) | Excluir o card mesmo com destrava no histórico E cancelar o lançamento de destrava individualmente | ✓ |
| Só desbloquear a exclusão do card | Trava de exclusão para de contar destrava; lançamento continua sem botão de cancelar | |
| Só permitir cancelar o lançamento de destrava | Botão "Cancelar" no lançamento destrava; trava de exclusão do card continua contando qualquer lançamento | |

**User's choice:** Ambas
**Notes:** O pedido original do usuário já vinha como "ou" ("excluir o card mesmo com esse histórico, ou que seja possível excluir esse histórico") — a pergunta esclareceu que não era uma escolha exclusiva.

## Efeito no status ao cancelar destrava

| Option | Description | Selected |
|--------|-------------|----------|
| Nada — só remove o registro do histórico (Recomendado) | Mesmo comportamento de cancelar pagamento/ajuste: recalcula pelo que resta no livro-razão | ✓ |
| Parcela volta a ficar conciliada | Cancelar a destrava desfaz a destrava, parcela volta ao estado travado | |

**User's choice:** Nada — só remove o registro
**Notes:** Confirma que `destrava` nunca participa de `somarLancamentos`, então `recalcularEGravarStatus` é seguro e inócuo para esse tipo.

---

## Escopo paginação

| Option | Description | Selected |
|--------|-------------|----------|
| Financeiro — lista de parcelas (Recomendado) | Tela principal /financeiro | ✓ |
| Relatórios → Situação dos contratos (Recomendado) | Tabela de contratos por status em /relatorios | ✓ |
| Relatório Financeiro dedicado (Recomendado) | Lista de parcelas filtradas em /relatorios/financeiro | ✓ |
| Relatório da imobiliária (Recomendado) | Lista de eventos (taxas+caução) em /relatorios/imobiliaria | ✓ |
| Configuração financeira — lista de contratos (Other, adicionado pelo usuário) | Tabela de contratos em /financeiro/configuracao | ✓ |
| Arquivados — lista de contratos arquivados (Other, adicionado pelo usuário) | Tabela em /arquivados | ✓ |

**User's choice:** Todas as 4 recomendadas + as 2 adicionadas via "Other" (Configuração financeira e Arquivados)
**Notes:** Board explicitamente confirmado fora de escopo pelo próprio usuário na mensagem original ("Só não precisa aplicar no board, lá está tudo certo").

---

## Estilo paginação

| Option | Description | Selected |
|--------|-------------|----------|
| Numerada (1 2 3 ... Recomendado) | Números clicáveis + setas anterior/próxima, mostra total de páginas | ✓ |
| Só Anterior/Próxima | Dois botões simples, sem números | |

**User's choice:** Numerada
**Notes:** Nenhum componente de paginação existe hoje no projeto — será construído do zero.

---

## Claude's Discretion

- Client-side vs. mudança na busca para a paginação — todas as seis listagens já recebem array completo já filtrado; paginação client-side (slice) é a abordagem natural
- Reset para página 1 ao mudar filtro
- Desenho visual exato do componente de paginação (dentro do design system Tailwind/shadcn já estabelecido)
- Se a migração do trigger também exige ajustar mensagens de aviso nos diálogos de exclusão/arquivamento

## Deferred Ideas

None — discussão ficou dentro do escopo da fase.
