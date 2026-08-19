---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Módulo Financeiro
current_phase: 06.2
current_phase_name: ciclo-de-vida-do-contrato
status: executing
stopped_at: Completed 06.2-05-PLAN.md
last_updated: "2026-08-19T22:46:37.819Z"
last_activity: 2026-08-19
last_activity_desc: Phase 06.2 plano 04 (visibilidade.ts) concluído e verificado em produção, avançar para 06.2-05
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 22
  completed_plans: 20
  percent: 57
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-16)

**Core value:** Dar visibilidade e controle sobre a situação de cada contrato de aluguel — sem depender de planilha.
**Current focus:** Phase 06.2 — ciclo-de-vida-do-contrato

## Current Position

Phase: 06.2 (ciclo-de-vida-do-contrato) — EXECUTING
Plan: 6 of 7
Status: Ready to execute
Last activity: 2026-08-19 — plano 06.2-04 (regra única de visibilidade de parcela) concluído e verificado em produção

**Ordem de execução:** 4 → 5 → 6 → 7 → 8. A numeração continua da v1.0 (Phases 1-3), não reinicia.

## Performance Metrics

**Velocity:**

- Total plans completed: 5 de 6 na v1.0 (SEC-02 pendente por escolha do usuário, não por trabalho restante); 0 de TBD na v2.0
- Average duration: —
- Total execution time: —

**By Phase (v1.0, concluída):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 — Segurança | 1/2 | 2 | — |
| 2 — Robustez | 2/2 | 2 | — |
| 3 — Documentação | 1/1 | 1 (vault de 22 notas) | — |

