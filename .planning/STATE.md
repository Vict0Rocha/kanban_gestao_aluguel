---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Módulo Financeiro
current_phase: 8
current_phase_name: relatorios-financeiros
status: complete
stopped_at: Phase 9 UI-SPEC approved
last_updated: "2026-08-20T18:15:26.679Z"
last_activity: 2026-08-20
last_activity_desc: "Plano 08-01 executado (worktree agent-a21e4bc9c4e5a64a0). Relatório financeiro de 4 categorias entregue em /relatorios, npm run lint/build verdes, todas as asserções de grep do plano passaram. Módulo Financeiro v2.0: falta só a verificação humana em produção dos dois blocos human-check do plano 08-01 para fechar a milestone."
progress:
  total_phases: 8
  completed_phases: 8
  total_plans: 25
  completed_plans: 25
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-16)

**Core value:** Dar visibilidade e controle sobre a situação de cada contrato de aluguel — sem depender de planilha.
**Current focus:** Módulo Financeiro v2.0 **completo**. Dois problemas encontrados na verificação final de produção abrem trabalho novo: Phase 9 (integridade de datas do contrato nas parcelas) em discussão; Phase 10 (página dedicada de Relatório Financeiro + PDF) planejada em seguida.

## Current Position

Phase: 8 (Relatórios financeiros) — COMPLETE (1/1 plano, 4/4 critérios de sucesso, confirmados em produção pelo usuário)
Status: Módulo Financeiro v2.0 (Phases 4 → 5 → 6 → 6.1 → 6.2 → 7 → 8) fechado.
Last activity: 2026-08-20 — Verificação humana final da Phase 8 confirmou os 4 critérios, mas revelou dois problemas reais em produção (ver Decisions): (a) editar a data de um contrato não remove parcelas futuras que ficaram fora do novo período — corrigido o sintoma de visibilidade desde a Phase 6.2, mas os Relatórios (D-05) não filtram por período e por isso vazavam parcelas órfãs; a correção definitiva (apagar as órfãs) vira Phase 9; (b) "Gerar relatório" numa aba deixada aberta não refletia dados mudados em outro lugar — corrigido no ato (não é um plano formal, mudança contida): `buscarParcelasRelatorioAction` busca dados frescos a cada clique em vez de reusar a prop da carga inicial da página.

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
| 8 — Relatórios financeiros | 1/1 | 15min | 15min |

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
| Phase 08-relat-rios-financeiros P01 | 15min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisões completas em PROJECT.md, seção Key Decisions. Recentes:

- 2026-08-20: **Módulo Financeiro v2.0 (Phases 4-8) encerrado.** Os 4 critérios da Phase 8 confirmados pelo usuário em produção, incluindo o caso de D-05 (contrato inativo entrando nos totais, verificado com 27 linhas reais de um caso de teste). Coverage: 39/39 requisitos da v2.0. A verificação final revelou dois problemas que abrem trabalho novo pós-milestone (ver abaixo) em vez de bloquear o fechamento — nenhum dos dois invalida os critérios de sucesso da Phase 8 em si.
- 2026-08-20: **Bug real encontrado: editar a data de um contrato não limpa as parcelas futuras que ficam fora do novo período.** Exemplo do usuário: contrato de 12 meses gera 12 parcelas; corrigir para 6 meses não apaga as 6 parcelas futuras já geradas, que continuam existindo no banco. `updateCardAction` (`actions.ts:345`) só grava `cards`, nunca toca `parcelas`. O Financeiro já esconde essas parcelas (regra de visibilidade da Phase 6.2, D-03: "esconder, nunca apagar"), mas os Relatórios (Phase 8, D-05) buscam todas as parcelas sem filtro de período — por isso as órfãs vazavam ali. Confirmado em produção: query de leitura achou 27 parcelas órfãs em 2 contratos de teste. **Decisão do usuário:** ao contrário de D-03 (que só esconde), a nova regra deve **apagar de verdade** as parcelas futuras órfãs (só as sem pagamento/lançamento — protegidas continuam intocáveis), para não acumular dado morto no banco. Isso reverte D-03 deliberadamente; vira Phase 9, com discussão formal por reverter uma decisão já documentada e por envolver exclusão de dado em produção. Also: "sem data no contrato" deve gerar só a parcela do mês atual (hoje gera atual+próximo) — ajuste pequeno, mesma fase.
- 2026-08-20: **Bug real corrigido: "Gerar relatório" numa aba aberta há tempo não reflete mudanças feitas em outro lugar** (só F5 completo atualizava). Causa: `RelatorioFinanceiro` reusava os `parcelas` recebidos como prop da carga inicial da página. Corrigido fora de plano formal (mudança contida, sem risco de dado): nova Server Action `buscarParcelasRelatorioAction` (`actions.ts:1129`) é a única fonte da consulta, chamada tanto pela carga inicial de `relatorios/page.tsx` quanto por cada clique em "Gerar relatório" — sempre busca dado fresco. `relatorios/page.tsx` não faz mais a query de parcelas diretamente; `RelatorioFinanceiro`/`FiltroRelatorioFinanceiro` perderam as props `parcelas`/`erro`/`todayISO` (agora auto-contido). `tsc --noEmit` limpo. Verificação funcional em produção pendente de confirmação do usuário (não consegui testar via navegador — login exige senha real, e não devo digitar credenciais).
- 2026-08-20: **Nova fase planejada: Phase 10 (página dedicada de Relatório Financeiro).** Pedido do usuário após ver o painel suspenso da Phase 8: quer um botão "Relatório financeiro" dentro de `/relatorios` levando a uma página própria, com o mesmo padrão de filtro suspenso + cards, mas agora com filtro **dinâmico** (ao vivo, diferente de D-04 da Phase 8) e uma lista dos contratos filtrados abaixo dos cards. O botão "Gerar relatório" deve virar geração de PDF do filtro aplicado — detalhes do PDF a definir depois. Ainda não adicionada ao ROADMAP.md; entra depois que a Phase 9 for discutida e planejada (ordem confirmada pelo usuário).
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
- 2026-08-20: **Plano 08-01 concluído** (worktree isolado, `agent-a21e4bc9c4e5a64a0`). Relatório financeiro de 4 categorias (pagas/a vencer/vencidas/conciliadas) em /relatorios, calcularRelatorioFinanceiro reusa situacaoDaParcela/somarLancamentos verbatim (D-06/D-07). Nova query parcelas deliberadamente sem filtro de arquivado/ativo (D-05) — contrato arquivado/inativo entra nos totais. Painel de filtro suspenso (imóvel/proprietário/período/situação) disparado só por Gerar relatório (D-04/FINREL-05). reports-view.tsx preservado byte a byte (git diff confirma zero linhas de conteúdo pré-existente removidas), FilterChip/toggle exportados na Task 2 (exatamente 2 linhas alteradas). npm run lint/build verdes. Commits: 0c186eb (Task 1), b93d7c6 (Task 2). Última fase do Módulo Financeiro v2.0 — falta só verificação humana em produção (browser + SQL Editor).

