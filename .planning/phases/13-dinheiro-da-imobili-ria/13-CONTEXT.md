# Phase 13: Dinheiro da imobiliária - Context

**Gathered:** 2026-08-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Hoje `parcela_lancamentos` só representa dinheiro do aluguel indo do inquilino para o **proprietário** (pagamento, acréscimo, desconto, destrava). Esta fase adiciona o conceito de dinheiro que a **própria imobiliária** recebe — taxa de administração, comissão do primeiro aluguel, e caução — de forma inteiramente **aditiva**: nenhuma tela existente muda, nenhum cálculo de status/valor da parcela é afetado. O objetivo final do usuário é **prestação de contas**: um relatório que ele confere contra o extrato bancário da imobiliária.

In scope:
- Percentual de administração e percentual de primeiro aluguel configuráveis por contrato (defaults 10%/50%, com exceção por cliente), numa tela de configuração financeira separada do modal de edição do card
- No diálogo "Registrar pagamento" (já existente), um campo novo de taxa da imobiliária: pré-calculado pelo percentual do contrato (50% se for a parcela de competência mais antiga daquele contrato — comissão do primeiro aluguel — senão o percentual normal de administração), mas totalmente editável para qualquer valor, cobrindo exceções e imprevistos
- O valor da taxa é registrado como um evento separado, estruturalmente isolado de `parcela_lancamentos` — nunca soma no `valorDevido`/`valorPago`/`status` da parcela (D-04)
- Caução: ciclo completo — recebido, devolvido, usado — como ação à parte ligada ao contrato (não parte da criação do card), mesmo espírito de histórico append-only do resto do sistema
- Um relatório/área nova mostrando o total recebido pela imobiliária (taxas de administração + comissão de primeiro aluguel + movimento de caução) num período, para conferência contra o extrato bancário — este é o entregável central da fase

Explicitamente fora de escopo:
- Taxas de gestão como funcionalidade dedicada — o usuário vai continuar usando "Ajustar" (acréscimo existente) com uma observação descrevendo a taxa, quando acontecer (pouco frequente)
- Lançamentos de taxa retroativos para pagamentos já registrados — as baixas de teste existentes serão canceladas pelo usuário antes de usar de verdade; a funcionalidade cobre todas as parcelas do sistema, mas o cálculo da taxa só passa a valer a partir do momento em que cada baixa acontecer depois desta fase existir
- Qualquer mudança em telas existentes (Financeiro, Relatórios, Relatório Financeiro dedicado da Phase 10) — continuam mostrando o valor bruto do aluguel, exatamente como hoje
- Refinamento mais profundo do relatório desta fase — o usuário avisou explicitamente que depois desta entrega inicial vai querer ajustar/refazer partes do relatório para "se comunicar com o sistema todo" (ver `<deferred>`)

Requirements: **IMOB-01, IMOB-02, IMOB-03, IMOB-04, IMOB-05** (trabalho pós-milestone, mesmo grupo de INTEG/RELDED/CANPAG/CANAJU — nenhum requisito de v2.0 cobre esta fase)
</domain>

<decisions>
## Implementation Decisions

### Regra de cálculo — decisão explícita do usuário
- **D-01 (usuário, explícito):** No primeiro mês de um contrato, o percentual de primeiro aluguel (50%, com exceções) **substitui** o percentual normal de administração (10%) — não somam. A imobiliária fica com 50% naquele mês, não 60%. A partir do segundo mês, volta a valer o percentual normal de administração.
- **D-08 (inferência de Claude, a confirmar no plano):** "Primeira parcela" de um contrato = a parcela com a menor `competencia` para aquele `card_id` — não necessariamente a primeira que o usuário efetivamente paga (consistente com a geração retroativa da Phase 6.1/PARCELA-06, onde parcelas passadas podem ser geradas depois).

### Configuração dos percentuais — decisão explícita do usuário
- **D-02 (usuário, explícito):** Percentual de administração e percentual de primeiro aluguel são configuráveis por contrato (defaults 10%/50%, editáveis por exceção), numa **tela de configuração financeira separada** — não dentro do modal de editar o card (junto com proprietário/valor/período).

