# Requirements: Kanban Aluguel

**Milestone atual:** v2.0 Módulo Financeiro
**Defined:** 2026-08-16
**Core Value:** Dar visibilidade e controle sobre a situação de cada contrato de aluguel — quem está em dia, quem está vencendo, quem precisa de contato — sem depender de planilha.

**Spec de origem:** `.planning/financeiro-modulo-prompt.md` — decisões de produto já fechadas com o usuário. Os requisitos abaixo derivam dela; não re-perguntar o que já está decidido lá.

## v2.0 Requirements

### CONTRATO — controle de contrato ativo/inativo

- [x] **CONTRATO-01**: Usuário pode marcar um contrato como ativo ou inativo direto no card do board, sem precisar abrir o modal de edição
- [x] **CONTRATO-02**: Contrato marcado como inativo para de gerar novas parcelas, mas suas parcelas já existentes continuam visíveis e gerenciáveis até serem resolvidas
- [x] **CONTRATO-03**: Cada contrato tem um identificador sequencial numérico (#1, #2, #3…), atribuído automaticamente, exibido no card do Board e na consulta do Financeiro

### PARCELA — geração automática

- [x] **PARCELA-01**: Ao abrir a aba Financeiro, o sistema cria automaticamente as parcelas faltantes do mês atual e do próximo mês para cada contrato ativo (regra padrão — contratos com período completo seguem PARCELA-06)
- [x] **PARCELA-02**: Abrir a aba Financeiro repetidamente não duplica parcelas — a geração é idempotente
- [x] **PARCELA-03**: A parcela guarda o valor do aluguel vigente no momento em que foi gerada, de modo que um reajuste futuro não altera parcelas já criadas
- [x] **PARCELA-04**: O sistema não gera parcela para competência fora do período do contrato (antes do início ou depois do fim)
- [x] **PARCELA-05**: O dia de vencimento de uma parcela é o dia do mês de `periodo_inicio` do contrato; contratos sem `periodo_inicio` usam o dia 20 como padrão
- [x] **PARCELA-06**: Quando o contrato tem `periodo_inicio` **e** `periodo_fim` preenchidos, a geração cria parcelas para todos os meses do período inteiro, incluindo meses já passados em relação a hoje (geração retroativa). Contratos com apenas uma das duas datas, ou nenhuma, continuam restritos a mês atual + próximo (PARCELA-01)

### BAIXA — registro de pagamentos e ajustes

- [x] **BAIXA-01**: Usuário pode dar baixa total em uma parcela, informando a data do pagamento
- [x] **BAIXA-02**: Usuário pode dar baixa parcial, e a parcela fica marcada como parcialmente paga até que o valor devido seja completado
- [x] **BAIXA-03**: Usuário pode lançar um acréscimo sobre uma parcela (ex.: multa por atraso), alterando o valor devido
- [x] **BAIXA-04**: Usuário pode lançar um desconto sobre uma parcela, alterando o valor devido
- [x] **BAIXA-05**: Todo lançamento registra quem fez, quando e uma observação opcional, e nenhum lançamento anterior é sobrescrito ou apagado

### CONCIL — conciliação e correção

- [x] **CONCIL-01**: Usuário pode conciliar (travar) uma parcela já paga, protegendo-a contra alteração acidental
- [x] **CONCIL-02**: Tentar alterar uma parcela conciliada é bloqueado, com mensagem em linguagem simples explicando que é preciso destravar antes
- [x] **CONCIL-03**: Usuário pode destravar uma parcela conciliada informando um motivo, que é obrigatório
- [x] **CONCIL-04**: O histórico de destravas de uma parcela fica visível na própria parcela — quem destravou, quando e por quê

### FINUI — aba Financeiro

- [x] **FINUI-01**: Existe uma aba "Financeiro" na navegação, separada do board e dos relatórios de contrato
- [x] ~~**FINUI-02**: A aba Financeiro apresenta as parcelas do mês atual e do próximo mês em visões separadas~~ — **substituído por CONSULTA-02**: o seletor Mês atual/Próximo mês foi removido em favor de uma visão padrão "vencendo hoje" + filtro de período. Decisão do usuário após ver a aba em produção (sketch 001, 2026-08-18). Mantido aqui riscado, não apagado, porque foi de fato entregue e usado na Phase 5 antes da mudança
- [x] **FINUI-03**: Cada parcela na lista mostra sua situação (a vencer, vencida, paga, parcial, conciliada), o valor devido e o valor já pago
- [x] **FINUI-04**: Dar baixa em uma parcela leva no máximo dois cliques a partir da lista, sem etapa burocrática intermediária

### CONSULTA — busca e filtros na aba Financeiro

- [x] **CONSULTA-01**: Usuário pode filtrar as parcelas da aba Financeiro por proprietário, inquilino, período e ID do contrato; cada filtro é opcional e só é aplicado se preenchido, combinando entre si
- [x] **CONSULTA-02**: Sem nenhum filtro aplicado, a aba Financeiro mostra por padrão as parcelas vencendo no dia de hoje

### VIDA — ciclo de vida do contrato

- [x] **VIDA-01**: A visibilidade de uma parcela é derivada na leitura por uma regra única: ela aparece se tiver ao menos um lançamento, **ou** se a competência estiver dentro do período atual do card **e** (o contrato estiver ativo **ou** a competência for ≤ o mês atual)
- [x] **VIDA-02**: Contrato inativo não exibe parcelas de meses futuros; a do mês atual e as de meses passados (inclusive vencidas em aberto) continuam visíveis e operáveis. Reativar restaura a visibilidade sem regenerar nada
- [x] **VIDA-03**: Alterar `periodo_inicio`/`periodo_fim` de um card reflete no Financeiro na carga seguinte — parcelas que saíram do período deixam de aparecer, exceto as que já têm lançamento
- [x] **VIDA-04**: Toda escrita sobre uma parcela não-visível pela regra de VIDA-01 é recusada no servidor, com mensagem em português comum — a ocultação na tela é consequência da regra, não a trava
- [x] **VIDA-05**: Usuário pode arquivar um contrato (com confirmação que avisa sobre parcelas em aberto); arquivado, ele some de Board, Financeiro, Relatórios e alertas sem nada ser apagado. Uma aba "Arquivados" lista os arquivados e permite desarquivar, devolvendo o contrato ao funcionamento normal
- [x] **VIDA-06**: Excluir um contrato exige confirmação digitada (`excluir <id do contrato>`) e é bloqueado no servidor se existir qualquer lançamento financeiro ligado a ele; nesse caso o sistema oferece arquivar no lugar

### FINREL — relatórios financeiros

- [x] **FINREL-01**: Usuário pode ver um relatório das parcelas pagas
- [x] **FINREL-02**: Usuário pode ver um relatório das parcelas a vencer
- [x] **FINREL-03**: Usuário pode ver um relatório das parcelas vencidas
- [x] **FINREL-04**: Usuário pode ver um relatório das parcelas conciliadas
- [x] **FINREL-05**: Usuário pode combinar filtros por imóvel, proprietário e período nos relatórios financeiros, sem que um filtro resete os outros

### FINSEG — segurança do módulo financeiro

- [ ] **FINSEG-01**: Parcelas e lançamentos só são legíveis e graváveis por quem está na allowlist — RLS via `is_team_member()`, a mesma função já usada em `cards` e `alerts`
- [ ] **FINSEG-02**: As regras financeiras (valor não-negativo, status válido, motivo obrigatório na destrava) são garantidas por constraints no banco, não apenas pela validação do formulário
- [x] **FINSEG-03**: Uma operação financeira rejeitada pelo banco não expõe a mensagem crua do Postgres ao usuário — passa por `erroDoBanco()`, como o resto do app

### FINDOC — documentação do módulo

- [ ] **FINDOC-01**: `docs/data-model.md` documenta as novas entidades (diagrama incluso) e o porquê de cada decisão não-óbvia: livro-razão append-only, geração preguiçosa sem cron, flag `ativo` manual em vez de derivada da data

### INTEG — integridade de datas do contrato nas parcelas (pós-milestone, Phase 9)

Fora do conjunto de 39 requisitos da v2.0 — trabalho aberto por um bug real encontrado na verificação final da Phase 8 (parcelas órfãs vazando nos relatórios quando o período de um contrato encolhe). Reverte deliberadamente D-03 (`docs/data-model.md`), decisão do usuário registrada em `.planning/phases/09-integridade-de-datas-do-contrato-nas-parcelas/09-CONTEXT.md`.

- [x] **INTEG-01**: Editar `periodo_inicio`/`periodo_fim` de um contrato que já tem parcelas geradas apaga de verdade as parcelas que ficaram fora do novo período, desde que não tenham nenhum pagamento nem lançamento (`status='aberta'` E zero `parcela_lancamentos`) — as demais nunca são tocadas. A regra vale nos dois sentidos: encurtar o fim ou adiantar o início do período podam pelo mesmo critério. **Correção pós-verificação (D-09):** remover `periodo_fim` inteiramente (deixando só `periodo_inicio`, ou nenhuma das duas) também poda — usa o mesmo teto que a geração já usa para esse estado (atual+próximo, ou só atual), em vez de virar "sem teto"
- [x] **INTEG-02**: A poda roda de forma síncrona, dentro da mesma Server Action que grava o período do contrato, e só quando `periodo_inicio` e/ou `periodo_fim` realmente mudam de valor nessa gravação — nunca em todo salvamento de card
- [x] **INTEG-03**: Antes de salvar uma edição que vai apagar uma ou mais parcelas órfãs, o usuário vê quantas serão apagadas e precisa confirmar explicitamente antes do salvamento seguir; uma edição que não apaga nenhuma parcela salva sem fricção nova
- [x] **INTEG-04**: Um contrato sem nenhuma das duas datas (`periodo_inicio` E `periodo_fim` nulos) passa a gerar só a parcela do mês atual, não mais atual+próximo; um contrato com só `periodo_inicio` preenchido continua gerando atual+próximo, sem mudança. A mudança vale só para geração futura — nunca apaga retroativamente uma parcela de "próximo mês" já gerada antes desta fase
- [x] **INTEG-05**: As parcelas órfãs já existentes em produção antes desta fase são removidas por um script SQL revisável pelo operador (não uma migração), que mostra a lista exata antes de qualquer exclusão

### RELDED — Relatório Financeiro dedicado (pós-milestone, Phase 10)

Fora do conjunto de 39 requisitos da v2.0 — capacidade nova pedida pelo usuário na mesma conversa que abriu a Phase 9. Decisões registradas em `.planning/phases/10-relat-rio-financeiro-dedicado/10-CONTEXT.md`.

- [x] **RELDED-01**: Existe uma rota nova `/relatorios/financeiro`, alcançada por um botão "Relatório financeiro" dentro da `/relatorios` atual (mesma aba). A página atual (painel suspenso + cards da Phase 8) continua existindo sem mudança
- [x] **RELDED-02**: O painel de filtro (imóvel/proprietário/período/situação) é dinâmico — qualquer mudança recalcula os 4 cards e a lista imediatamente, sem precisar clicar em nada
- [x] **RELDED-03**: Abaixo dos cards, uma lista mostra uma linha por parcela filtrada (endereço, proprietário, competência, vencimento, situação, valor), sempre em sincronia com o filtro atual
- [x] **RELDED-04**: O botão "Gerar relatório" da Phase 8 vira "Exportar PDF" nesta página — não dispara mais a consulta (que já é ao vivo), só gera o PDF do estado atual da tela
- [x] **RELDED-05**: O PDF exportado contém os 4 totais, a lista completa de parcelas filtradas, e um cabeçalho com os filtros aplicados e a data de geração

### CANPAG — Cancelamento de pagamento (pós-milestone, Phase 11)

Fora do conjunto de 39 requisitos da v2.0 — capacidade nova pedida pelo usuário. Reverte deliberadamente o princípio append-only do livro-razão (`docs/data-model.md`) para lançamentos `tipo='pagamento'` — decisão registrada em `.planning/phases/11-cancelamento-de-pagamento/11-CONTEXT.md`.

- [x] **CANPAG-01**: Existe um botão "Cancelar" ao lado de cada lançamento `tipo='pagamento'` no histórico de lançamentos da parcela (`ParcelaHistoricoSheet`)
- [x] **CANPAG-02**: Clicar "Cancelar" abre uma confirmação simples (sem motivo obrigatório) mostrando o valor do pagamento; confirmar apaga de verdade aquele lançamento do banco
- [x] **CANPAG-03**: Depois de apagar, o status da parcela é recalculado a partir do que resta no livro-razão (nunca hardcoded para "aberta") — pode voltar para "aberta" ou "parcial" dependendo do que sobrar
- [x] **CANPAG-04**: Uma parcela conciliada nunca aceita cancelamento de lançamento nenhum — mesma trava já usada por Pagamento/Ajustar, aplicada no servidor

### CANAJU — Cancelamento de ajustes (pós-milestone, Phase 12)

Fora do conjunto de 39 requisitos da v2.0 — extensão pedida pelo usuário logo após a Phase 11 fechar: mesmo mecanismo de cancelamento, agora para lançamentos `tipo='acrescimo'` e `tipo='desconto'`. Decisões registradas em `.planning/phases/12-cancelamento-de-ajustes/12-CONTEXT.md`. `tipo='destrava'` fica deliberadamente fora (D-01 daquele documento).

- [x] **CANAJU-01**: Existe um botão "Cancelar" ao lado de cada lançamento `tipo='acrescimo'` ou `tipo='desconto'` no histórico de lançamentos da parcela (`ParcelaHistoricoSheet`) — mesmo padrão já usado para `tipo='pagamento'` (Phase 11) — confirmado em produção
- [x] **CANAJU-02**: Clicar "Cancelar" abre uma confirmação simples (sem motivo obrigatório) mostrando o valor e o tipo do ajuste; confirmar apaga de verdade aquele lançamento do banco — confirmado em produção
- [x] **CANAJU-03**: Depois de apagar, o status da parcela é recalculado a partir do que resta no livro-razão (nunca hardcoded) — confirmado em produção
- [x] **CANAJU-04**: Uma parcela conciliada nunca aceita cancelamento de ajuste nenhum — mesma trava já usada por Pagamento/Ajustar/Cancelar pagamento, aplicada no servidor — confirmado em produção

### IMOB — Dinheiro da imobiliária (pós-milestone, Phase 13)

Fora do conjunto de 39 requisitos da v2.0 — capacidade nova pedida pelo usuário, adiada desde a Phase 10 e retomada depois da Phase 12 fechar. Decisões registradas em `.planning/phases/13-dinheiro-da-imobili-ria/13-CONTEXT.md`. Estritamente aditiva: nenhum requisito abaixo altera o comportamento de FINUI/CONSULTA/FINREL/RELDED já existentes.

- [x] **IMOB-01**: Cada contrato tem um percentual de administração e um percentual de comissão de primeiro aluguel configuráveis, com defaults 10%/50%, numa tela de configuração financeira separada do modal de edição do card — confirmado em produção
- [x] **IMOB-02**: Ao registrar um pagamento, o diálogo mostra e permite editar um valor de taxa da imobiliária, pré-calculado pelo percentual do contrato (usando o percentual de primeiro aluguel quando a parcela é a de competência mais antiga do contrato, senão o percentual de administração normal) — editável para qualquer valor, não travado a ser derivado do percentual — confirmado em produção
- [x] **IMOB-03**: O valor da taxa registrado nunca afeta o cálculo de `valorDevido`/`valorPago`/status da parcela — nenhuma tela existente (Financeiro, Relatórios, Relatório Financeiro dedicado) muda de comportamento — confirmado em produção
- [x] **IMOB-04**: Existe uma forma de registrar o recebimento da caução de um contrato, e depois devolvê-la ou registrar seu uso, como ações separadas ligadas ao contrato, com histórico de cada evento (nunca uma edição) — confirmado em produção
- [x] **IMOB-05**: Existe um relatório/área mostrando o total recebido pela imobiliária (taxas de administração + comissão de primeiro aluguel + movimento de caução) num período, para conferência contra o extrato bancário — confirmado em produção

### CANIMOB — Cancelamento de taxas e caução (pós-milestone, Phase 14)

Fora do conjunto de 39 requisitos da v2.0 — capacidade nova pedida pelo usuário logo após a Phase 13
fechar. Reabre pontualmente D-04 (isolamento estrutural taxa/parcela) e D-06 (caução append-only) da
Phase 13, sem desfazer o isolamento em si. Decisões registradas em
`.planning/phases/14-cancelamento-de-taxas-e-cau-o/14-CONTEXT.md`.

- [x] **CANIMOB-01**: A taxa da imobiliária aparece no histórico de lançamentos da parcela (`ParcelaHistoricoSheet`), na mesma lista cronológica que pagamento/acréscimo/desconto, com um rótulo indicando a origem (Administração / Comissão 1º aluguel) — confirmado em produção
- [x] **CANIMOB-02**: Cada taxa no histórico tem seu próprio botão "Cancelar" (mesmo diálogo de confirmação simples já usado para pagamento/acréscimo/desconto), bloqueado quando a parcela está conciliada (mesma trava de CONCIL-02) — confirmado em produção
- [x] **CANIMOB-03**: Cancelar um lançamento `tipo="pagamento"` (CANPAG) cancela automaticamente a taxa vinculada àquele pagamento específico, em vez de deixá-la órfã — confirmado em produção, ponta a ponta via SQL
- [x] **CANIMOB-04**: No histórico de caução, existe um botão "Cancelar" apenas no evento mais recente; cancelar o mais recente libera o cancelamento do evento que ficou no topo, permitindo desfazer o ciclo inteiro sequencialmente — nunca um cancelamento de evento do meio da linha do tempo — confirmado em produção
- [x] **CANIMOB-05**: O diálogo de confirmação de cancelamento de taxa/caução segue o mesmo padrão já existente (sem motivo obrigatório, DELETE real, aviso de que não pode ser desfeito) — confirmado em produção

### CANDEST — Cancelamento/exclusão com destrava (pós-milestone, Phase 15)

Fora do conjunto de 39 requisitos da v2.0 — capacidade nova pedida pelo usuário logo após a Phase 14
fechar. Reabre pontualmente D-14 (06.2-CONTEXT.md, "qualquer lançamento trava a exclusão do card") e
D-01 (12-CONTEXT.md, "destrava fica fora do cancelamento") só para este caso específico. Decisões
registradas em `.planning/phases/15-exclus-o-de-card-com-destrava-e-pagina-o/15-CONTEXT.md`.

- [x] **CANDEST-01**: Um card com histórico de destrava, mas sem nenhuma parcela conciliada, pode ser excluído de verdade — nem o pré-voo do app (`cardTemLancamento`) nem o trigger de banco (`impedir_exclusao_de_card_com_lancamento`) bloqueiam mais por causa só de `tipo='destrava'` — confirmado em produção
- [x] **CANDEST-02**: Um lançamento `tipo='destrava'` ganha o mesmo botão "Cancelar" já usado para pagamento/acréscimo/desconto/taxa/caução, usando o mesmo `CancelarLancamentoDialog` — cancelar não reabre a conciliação nem altera o status da parcela, só remove o registro de auditoria — confirmado em produção
- [x] **CANDEST-03**: Uma parcela conciliada continua bloqueando tanto a exclusão do card quanto o cancelamento de qualquer lançamento seu (incluindo destrava) — mesma trava já existente (`exigirParcelaNaoConciliada`) — confirmado em produção

### PAGIN — Paginação de listagens (pós-milestone, Phase 15)

Fora do conjunto de 39 requisitos da v2.0 — capacidade nova pedida pelo usuário na mesma conversa que
CANDEST. Estritamente aditiva na camada de apresentação — nenhuma mudança de query/Server Action.
Decisões registradas em `.planning/phases/15-exclus-o-de-card-com-destrava-e-pagina-o/15-CONTEXT.md`.

- [x] **PAGIN-01**: As seis listagens fora do Board (Financeiro, Relatórios → Situação dos contratos, Relatório Financeiro dedicado, Relatório da imobiliária, Configuração financeira, Arquivados) mostram no máximo 12 itens por página (corrigido de 10 — ver ROADMAP.md § Phase 15, Correção pós-verificação) — confirmado em produção
- [x] **PAGIN-02**: A navegação entre páginas é numerada (janela de até 5 números por vez + setas anterior/próxima), não apenas Anterior/Próxima; quando há mais páginas do que a janela mostra, um botão desliza a janela sem trocar de página e um campo "Ir para" pula direto a qualquer página — confirmado em produção
- [x] **PAGIN-03**: Mudar um filtro em qualquer uma das seis telas volta a listagem para a página 1 — mas uma ação que não muda o filtro (cancelar/conciliar/desarquivar um item) nunca reseta a página do usuário — confirmado por leitura de código (`resetKey` por tela) em todas as seis; teste interativo de mutação-sem-reset feito diretamente só nas telas com filtro

### REORD — Reordenação em massa no Board (pós-milestone, Phase 16)

Fora do conjunto de 39 requisitos da v2.0 — capacidade nova pedida pelo usuário logo após a Phase 15
fechar. Estritamente aditiva: não altera o drag-and-drop individual já existente (`moveCardAction`),
só acrescenta um caminho novo de movimentação em lote. Decisões registradas em
`.planning/phases/16-reordena-o-em-massa-e-arquivamento-sem-coluna/16-CONTEXT.md`.

- [ ] **REORD-01**: Existe um botão "Reordenar" ao lado do campo de busca no Board, que abre um popup listando as colunas existentes
- [ ] **REORD-02**: Escolher uma coluna e confirmar move, numa única ação, todos os cards elegíveis — só os em destaque na busca, se houver busca ativa; todos os cards do board, se não houver — para a coluna escolhida
- [ ] **REORD-03**: Depois do movimento em massa, a ordem dos cards na coluna de destino segue a ordem visual anterior (coluna → posição), com posições novas sequenciais

### ARQCOL — Arquivamento sem vínculo de coluna (pós-milestone, Phase 16)

Fora do conjunto de 39 requisitos da v2.0 — capacidade nova pedida pelo usuário na mesma conversa que
REORD. Reabre pontualmente D-12 (06.2-CONTEXT.md, "desarquivar devolve ao funcionamento normal") para
incluir `column_id` na mesma lógica. Decisões registradas em
`.planning/phases/16-reordena-o-em-massa-e-arquivamento-sem-coluna/16-CONTEXT.md`.

- [ ] **ARQCOL-01**: `cards.column_id` é nullable no banco; arquivar um card grava `column_id = null` junto com `arquivado_em`
- [ ] **ARQCOL-02**: Desarquivar sempre atribui a primeira coluna (menor `position`) do board, nunca a coluna anterior à qual o card estava vinculado
- [ ] **ARQCOL-03**: Excluir uma coluna nunca mais apaga em cascata um card arquivado sem histórico financeiro — fechado estruturalmente por ARQCOL-01 (um `column_id` nulo nunca é alcançado por `on delete cascade` de `columns`)

## Carried over from v1.0

Requisito não concluído na v1.0, mantido visível para não se perder. **Não faz parte do escopo de fases da v2.0** — é uma ação de painel, não trabalho de código, adiada por escolha do usuário.

- [ ] **SEC-02**: "Leaked Password Protection" está ligado no Supabase Auth

## Future Requirements

Reconhecidos, mas fora do roadmap desta milestone.

### TEST

- **TEST-01**: Testes para as funções de validação em `actions.ts` (`textoObrigatorio`, `validarValor`, `validarTelefone`, `validarPeriodo`, `validarDetalhes`)
- **TEST-02**: Testes de integração para RLS + Server Actions (caminho feliz, negação por allowlist, input malformado)
- **TEST-03**: Testes E2E do fluxo principal (login → criar card → editar → excluir)

### REFACTOR

- **REFACTOR-01**: Extrair lógica de busca e de escrita-otimista do componente Board (385 linhas) para hooks dedicados
- **REFACTOR-02**: Centralizar utilidades de data (`lib/kanban/date.ts`) para eliminar formatação inline duplicada

### FIN (financeiro — evoluções pós-v2.0)

- **FIN-FUT-01**: Forma de pagamento (Pix/dinheiro/transferência/outro) no momento da baixa — cabe como coluna opcional em `parcela_lancamentos`, sem quebrar o schema da v2.0
- **FIN-FUT-02**: Exportação dos relatórios financeiros em PDF/planilha — se conecta ao relatório de IR, que é visão de longo prazo
- ~~**FIN-FUT-03**: Backfill histórico das parcelas dos meses já passados dos ~46 imóveis~~ — **promovido a escopo ativo**: ver PARCELA-06. Decisão do usuário revertida em 2026-08-18 (a spec original tinha decidido "sem backfill"; ver `.planning/financeiro-modulo-prompt.md`) — agora condicional a o contrato ter `periodo_inicio` e `periodo_fim` preenchidos
- **FIN-FUT-04**: Opção para editar manualmente o vencimento de uma parcela já existente — surgiu no checkpoint de verificação da Phase 6.1 (2026-08-18): o usuário percebeu que mudar `periodo_inicio` num contrato não retroage sobre parcelas já geradas (comportamento intencional, D-14 da Phase 6.1 — nunca reescrever `vencimento` de uma linha existente) e pediu uma forma explícita de corrigir isso quando necessário. Provavelmente cabe como uma ação adicional na coluna Ações do Financeiro, no mesmo padrão de Ajustar (ledger), não como um `UPDATE` direto

## Out of Scope

| Feature | Reason |
|---------|--------|
| Contas a pagar, boletos, cobrança automatizada | A v2.0 cobre apenas contas a receber (parcelas de aluguel); emissão de boleto exige integração bancária |
| Conciliação bancária automática (extrato/OFX) | "Conciliar" na v2.0 é trava manual interna, por decisão do usuário; schema desenhado para não inviabilizar isso depois |
| Cálculo automático de multa/juros por atraso | Usuário optou por acréscimo lançado manualmente — mais flexível e sem precisar parametrizar regra de juros por contrato |
| Papéis/permissões diferenciadas para destravar | Hoje todos na allowlist têm o mesmo nível de acesso; rastreabilidade por lançamento resolve a necessidade sem reformar o RLS |
| Rate limiting em Server Actions | Prematuro na escala atual (uso interno, poucos usuários); reconsiderar se abrir para múltiplos clientes |
| Paginação de cards / busca otimizada | Performático até milhares de cards; hoje são ~46 |
| Auditoria de negações do RLS | Baixa prioridade no estágio atual; útil quando o sistema escalar |
| Relatórios de tomada de decisão (além dos já existentes) | Visão de longo prazo, escopo não definido |
| Módulo de declaração de IR | Visão de longo prazo — formato definido como relatório informativo, sem integração oficial |
| SaaS multi-tenant | Visão de longo prazo, exige reforma de schema/RLS — ver PROJECT.md Key Decisions |

## Traceability

Preenchido na criação do roadmap (2026-08-16). Fases 4-8 — a numeração continua da v1.0, que usou 1-3. Ver `.planning/ROADMAP.md`.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FINSEG-01 | Phase 4 | Pendente |
| FINSEG-02 | Phase 4 | Pendente |
| FINDOC-01 | Phase 4 | Pendente |
| CONTRATO-01 | Phase 5 | Concluído |
| CONTRATO-02 | Phase 5 | Concluído |
| PARCELA-01 | Phase 5 | Concluído |
| PARCELA-02 | Phase 5 | Concluído |
| PARCELA-03 | Phase 5 | Concluído |
| PARCELA-04 | Phase 5 | Concluído |
| FINUI-01 | Phase 5 | Concluído |
| FINUI-02 | Phase 5 | Substituído (ver CONSULTA-02) |
| FINUI-03 | Phase 5 | Concluído |
| CONTRATO-03 | Phase 6.1 | Concluído |
| PARCELA-05 | Phase 6.1 | Concluído |
| PARCELA-06 | Phase 6.1 | Concluído |
| CONSULTA-01 | Phase 6.1 | Concluído |
| CONSULTA-02 | Phase 6.1 | Concluído |
| VIDA-01 | Phase 6.2 | Completo |
| VIDA-02 | Phase 6.2 | Completo |
| VIDA-03 | Phase 6.2 | Completo |
| VIDA-04 | Phase 6.2 | Completo |
| VIDA-05 | Phase 6.2 | Completo |
| VIDA-06 | Phase 6.2 | Completo |
| BAIXA-01 | Phase 6 | Concluído |
| BAIXA-02 | Phase 6 | Concluído |
| BAIXA-03 | Phase 6 | Concluído |
| BAIXA-04 | Phase 6 | Concluído |
| BAIXA-05 | Phase 6 | Concluído |
| FINUI-04 | Phase 6 | Concluído |
| FINSEG-03 | Phase 6 | Concluído |
| CONCIL-01 | Phase 7 | Concluído |
| CONCIL-02 | Phase 7 | Concluído |
| CONCIL-03 | Phase 7 | Concluído |
| CONCIL-04 | Phase 7 | Concluído |
| FINREL-01 | Phase 8 | Confirmado em produção |
| FINREL-02 | Phase 8 | Confirmado em produção |
| FINREL-03 | Phase 8 | Confirmado em produção |
| FINREL-04 | Phase 8 | Confirmado em produção |
| FINREL-05 | Phase 8 | Confirmado em produção |
| INTEG-01 | Phase 9 | Confirmado em produção |
| INTEG-02 | Phase 9 | Confirmado em produção |
| INTEG-03 | Phase 9 | Confirmado em produção |
| INTEG-04 | Phase 9 | Confirmado em produção |
| INTEG-05 | Phase 9 | Confirmado em produção |
| RELDED-01 | Phase 10 | Confirmado em produção |
| RELDED-02 | Phase 10 | Confirmado em produção |
| RELDED-03 | Phase 10 | Confirmado em produção |
| RELDED-04 | Phase 10 | Confirmado em produção |
| RELDED-05 | Phase 10 | Confirmado em produção |
| CANPAG-01 | Phase 11 | Confirmado em produção |
| CANPAG-02 | Phase 11 | Confirmado em produção |
| CANPAG-03 | Phase 11 | Confirmado em produção |
| CANPAG-04 | Phase 11 | Confirmado em produção |
| CANAJU-01 | Phase 12 | Confirmado em produção |
| CANAJU-02 | Phase 12 | Confirmado em produção |
| CANAJU-03 | Phase 12 | Confirmado em produção |
| CANAJU-04 | Phase 12 | Confirmado em produção |
| IMOB-01 | Phase 13 | Confirmado em produção |
| IMOB-02 | Phase 13 | Confirmado em produção |
| IMOB-03 | Phase 13 | Confirmado em produção |
| IMOB-04 | Phase 13 | Confirmado em produção |
| IMOB-05 | Phase 13 | Confirmado em produção |
| CANIMOB-01 | Phase 14 | Confirmado em produção |
| CANIMOB-02 | Phase 14 | Confirmado em produção |
| CANIMOB-03 | Phase 14 | Confirmado em produção |
| CANIMOB-04 | Phase 14 | Confirmado em produção |
| CANIMOB-05 | Phase 14 | Confirmado em produção |
| CANDEST-01 | Phase 15 | Confirmado em produção |
| CANDEST-02 | Phase 15 | Confirmado em produção |
| CANDEST-03 | Phase 15 | Confirmado em produção |
| PAGIN-01 | Phase 15 | Confirmado em produção |
| PAGIN-02 | Phase 15 | Confirmado em produção |
| PAGIN-03 | Phase 15 | Confirmado em produção |
| REORD-01 | Phase 16 | Pendente |
| REORD-02 | Phase 16 | Pendente |
| REORD-03 | Phase 16 | Pendente |
| ARQCOL-01 | Phase 16 | Pendente |
| ARQCOL-02 | Phase 16 | Pendente |
| ARQCOL-03 | Phase 16 | Pendente |

**Coverage:**
- v2.0 requirements: 39 total — Phase 4: 3, Phase 5: 9, Phase 6: 7, **Phase 6.1: 5**, **Phase 6.2: 6**, Phase 7: 4, Phase 8: 5
- Mapped to phases: 39
- Unmapped: 0
- Phase 9 (INTEG-01..05), Phase 10 (RELDED-01..05), Phase 11 (CANPAG-01..04), Phase 12 (CANAJU-01..04), Phase 13 (IMOB-01..05), Phase 14 (CANIMOB-01..05), Phase 15 (CANDEST-01..03, PAGIN-01..03) e Phase 16 (REORD-01..03, ARQCOL-01..03) são trabalho pós-milestone, fora dos 39 requisitos da v2.0 — ver seções `### INTEG`, `### RELDED`, `### CANPAG`, `### CANAJU`, `### IMOB`, `### CANIMOB`, `### CANDEST`, `### PAGIN`, `### REORD` e `### ARQCOL` acima
- FINUI-02 substituído por CONSULTA-02 (não conta duplicado — 1 saiu, 5 novos entraram: CONTRATO-03, PARCELA-05, PARCELA-06, CONSULTA-01, CONSULTA-02)
- VIDA-01..06 entraram em 2026-08-19, depois do feedback do usuário sobre o comportamento de inativo, a divergência entre card e Financeiro, e a ausência de trava na exclusão (33 + 6 = 39)

> **Correção de contagem:** este documento dizia "26 total". A soma real das categorias da v2.0 (CONTRATO 2 + PARCELA 4 + BAIXA 5 + CONCIL 4 + FINUI 4 + FINREL 5 + FINSEG 3 + FINDOC 1) é **28**. Nenhum requisito foi adicionado ou removido — só a contagem estava errada.

**Fora do escopo de fases:** `SEC-02` (Leaked Password Protection, herdado da v1.0) não aparece na tabela de propósito — é toggle no painel do Supabase, não trabalho de código, adiado por escolha do usuário.

**Pilares cruzados:** FINSEG-01/02 (RLS e CHECK constraints) e FINSEG-03 (`erroDoBanco()`) estão ancorados na fase em que ficam de fato verificáveis — as fases seguintes não os re-implementam, mas confirmam nos próprios critérios que continuam valendo. Mesma lógica para CONTRATO-02, cuja parte "parcelas antigas continuam gerenciáveis" é reconfirmada nos critérios da Phase 6.

---

## Histórico: v1.0 (concluído)

Milestone de estabilização e documentação, sem feature nova. 7 de 8 requisitos concluídos — SEC-02 adiado por escolha do usuário (ver "Carried over" acima).

### DOCS

- [x] **DOCS-01**: Documentação completa do projeto publicada num vault Obsidian — 22 notas em `kanba aluguel/`, entrada única, guia dedicado para agentes de IA
- [x] **DOCS-02**: A suposição de "board único, sem isolamento entre clientes" está documentada, junto com o caminho de migração para SaaS multi-tenant. Ver `Políticas RLS.md#Limitação: board único`
- [x] **DOCS-03**: A dependência da proteção CSRF automática do Next.js Server Actions está documentada. Coberto em `Modelo de Segurança.md` — ficou breve (uma linha de tabela), pode ser encorpado

### SEC

- [x] **SEC-01**: ~~Mensagens de erro do Postgres não aparecem no console do navegador~~ — **falso positivo**; os `console.error` estão em código `"use server"`, vão para os logs da Vercel. Nenhuma mudança necessária
- [x] **SEC-03**: ~~Verificação de e-mail ligada no Supabase Auth~~ — **falso positivo**; `mailer_autoconfirm: false` já exigia confirmação

### ROBUST

- [x] **ROBUST-01**: Error Boundary com opção de recarregar, em dois níveis (`app/error.tsx`, `app/(app)/error.tsx`). Nesta versão do Next a prop é `retry`, não `reset`
- [x] **ROBUST-02**: Mensagem explicando board vazio por falta de allowlist, via `supabase.rpc("is_team_member")` no `(app)/layout.tsx`. ⚠️ Verificado por lint/build, **não com sessão real** — ver STATE.md

**Nota de calibragem herdada:** `SEC-01` e `SEC-03` vieram de `.planning/codebase/CONCERNS.md`, gerado por um modelo rápido. **Dois de dois** achados de segurança daquele documento que foram verificados se provaram falsos. Tratar os itens restantes como **hipóteses a verificar**, não fatos — relevante se algum for reaproveitado na v2.0.

---
*Requirements v2.0 defined: 2026-08-16 — traceability preenchida na criação do roadmap (Phases 4-8)*
