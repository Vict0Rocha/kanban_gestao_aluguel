---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Módulo Financeiro
current_phase: 8
current_phase_name: relatorios-financeiros
status: executing
stopped_at: "Phase 7 completa (2/2 planos, 4/4 critérios de sucesso) — todos os quatro human-checks confirmados em produção, incluindo o cenário de aba desatualizada para CONCIL-02. Pronta para planejar a Phase 8."
last_updated: "2026-08-20T13:00:00.000Z"
last_activity: 2026-08-20
last_activity_desc: "Phase 7 encerrada. Os quatro blocos de human-check (Conciliar/badge/toast/corrida entre abas, recusa server-side com o cenário de aba desatualizada, Destravar com motivo obrigatório, histórico de destravas) confirmados pelo usuário em produção. CONCIL-01..04 completos. Módulo Financeiro v2.0: só falta a Phase 8 (Relatórios financeiros)."
progress:
  total_phases: 7
  completed_phases: 6
  total_plans: 24
  completed_plans: 24
  percent: 86
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-16)

**Core value:** Dar visibilidade e controle sobre a situação de cada contrato de aluguel — sem depender de planilha.
**Current focus:** Phase 8 — Relatórios financeiros (a planejar)

## Current Position

Phase: 7 (Conciliação e destrava rastreada) — COMPLETE (2/2 planos, 4/4 critérios de sucesso)
Phase: 8 (Relatórios financeiros) — NOT STARTED
Status: Pronta para /gsd-plan-phase (ou discuss-phase) da Phase 8
Last activity: 2026-08-20 — Phase 7 encerrada; os quatro human-checks confirmados em produção pelo usuário, incluindo o cenário de aba desatualizada para a trava de escrita (CONCIL-02)

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
| 7 — Conciliação e destrava rastreada | 2/2 | 2 (~11min) | ~11min |
| 8 — Relatórios financeiros | 0/TBD | — | — |

**Recent Trend:**

- Last 5 plans: SEC-01 (falso positivo) → SEC-03 (falso positivo) → vault Obsidian → Error Boundary → tela de acesso pendente
- Trend: Estável

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 06.2-ciclo-de-vida-do-contrato P05 | 35min | 3 tasks | 6 files |
| Phase 07-concilia-o-e-destrava-rastreada P01 | ~10min | 2 tasks | 4 files |
| Phase 07-concilia-o-e-destrava-rastreada P02 | ~12min | 3 tasks | 5 files |

## Accumulated Context

### Decisions

Decisões completas em PROJECT.md, seção Key Decisions. Recentes:

- 2026-08-20: **Phase 7 encerrada.** Os quatro `<human-check>` dos planos 07-01/07-02 confirmados pelo usuário em produção: Conciliar em um clique com badge/toast/corrida entre abas; a trava server-side de Pagamento/Ajustar numa parcela conciliada testada especificamente com o cenário de aba desatualizada (a única forma real de exercitar essa trava, já que os botões somem da tela numa linha conciliada — sem essa checagem específica o teste teria sido inconclusivo); Destravar com motivo obrigatório; histórico de destravas em `ParcelaHistoricoSheet`. Nenhuma migração de banco foi necessária na fase inteira — o schema já antecipava tudo desde a Phase 4. Os quatro `tipo` de `parcela_lancamentos` (pagamento/acrescimo/desconto/destrava) estão todos alcançáveis pela interface agora, fechando o modelo de livro-razão. CONCIL-01..04 completos. Falta só a Phase 8 (Relatórios financeiros) para fechar o milestone v2.0