### Pending Todos

- Definir se a documentação do módulo financeiro vive em `docs/data-model.md` (como FINDOC-01 pede) e/ou também vira nota no vault Obsidian — decidir na Phase 4, não bloqueia

### Blockers/Concerns

- **ROBUST-02 não verificado com login real.** O código está escrito, lintado e buildado, e segue o mesmo padrão de outras queries já funcionando no mesmo Server Component — mas o navegador embutido usado para verificação ficou instável (mesmo problema já visto durante o diagnóstico do Turnstile) e não foi possível confirmar visualmente que a tela de "acesso pendente" aparece corretamente para um usuário fora da allowlist. **Ação sugerida:** o usuário confirma manualmente, ou testa com uma conta de teste removida da allowlist. **Relevante para a v2.0:** a Phase 4 precisa provar que o RLS das tabelas novas barra quem está fora da allowlist — é uma boa oportunidade para fechar esta verificação junto.
- **`.planning/codebase/CONCERNS.md` tem taxa de acerto baixa.** 3 de 3 achados de segurança verificados até agora eram falsos positivos. Tratar o restante como hipótese, não fato.
- **SEC-02 depende do usuário.** Leaked Password Protection é toggle no painel do Supabase; usuário optou por adiar. Fora do escopo de fases da v2.0.
- **Sem suíte automatizada.** Toda verificação da v2.0 é lint + build + teste manual no navegador (e SQL Editor do Supabase na Phase 4). Os critérios de sucesso do roadmap foram escritos para serem conferíveis à mão por causa disso.
- **Produção com dados reais.** ~46 imóveis em uso; a migração da Phase 4 precisa ser aditiva e retrocompatível — nada de coluna apagada, nada de `ativo` nulo.
- **Correção da aba desatualizada (`buscarParcelasRelatorioAction`) sem confirmação funcional em produção.** Typecheck limpo, mas não testado no navegador — não consegui logar (credenciais reais, não devo digitar senha). Ação sugerida: usuário testa o cenário de duas abas descrito na conversa.
- **27 parcelas órfãs já existem em produção (2 contratos de teste, "A" e "outro").** Levantadas por SQL antes da Phase 9 ser desenhada. A Phase 9 precisa decidir se a limpeza pontual desses casos existentes faz parte do mesmo plano de execução ou é um passo separado.

### Roadmap Evolution

- Phase 06.1 inserted after Phase 6: Consulta financeira e geração por período — feedback do usuário após testar Phase 6 em produção (URGENT)
- Phase 06.2 inserted after Phase 6.1: Feedback do usuario apos usar Phases 6/6.1 em producao: ativo nao escondia parcelas futuras, mudanca de datas do card nao refletia no Financeiro, e excluir card apagava historico financeiro em cascata sem trava (URGENT)
- Phase 9 added: Integridade de datas do contrato nas parcelas — feedback do usuário testando a Phase 8 em produção; encontrou parcelas órfãs quando a data de um contrato encolhe. Reverte deliberadamente D-03 (docs/data-model.md)

## Deferred Items

Itens reconhecidos e adiados (ver REQUIREMENTS.md):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| TEST | Suite de testes automatizados (validação, RLS+Server Actions, E2E) | Deferred | Init |
| REFACTOR | Extrair hooks do componente Board; centralizar utilidades de data | Deferred | Init |
| SEC | Leaked Password Protection | Deferred por escolha do usuário | 2026-08-14 |
| FIN | Forma de pagamento na baixa; exportação PDF/planilha; backfill histórico | Deferred (pós-v2.0) | 2026-08-16 |

## Session Continuity

Last session: 2026-08-20T18:15:26.649Z
Stopped at: Phase 9 UI-SPEC approved
Resume file: .planning/phases/09-integridade-de-datas-do-contrato-nas-parcelas/09-UI-SPEC.md
