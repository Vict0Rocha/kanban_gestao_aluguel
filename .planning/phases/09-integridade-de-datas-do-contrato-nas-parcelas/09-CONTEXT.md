# Phase 9: Integridade de datas do contrato nas parcelas - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Toda parte do sistema que gera ou mantém `parcelas` passa a respeitar fielmente `periodo_inicio`/`periodo_fim` do card **no momento presente**, não só no momento da geração original. Duas mudanças:

1. **Poda ativa:** editar `periodo_inicio`/`periodo_fim` de um card com parcelas já geradas apaga de verdade (não só esconde) as parcelas futuras/passadas que ficaram fora do novo período — mas só as que nunca tiveram pagamento nem lançamento algum.
2. **Geração sem data:** contrato sem nenhuma das duas datas passa a gerar só a parcela do mês atual (hoje gera atual + próximo).

Inclui a limpeza pontual das 27 parcelas órfãs já confirmadas em produção (2 contratos de teste, "A" e "outro").

Fora do escopo desta fase: a página dedicada de Relatório Financeiro com lista de contratos e exportação em PDF pedida pelo usuário na mesma conversa — isso é a Phase 10 (ver `<deferred>`).

</domain>

<decisions>
## Implementation Decisions

### Apagar, não só esconder (reverte D-03)
- **D-01:** Ao contrário da decisão já documentada em `docs/data-model.md` (D-03 — "nada é apagado quando uma parcela deixa de aparecer"), esta fase **apaga de verdade** as parcelas órfãs. Decisão explícita do usuário, dada depois de ver o conflito com D-03 apontado diretamente: ele quer evitar "informações soltas e desnecessárias no banco de dados". — **Reversibility:** one-way — parcela apagada não volta; se o usuário reverter o período depois, a parcela é gerada de novo do zero, com `valor_original` fotografando o `cards.valor` **daquele momento**, que pode já ser diferente do original (mesmo comportamento que D-03 já previa como consequência de regenerar).
- **D-02:** Critério de "órfã apagável": pertence ao card, está **fora do período atual** (`competenciaNoPeriodo` de `web/src/lib/kanban/parcelas.ts:156` devolvendo `false` — reaproveitar esta função, não reimplementar o teste de período), `status = 'aberta'` **e** não existe nenhuma linha em `parcela_lancamentos` para ela. As duas condições (status E ausência de lançamento) são redundantes na prática — todo status diferente de `aberta` implica pelo menos um lançamento — mas ambas devem ser checadas, mesma defesa em profundidade usada na consulta de verificação desta conversa. Nunca checar só o status.
- **D-03:** A regra não distingue órfã "no futuro" de órfã "no passado" — mudar `periodo_inicio` para frente (cortando meses do início) poda exatamente como mudar `periodo_fim` para trás (cortando meses do fim), pelo mesmo critério de D-02. Generalização deliberada do exemplo dado pelo usuário (que falou só do caso "encurtar do fim"): o princípio que ele declarou logo depois ("todas as partes do sistema precisam respeitar exatamente a data que está no contrato") não distingue direção. Se o planner/executor achar isso arriscado demais para uma fase, é o ponto certo para levantar no plano.

### Quando a poda roda (Claude's Discretion — nenhuma área foi selecionada para discussão; usuário respondeu "sem preferência" em todas)
- **D-04:** Poda roda **síncrona**, dentro da mesma Server Action que grava `periodo_inicio`/`periodo_fim` (`updateCardAction`, `web/src/lib/kanban/actions.ts:345`) — não preguiçosa como a geração (`garantirParcelas`). Razão: apagar é muito mais consequente que gerar (gerar é aditivo/idempotente via upsert; apagar é destrutivo). Rodar na hora do salvar liga a causa (editar a data) ao efeito (parcelas sumindo) no mesmo instante, em vez de a poda acontecer num momento imprevisível — a próxima vez que alguém abrir Financeiro ou Relatórios, que hoje é uma tela deliberadamente só-leitura (ver comentário "Pilares cruzados" da Phase 8 em ROADMAP.md). Só dispara quando `periodo_inicio` e/ou `periodo_fim` realmente mudam de valor nesta chamada — não em todo salvar de card (evita reconsultar `parcelas` para uma edição de telefone, por exemplo).
- **D-05:** Antes de apagar, se a edição vai remover uma ou mais parcelas órfãs, o salvamento mostra quantas serão apagadas e exige um clique explícito de confirmação ("Confirmar e salvar", não o texto digitado tipo "excluir <id>" — esse nível de fricção fica reservado para excluir o contrato inteiro). Se a edição não apaga nenhuma parcela (o caso comum), salva exatamente como hoje, sem fricção nova. — **Reversibility:** reversible — é só uma camada de UI; dá pra remover a confirmação depois sem afetar dado nenhum.