### Geração da taxa — decisão explícita do usuário
- **D-03 (usuário, explícito):** A taxa da imobiliária é gerada **automaticamente no momento da baixa** — o mesmo diálogo "Registrar pagamento" (`registrar-pagamento-dialog.tsx`) ganha um campo novo, pré-preenchido com o valor sugerido (percentual do contrato × valor pago, usando a regra de primeiro aluguel quando aplicável), mas **totalmente editável para qualquer valor** — não fica travado a ser um percentual, cobre exceções e imprevistos que a imobiliária pode ter.

### Aditivo, nunca mexe no que já existe — decisão explícita do usuário
- **D-04 (usuário, explícito):** Nenhuma tela existente (Financeiro, Relatórios, Relatório Financeiro dedicado) muda — continuam mostrando o valor bruto que o inquilino pagou, exatamente como hoje. **Consequência estrutural travada aqui:** a taxa da imobiliária **não pode** ser um `tipo` novo dentro de `parcela_lancamentos`, porque isso entraria automaticamente no `somarLancamentos`/`recalcularEGravarStatus` que já calculam `valorDevido`/`valorPago`/`status` da parcela em todo o sistema. Precisa de um registro estruturalmente separado (nova tabela ou lançamento paralelo) que o cálculo de status da parcela nunca soma. **Reversibility:** costly — misturar os dois modelos de dado depois seria difícil de desfazer sem uma migração de dado; manter separado desde o início evita esse risco.

### Sem retroativo — decisão explícita do usuário
- **D-05 (usuário, explícito):** As parcelas já marcadas como pagas em produção são **todas de teste** — o usuário vai cancelá-las (usando o Cancelamento de pagamento da Phase 11) antes de começar a usar de verdade. A funcionalidade deve cobrir **todas** as parcelas do sistema (não só contratos criados depois desta fase), mas nenhum lançamento de taxa é gerado retroativamente para pagamentos já feitos — só passa a calcular a partir do momento em que uma baixa acontecer depois da fase existir.

### Caução — decisão explícita do usuário
- **D-06 (usuário, explícito):** Caução tem ciclo completo — recebido, devolvido, usado — registrado como uma **ação à parte ligada ao contrato**, não como parte da criação/edição do card (o dinheiro pode chegar antes, junto ou depois do contrato começar). Mesmo espírito de histórico append-only do resto do sistema — cada evento (recebido/devolvido/usado) é um registro novo, nunca uma edição.

### Taxas de gestão — decisão explícita do usuário
- **D-07 (usuário, explícito):** Taxas de gestão ficam fora do escopo desta fase — acontecem pouco e o usuário vai continuar lançando como "Ajustar" (acréscimo existente na parcela), com uma observação descrevendo o que foi.

### Claude's Discretion
- **Nome das novas tabelas/entidades** (taxa da imobiliária, caução) — fica para research/pattern-mapper/planner, seguindo o estilo já usado (`snake_case`, RLS via `is_team_member()`, CHECK constraints espelhando validação server-side).
- **Layout exato da tela de "Configuração financeira"** — lista de todos os contratos com percentuais editáveis inline, ou outro formato — fica para a UI-SPEC.
- **Formato exato do relatório de reconciliação** — layout, se reusa algum padrão visual já existente (ex.: cards + lista do Relatório Financeiro da Phase 10) ou é uma tela nova — fica para a UI-SPEC, mas precisa cobrir taxa de administração + comissão de primeiro aluguel + movimento de caução, filtrável por período.
- **Onde a ação de Caução aparece na tela** (no card do Board, na linha do Financeiro, ou em ambos) — fica para a UI-SPEC.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Padrão a reusar (não reimplementar)
- `web/src/lib/kanban/parcelas.ts` — `somarLancamentos` (linha ~395) e `statusDeParcela` — a régua exata de `valorDevido`/`valorPago`/status; **a taxa da imobiliária NUNCA pode entrar aqui** (D-04), este é o contrato a proteger
- `web/src/lib/kanban/actions.ts` — `registrarPagamentoAction` (o ponto de extensão para o campo novo de taxa), `recalcularEGravarStatus` (nunca deve ser chamado com base em taxa da imobiliária), `exigirParcelaNaoConciliada`/`exigirParcelaVisivel` (travas a reusar se a taxa também precisar delas)
- `web/src/components/financeiro/registrar-pagamento-dialog.tsx` — o diálogo a estender com o campo novo de taxa; hoje só recebe `parcelaId` (não `cardId`) — a Server Action precisa resolver o contrato via `parcela.card_id` para achar o percentual configurado
- `supabase/migrations/20260816000000_financeiro_schema.sql` — o padrão de CHECK constraints + RLS via `is_team_member()` a replicar em qualquer tabela nova
- `docs/data-model.md` § livro-razão append-only — o princípio a seguir para o novo histórico de caução