- 2026-08-20: **Plano 07-01 concluído** (worktree isolado, `agent-a89786e00ac45bcf8`). `conciliarParcelaAction` grava `status='conciliada'`/`conciliada_em`/`conciliada_by` num único UPDATE condicionado a `.eq("status","paga")` — essa condição é a trava de corrida real de D-01, não uma leitura seguida de escrita. Botão "Conciliar" (ghost, ícone Lock) aparece só em `linha.situacao === "paga"`, sem diálogo (D-07), com `ConciliarFalhaToast` novo (cópia de `write-error-toast.tsx`, subtexto "Tente novamente." porque não é otimista). Trava adicional `exigirParcelaNaoConciliada` (CONCIL-02/D-03) chamada por `registrarPagamentoAction`/`ajustarParcelaAction` DEPOIS de `exigirParcelaVisivel` (Phase 6.2) — camada extra, não substituição. `npm run lint`/`npm run build` verdes, todas as asserções de grep do plano passaram. Commits: `0a9584f` (Task 1), `26fa42e` (Task 2). **Human-check pendente em produção** (ver Blockers) — verificação visual do badge, corrida entre abas, e mensagem inline de recusa ainda não confirmadas por humano.
- 2026-08-19: **Phase 6.2 encerrada.** Plano 06.2-07 (rota `/arquivados` + nota contextual do Financeiro) concluído, fechando o último critério de sucesso da fase. No checkpoint final, o usuário encontrou a data de arquivamento mostrando o dia seguinte — investigação revelou um bug sistêmico pré-existente (não introduzido pela Phase 6.2): "hoje" era calculado 4 vezes no código com `new Date().getFullYear()/getMonth()/getDate()` no servidor, que em produção (Vercel) roda em UTC, não no fuso de Cuiabá (UTC-4). Das 20h à meia-noite, hora de Cuiabá, isso fazia o Financeiro mostrar "vencendo hoje" com parcelas de amanhã, classificar vencida/a_vencer um dia adiantado, e podia recusar um lançamento legítimo do mês corrente na trava de escrita. Corrigido com `hojeEmCuiaba()`/`formatInstantDate()` (`web/src/lib/kanban/format.ts`), usando `Intl.DateTimeFormat` com `timeZone: "America/Cuiaba"` — consolidando as 4 reimplementações antigas. Reconfirmado pelo usuário em produção após o deploy. **Lição registrada:** qualquer cálculo futuro de "hoje" ou "agora" no servidor deve usar `hojeEmCuiaba()`, nunca os getters de fuso local do `Date` nativo
- 2026-08-19: Plano 06.2-06 concluído — `ArquivarContratoDialog`/`ExcluirContratoDialog` (novos, irmãos do div ordenável do dnd-kit) trazem arquivar e excluir para o card do Board. Bug real de vazamento de evento do dnd-kit (já observado uma vez neste arquivo) testado explicitamente em produção e não se repetiu — digitar espaço e selecionar texto no campo de confirmação funcionam sem iniciar arraste. Board passou a aguardar o servidor em arquivar/excluir, mantendo arraste e toggle Ativo/Inativo otimistas. VIDA-06 completo; VIDA-05 aguarda o plano 06.2-07 (aba Arquivados, ainda não construída — usuário confirmou sua ausência, como esperado)
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
- 2026-08-20: **Plano 07-02 concluído** (worktree isolado, `agent-af95894d026629c62`). `destravarParcelaAction` relê `status` antes de qualquer gravação (só aceita `"conciliada"`), grava lançamento `tipo="destrava"` com `motivo` obrigatório (teto real **500**, corrigindo um erro da UI-SPEC que citava 2000 — CHECK `parcela_lancamentos_motivo_tamanho` é distinta da CHECK de `observacao`) e devolve `status` a `"paga"`. `DestravarParcelaDialog` novo (motivo obrigatório, bloqueado no cliente antes do round-trip) e `AcoesCell` reestruturado: linha conciliada mostra só Destravar+Histórico, demais situações mantêm a sequência do plano 07-01. `ParcelaHistoricoSheet` agora renderiza `motivo` ao lado de `observacao`, fechando CONCIL-04 — os quatro `tipo` de `parcela_lancamentos` estão todos alcançáveis pela interface. `npm run lint`/`npm run build` verdes, todas as asserções de grep passaram. Commits: `3906a4e` (Task 1), `477f56b` (Task 2), `7373eba` (Task 3). **Human-check pendente em produção** (ver Blockers).

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

Last session: 2026-08-20T13:00:00.000Z
Stopped at: Phase 7 completa e verificada em produção. Próximo passo: /gsd-discuss-phase 8 (Relatórios financeiros)
Resume file: None