### "Sem data" — o que conta
- **D-06:** A mudança ("sem data gera só o mês atual") vale **só quando as duas datas estão vazias** (`periodo_inicio` E `periodo_fim` nulos). Contrato com só `periodo_inicio` preenchido (prazo indeterminado, um estado comum e intencional, não uma lacuna de cadastro) **continua** gerando atual + próximo mês, sem mudança — hoje o código trata os dois casos igual dentro de `competenciasAlvo` (`parcelas.ts:93`), mas o usuário só descreveu o caso de "contrato sem data" — mudar também o caso de prazo indeterminado seria alterar o comportamento de um número desconhecido de contratos reais sem pedido explícito. Se o usuário quis dizer os dois casos, é uma correção rápida no plano.
- **D-07:** A mudança de D-06 vale só para geração **daqui pra frente** — não apaga retroativamente uma parcela de "próximo mês" já gerada para um contrato sem data antes desta fase. Mesmo precedente já registrado em `parcelas.ts:129-132` (comentário de `vencimentoDaCompetencia`): mudança de regra de geração nunca reescreve o que já foi gerado.

### Limpeza das 27 órfãs já existentes
- **D-08:** Entra no mesmo plano de execução desta fase, não fica separada — são só 2 contratos de teste ("A", "outro"), e deixá-las contradiz o motivo que o próprio usuário deu para pedir a poda ("evita informações soltas"). Mesmo padrão de todo o projeto até aqui: script SQL revisável pelo usuário no SQL Editor, não uma migração que apaga sem mostrar antes o que vai ser removido — nunca um `DELETE` disparado direto por uma migração sem o usuário ver a lista primeiro.

### Claude's Discretion
Nenhuma das 4 áreas foi selecionada para discussão — o usuário respondeu "sem preferência" no menu de seleção. D-04, D-05, D-06, D-07 e D-08 acima são todas decisões tomadas por mim (Claude), documentadas com o raciocínio para que o usuário possa corrigir facilmente ao revisar este arquivo antes do planejamento. D-01/D-02/D-03 vieram diretamente da conversa antes desta sessão formal de discussão (incluindo a consulta SQL que confirmou as 27 órfãs) e não foram reabertas.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Decisão que esta fase reverte
- `docs/data-model.md` §"Por que nada é apagado quando uma parcela deixa de aparecer (D-03)" — a decisão documentada que esta fase reverte deliberadamente. Ler antes de planejar, para citar corretamente o antes/depois na atualização deste doc.
- `.planning/phases/06.2-ciclo-de-vida-do-contrato/06.2-CONTEXT.md` linhas 54-58 — o D-03 original da Phase 6.2, com a razão dada na época pelo próprio usuário ("ele pode marcar por engano, e se o sistema apagasse teria que regenerar depois"). Útil para o planner entender exatamente o que está sendo trocado e por quê.