### Precedente documentado a citar
- `.planning/phases/10-relat-rio-financeiro-dedicado/10-CONTEXT.md` § Deferred — onde esta ideia foi registrada pela primeira vez, com a citação original do usuário
- `.planning/phases/11-cancelamento-de-pagamento/11-CONTEXT.md` § Deferred — segunda menção, ainda não retomada
- `.planning/financeiro-modulo-prompt.md` — spec original da v2.0 (não cobre esta fase, mas define os princípios gerais: segurança/RLS, flexibilidade via lançamento em vez de UPDATE destrutivo, facilidade de uso para usuário leigo)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `cards` (schema atual): `proprietario`, `valor`, `periodo_inicio`/`periodo_fim`, `numero`, `ativo`, `arquivado_em` — os dois percentuais novos (administração, primeiro aluguel) seriam colunas novas nesta mesma tabela ou numa tabela de configuração relacionada 1:1 com `cards`.
- `parcelas.competencia` — já existe e já é indexado por `card_id`; a regra de "primeira parcela" (D-08) é uma query simples (`min(competencia) where card_id = ...`).
- `erroDoBanco()`/`semLinhas()` — sanitização de erro já estabelecida, reusar para qualquer Server Action nova.

### Established Patterns
- Toda escrita financeira passa por Server Action com `requireUser()` + validação server-side, nunca `service_role`.
- Livro-razão append-only: eventos novos em vez de `UPDATE` destrutivo — mesmo princípio para o histórico de caução.
- RLS via `is_team_member()` em qualquer tabela nova — mesma allowlist do resto do sistema, sem novo nível de permissão.

### Integration Points
- `registrar-pagamento-dialog.tsx`/`registrarPagamentoAction` — ponto de integração principal para a geração automática da taxa (D-03).
- Uma tela nova (ainda sem nome definido) para a "Configuração financeira" dos percentuais por contrato (D-02).
- Uma ação nova ligada ao contrato para o ciclo de caução (D-06) — local exato na UI é discrição de Claude/UI-SPEC.
- Um relatório/área nova para a reconciliação (entregável central da fase).

</code_context>

<specifics>
## Specific Ideas

Frases-guia do usuário:

> "A taxa de administração cobramos 10% do valor do aluguel, mas existe exceções onde alguns clientes cobramos menos ou mais, na maioria dos casos é 10% de administração e 50% do primeiro aluguel, mas existe exceções."

> "Também recebemos e cuidamos do caução, seria interessando acompanhar o ciclo completo, recebido, devolvido, dinheiro usado."

> "Taxas de gestão acontecem, porém não com muita frequência, acho que não precisa adicionar uma nova funcionalidade só para isso, quando tiver essas taxas eu posso colocar como acréscimo na parcela e descrever oque foi."

> "O mais importante é controlar oque estamos recebendo, através do nosso sistema eu vou prestar contas, conferir se bate com o saldo/extrato do nosso banco, então deve mudar/acrescentar no que já existe."

> "[taxa editável] deve ser possível editar o valor, por padrão pode vir 10% de administração e 50% do primeiro aluguel, mas deve ser possível alterar esses percentuais ou colocar como um outro valor sem ser porcentagem, porque existem exceções e imprevistos que podem acontecer, então o sistema precisa estar adaptado a imprevistos e exceções."

> "As parcelas que estão baixadas são todas somente de testes, vou cancelar todas aquelas baixas. Mas eu quero que essa nova funcionalidade cubra todo o sistema, todas as parcelas já criadas, mas vou começar a baixar somente depois dessa funcionalidade."

</specifics>

<deferred>
## Deferred Ideas

- **Refinamento do relatório de reconciliação.** O usuário avisou explicitamente, ao fechar esta discussão: "depois vamos precisar melhorar/refazer algumas coisas do relatório, porque ele precisa de mais ajustes e se comunicar com o sistema todo." Não especificado ainda — sinal de que o relatório entregue nesta fase é uma primeira versão funcional, não a versão final. Não bloqueia esta fase; retomar quando o usuário trouxer os ajustes específicos.

### Reviewed Todos (not folded)
None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-Dinheiro da imobiliária*
*Context gathered: 2026-08-22*