**By Phase (v2.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 4 — Fundação financeira | 0/TBD | — | — |
| 5 — Aba Financeiro com parcelas automáticas | 0/TBD | — | — |
| 6 — Baixa e ajustes de parcela | 0/TBD | — | — |
| 7 — Conciliação e destrava rastreada | 0/TBD | — | — |
| 8 — Relatórios financeiros | 0/TBD | — | — |

**Recent Trend:**

- Last 5 plans: SEC-01 (falso positivo) → SEC-03 (falso positivo) → vault Obsidian → Error Boundary → tela de acesso pendente
- Trend: Estável

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 06.2-ciclo-de-vida-do-contrato P05 | 35min | 3 tasks | 6 files |

## Accumulated Context

### Decisions

Decisões completas em PROJECT.md, seção Key Decisions. Recentes:

- 2026-08-19: Plano 06.2-04 concluído — `avaliarVisibilidadeParcela` (`web/src/lib/kanban/visibilidade.ts`) é a única implementação da regra de visibilidade, consumida pela leitura (Financeiro) e pela escrita (`registrarPagamentoAction`/`ajustarParcelaAction`). Verificado em produção com prova por SQL: inativar/reativar não altera contagem nem ids de parcela; mudar período some da tela sem apagar do banco; lançamento fora do período/com contrato inativo continua aparecendo (override D-05); tentativa de escrita numa aba desatualizada foi recusada pelo servidor com zero lançamentos gravados. VIDA-01 a VIDA-04 completos
- 2026-08-19: Plano 06.2-03 aplicado em produção (`aplicar-agora`) — `cards.arquivado_em` e o trigger `cards_impede_exclusao_com_lancamento` estão vivos, bloqueando exclusão de card/coluna com lançamento financeiro. Verificação pós-push completa (coluna, trigger, os três lados do backstop, policies, Board/Financeiro/Relatórios) contra produção real, com prova por SQL — não pela tela — de que dado com lançamento sobrevive a uma tentativa de exclusão recusada
- 2026-08-19: Nova técnica de ensaio contra pooling do SQL Editor do Supabase (D-19 extendida): condensar baseline + DDL + provas num único bloco `do $$ ... $$;` terminando em `raise exception` proposital — elimina o risco de connection-hopping do pool entre comandos separados, porque é um único comando. Documentada em `supabase/verificacao_cards_arquivado_em.sql` como via (c), agora a técnica preferida para ensaios futuros neste projeto
- 2026-08-16: Roadmap da v2.0 desviou da divisão de 6 fases da spec em 3 pontos, todos por verificabilidade manual (o projeto não tem suíte automatizada): documentação absorvida pela fase de schema (o pilar 4 da própria spec proíbe deixar doc para o final), geração automática unida à listagem da aba Financeiro (sem a rota não há como abrir a aba e conferir), e as Server Actions dissolvidas em duas fatias verticais com UI própria (baixa/ajustes e conciliação/destrava). Resultado: 5 fases, mesmo escopo — ver ROADMAP.md § Desvios
- 2026-08-16: A contagem de "26 requisitos da v2.0" em REQUIREMENTS.md estava errada — CONTRATO..FINDOC somam **28**. Corrigido na seção Coverage
- 2026-08-14: Documentação publicada no vault Obsidian (`kanba aluguel/`, 22 notas) — arquitetura, dados, funcionalidades, segurança, operação, armadilhas conhecidas, histórico de incidentes
- 2026-08-14: `.planning/codebase/CONCERNS.md` provou-se pouco confiável — 3 de 3 achados de segurança verificados até agora eram falsos positivos (console.error ×2, verificação de e-mail). Tratar o restante do documento como hipótese
- 2026-08-14: Error Boundary implementado em dois níveis (`app/error.tsx`, `app/(app)/error.tsx`) usando a prop `retry` (não `reset` — mudança da v16 do Next confirmada nos docs locais)
- 2026-08-14: Tela de "acesso pendente" implementada via `supabase.rpc("is_team_member")` no `(app)/layout.tsx` — não verificada com sessão real, ver Blockers
- 2026-08-14: Usuário optou por não mexer em mais configuração de segurança por enquanto — SEC-02 fica pendente por escolha, não por falta de trabalho
- [Phase ?]: deleteCardAction trava no servidor via cardTemLancamento (unica implementacao de D-14), falha fechada quando a verificacao falha
- [Phase ?]: arquivarCardAction/desarquivarCardAction escrevem so arquivado_em, nunca ativo -- ortogonais por decisao (D-12)
- [Phase ?]: Filtro arquivado_em sobre embed cards(*) em page.tsx/relatorios usa .is() sem !inner, para preservar a coluna e filtrar so as linhas do embed

### Pending Todos

- Definir se a documentação do módulo financeiro vive em `docs/data-model.md` (como FINDOC-01 pede) e/ou também vira nota no vault Obsidian — decidir na Phase 4, não bloqueia

### Blockers/Concerns

- **ROBUST-02 não verificado com login real.** O código está escrito, lintado e buildado, e segue o mesmo padrão de outras queries já funcionando no mesmo Server Component — mas o navegador embutido usado para verificação ficou instável (mesmo problema já visto durante o diagnóstico do Turnstile) e não foi possível confirmar visualmente que a tela de "acesso pendente" aparece corretamente para um usuário fora da allowlist. **Ação sugerida:** o usuário confirma manualmente, ou testa com uma conta de teste removida da allowlist. **Relevante para a v2.0:** a Phase 4 precisa provar que o RLS das tabelas novas barra quem está fora da allowlist — é uma boa oportunidade para fechar esta verificação junto.
- **`.planning/codebase/CONCERNS.md` tem taxa de acerto baixa.** 3 de 3 achados de segurança verificados até agora eram falsos positivos. Tratar o restante como hipótese, não fato.
- **SEC-02 depende do usuário.** Leaked Password Protection é toggle no painel do Supabase; usuário optou por adiar. Fora do escopo de fases da v2.0.
- **Sem suíte automatizada.** Toda verificação da v2.0 é lint + build + teste manual no navegador (e SQL Editor do Supabase na Phase 4). Os critérios de sucesso do roadmap foram escritos para serem conferíveis à mão por causa disso.
- **Produção com dados reais.** ~46 imóveis em uso; a migração da Phase 4 precisa ser aditiva e retrocompatível — nada de coluna apagada, nada de `ativo` nulo.

### Roadmap Evolution

- Phase 06.1 inserted after Phase 6: Consulta financeira e geração por período — feedback do usuário após testar Phase 6 em produção (URGENT)
- Phase 06.2 inserted after Phase 6.1: Feedback do usuario apos usar Phases 6/6.1 em producao: ativo nao escondia parcelas futuras, mudanca de datas do card nao refletia no Financeiro, e excluir card apagava historico financeiro em cascata sem trava (URGENT)

## Deferred Items

Itens reconhecidos e adiados (ver REQUIREMENTS.md):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| TEST | Suite de testes automatizados (validação, RLS+Server Actions, E2E) | Deferred | Init |
| REFACTOR | Extrair hooks do componente Board; centralizar utilidades de data | Deferred | Init |
| SEC | Leaked Password Protection | Deferred por escolha do usuário | 2026-08-14 |
| FIN | Forma de pagamento na baixa; exportação PDF/planilha; backfill histórico | Deferred (pós-v2.0) | 2026-08-16 |

## Session Continuity

Last session: 2026-08-19T22:46:37.756Z
Stopped at: Completed 06.2-05-PLAN.md
Resume file: None