### Geração e período de parcelas (não reimplementar)
- `web/src/lib/kanban/parcelas.ts` — `competenciaNoPeriodo` (linha 156, teste de "está fora do período" a reaproveitar para a poda), `competenciasAlvo` (linha 93, fallback atual+próximo a restringir por D-06), `competenciasAlvoParaCard` (linha 230), `garantirParcelas` (linha ~415, geração preguiçosa — não mexer no padrão de geração, só no fallback sem-data)
- `web/src/lib/kanban/visibilidade.ts` — `avaliarVisibilidadeParcela`, a regra de visibilidade da Phase 6.2 que hoje só esconde. Não precisa mudar, mas o planner deve confirmar que continua correta depois que órfãs passam a ser apagadas em vez de só ficarem invisíveis (o caminho "esconder" continua existindo para os outros casos: contrato inativo, arquivado).

### Escrita e proteção contra exclusão indevida
- `web/src/lib/kanban/actions.ts` — `updateCardAction` (linha 345, onde a poda síncrona entra), `cardTemLancamento` (linha ~427, padrão de join com `parcela_lancamentos` a reaproveitar para o teste "não tem lançamento" de D-02), `erroDoBanco` (linha 178, sanitização de erro já estabelecida)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `competenciaNoPeriodo(competencia, periodoInicio, periodoFim)` (`parcelas.ts:156`): já implementa exatamente o teste "está fora do período atual?" usado tanto pela geração quanto pela visibilidade. A poda deve chamar esta função (negada) para decidir o que é órfã — nunca reimplementar a comparação de datas na mão.
- Padrão de proteção "tem lançamento?" já existe em `cardTemLancamento` (`actions.ts`) via `parcela_lancamentos!inner`. A poda reaproveita o mesmo padrão de join, adaptado para `parcela_id` em vez de `card_id`.

### Established Patterns
- Toda escrita financeira passa por Server Action com `requireUser()` + validação server-side, nunca confia no cliente — a poda entra dentro de `updateCardAction`, que já segue esse padrão.
- `erroDoBanco()` sanitiza qualquer erro de banco antes de chegar no usuário — reaproveitar, não criar uma nova mensagem de erro cru.
- Precedente direto para "mudança de regra de geração não reescreve o que já existe": comentário de `vencimentoDaCompetencia` em `parcelas.ts:129-132`.

### Integration Points
- `updateCardAction` (`actions.ts:345`) é o único ponto de entrada de escrita para `periodo_inicio`/`periodo_fim` — não existe outro caminho de edição dessas colunas hoje.
- `card-detail-dialog.tsx:189-203` é a UI que dispara `updateCardAction` — é onde entra a confirmação de D-05 (aviso de quantas parcelas serão apagadas).

</code_context>

<specifics>
## Specific Ideas

Exemplo dado pelo usuário, que define o comportamento esperado: "criei um contrato com 12 meses, o sistema vai gerar 12 parcelas, porém caso o usuário tenha cadastrado errado e queira corrigir para 6 meses, os relatórios vão continuar pegando as parcelas que foram criadas no início, porém estaria errado." — a poda deve fazer esse cenário exato produzir 6 parcelas no relatório, não 12, imediatamente após salvar a correção.

Frase que define o princípio geral por trás da fase: "Todas as partes do sistema, precisa respeitar exatamente a data que está no contrato."

</specifics>

<deferred>
## Deferred Ideas

- **Página dedicada de Relatório Financeiro** (botão "Relatório financeiro" dentro de `/relatorios`, nova rota, mesmo padrão de filtro suspenso + cards, mas filtro **dinâmico** ao vivo — diferente de D-04 da Phase 8 — com lista dos contratos filtrados abaixo dos cards, e "Gerar relatório" virando exportação em PDF do filtro aplicado) — pedido pelo usuário na mesma conversa que abriu esta fase, mas é uma capacidade nova (UI nova, rota nova, PDF), não uma correção de integridade de dado. Vira Phase 10, planejada logo depois desta.
- **Ativo/inativo também apagando (não só escondendo)** — não pedido pelo usuário; ele falou especificamente de mudança de data, não do toggle ativo/inativo (que continua no comportamento "esconder" de D-02/Phase 6.2). Não expandir esta fase para isso sem pedido explícito.

### Reviewed Todos (not folded)
None — discussion stayed within phase scope

</deferred>

---

*Phase: 9-Integridade de datas do contrato nas parcelas*
*Context gathered: 2026-08-20*
