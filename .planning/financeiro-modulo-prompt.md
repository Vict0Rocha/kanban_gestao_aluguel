# Prompt: Módulo Financeiro — Kanban Aluguel

> Documento de handoff para o agente que vai implementar. Não é um plano GSD formal — é o prompt detalhado combinado entre Victor e o Claude durante a fase de ideação. Se o agente executor usar o fluxo GSD (`/gsd-phase`, `/gsd-plan-phase`), este documento serve de insumo para o `discuss-phase`/`plan-phase`; se implementar direto, serve como spec.

## ⚠️ LEIA PRIMEIRO — decisões já fechadas com o usuário

**Este documento é o resultado de uma sessão de ideação completa com o Victor.** As decisões abaixo já foram feitas, apresentadas e aprovadas explicitamente. **Não re-perguntar, não re-litigar** — isso é retrabalho e desperdiça o tempo dele:

| Decisão | Escolha do usuário |
|---------|--------------------|
| Como parcelas são criadas | **Automática e preguiçosa** (na leitura, sem cron/job agendado) |
| O que "conciliar" significa | **Trava manual interna** (não é importação de extrato bancário) |
| Corrigir parcela travada | **Qualquer membro destrava, mas fica registrado** (quem/quando/motivo) |
| Valor da parcela | **Variável** — pagamento parcial, acréscimos e descontos, todos suportados |
| Contrato ativo/inativo | **Flag manual**, toggle **direto no card do board** (não só no modal de edição) |
| Visões do Financeiro | **Mês atual e próximo mês**, separadas |

O que **ainda está aberto** está na seção "Assunções tomadas" no final — só isso precisa de confirmação com o Victor.

**Se você é um comando GSD** (`/gsd-new-milestone`, `/gsd-discuss-phase`): use este documento como resposta pronta para a fase de questionamento. Pule direto para requisitos/roadmap.

## Contexto do projeto

Kanban de gestão de aluguéis (Next.js 16 App Router + React 19 + TypeScript + Supabase/Postgres com RLS). Cada card = um imóvel/contrato (`proprietario`, `valor`, `inquilino`, `periodo_inicio`, `periodo_fim`). Uso real hoje: 1 usuário, ~46 imóveis, único board. Ver `docs/data-model.md` para o modelo atual e `.planning/codebase/` para arquitetura, convenções e riscos conhecidos — **leia antes de começar**.

Convenções já estabelecidas que este módulo deve seguir, não reinventar:
- Escrita via **Server Actions** com sessão do usuário (nunca `service_role`), validação espelhada no servidor **e** em `CHECK` constraints do banco.
- RLS por allowlist: função `is_team_member()` já existe e cobre `boards`/`columns`/`cards`/`alerts` — as novas tabelas devem usar a mesma função, não inventar um esquema de permissão novo.
- `numeric(12,2)` para valores monetários (evita erro de ponto flutuante).
- `position` fracionário só se houver ordenação manual — não se aplica aqui a princípio.
- **Sem jobs agendados com chave privilegiada.** O padrão do projeto (`web/src/lib/kanban/alerts.ts`) é calcular estado derivado *na leitura*, e só gravar quando há uma ação humana. O módulo financeiro deve seguir a mesma filosofia (ver "Geração automática" abaixo).

## Pilares obrigatórios — aplicar em toda decisão de implementação

1. **Segurança** — dado financeiro é dado sensível. RLS em todas as tabelas novas, `CHECK` constraints no banco (não confiar só em validação client-side), nunca expor erro cru do Postgres no console (`erroDoBanco()` já existe, reaproveitar).
2. **Flexibilidade** — usuários erram. Toda operação financeira deve ser corrigível sem gambiarra (ver modelo de lançamentos abaixo). Evitar `UPDATE` destrutivo em dado financeiro; preferir registrar o evento.
3. **Facilidade de uso** — quem usa é leigo (dono de imobiliária, não técnico). Zero jargão técnico na UI, zero passo burocrático desnecessário. "Dar baixa" tem que ser 1-2 cliques.
4. **Documentação contínua** — toda decisão de schema ou de fluxo não-óbvia vira um parágrafo em `docs/data-model.md` (atualizar a seção existente) ou em um novo `docs/financeiro.md`, no mesmo estilo do documento atual (decisão + porquê). Isso não é opcional nem fica para o final: documentar junto com a fase que introduziu a decisão.

## Visão geral do que será construído

- Nova aba de navegação **"Financeiro"**, separada do Board e dos Relatórios atuais.
- Cada contrato (card) ganha uma **parcela mensal** gerada automaticamente, com ciclo de vida: aberta → (paga | parcial) → conciliada (travada).
- Toggle **Ativo/Inativo** no card, controlando se o contrato participa da geração de parcelas.
- Dentro do Financeiro, duas visões separadas: **mês atual** e **próximo mês** (visão analítica de planejamento).
- Ações: **dar baixa** (total ou parcial), **ajustar** (acréscimo/desconto), **conciliar** (travar), **destravar** (corrigir, com motivo registrado).
- **Relatórios financeiros**: parcelas pagas, a vencer, vencidas, conciliadas — com filtros combináveis (imóvel, proprietário, período), reaproveitando o padrão dos relatórios já existentes.

## Modelo de dados proposto

> Proposto, não gravado em pedra — se o agente encontrar uma razão técnica concreta para desviar, pode fazer, **mas precisa documentar o porquê** no doc de decisões (pilar 4).

### `cards` (alteração)
- `ativo boolean not null default true` — controla se o contrato participa da geração automática de parcelas. Reversível (toggle simples). Default `true` para não quebrar os 46 imóveis existentes.
- Marcar inativo **não** apaga nem esconde parcelas já existentes — elas continuam visíveis e gerenciáveis (dar baixa, conciliar) até resolvidas. Só impede a criação de *novas* parcelas.

### `parcelas` (nova)
- `id uuid pk`
- `card_id uuid fk → cards, on delete cascade`
- `competencia date` (dia 1 do mês de referência, ex: `2026-08-01`) — evita ambiguidade de "mês/ano" como texto
- `vencimento date`
- `valor_original numeric(12,2)` — snapshot do `valor` do card no momento da geração (reajuste futuro do aluguel não altera parcelas já geradas)
- `status text` — `aberta` | `parcial` | `paga` | `conciliada` (armazenado)
- `conciliada_em timestamptz`, `conciliada_by uuid fk → profiles`
- **Não armazenar** "a vencer"/"vencida" — isso é `vencimento < hoje AND status IN ('aberta','parcial')`, calculado na leitura, exatamente como os alertas de contrato hoje.
- Índice único em `(card_id, competencia)` — nunca duas parcelas do mesmo contrato pro mesmo mês (mesmo padrão de índice único que `alerts` já usa para evitar duplicata).

### `parcela_lancamentos` (nova) — livro-razão append-only
- `id uuid pk`
- `parcela_id uuid fk → parcelas, on delete cascade`
- `tipo text` — `pagamento` | `acrescimo` | `desconto` | `destrava`
- `valor numeric(12,2)` (pode ser 0 para `destrava`, que é um evento de estado, não financeiro)
- `data date`
- `observacao text`
- `motivo text` (obrigatório quando `tipo = 'destrava'`)
- `criado_por uuid fk → profiles`, `criado_em timestamptz default now()`

**Por que ledger em vez de editar a parcela diretamente:** dar baixa parcial, aplicar desconto/multa e corrigir uma parcela já conciliada viram a mesma operação — inserir um lançamento. Nada é sobrescrito, então "correção com histórico" (pilar Flexibilidade + Segurança) sai de graça, sem precisar de uma tabela de auditoria paralela. O valor devido (`valor_original + acréscimos - descontos`) e o valor pago (`soma dos pagamentos`) da parcela são sempre derivados somando os lançamentos.

### RLS
Mesma função `is_team_member()` já usada em `cards`/`alerts`, aplicada a `parcelas` e `parcela_lancamentos`. Sem tabela de permissão nova — hoje todo mundo na allowlist tem o mesmo nível de acesso, isso não muda aqui.

## Regras de negócio

1. **Geração automática, preguiçosa, sem cron**: ao abrir a aba Financeiro, garantir que existem as parcelas de **mês atual** e **próximo mês** para todo card com `ativo = true` cuja `competencia` caia dentro de `[periodo_inicio, periodo_fim]` (ou sem `periodo_fim`, contrato por prazo indeterminado). Se a parcela já existe, não faz nada (idempotente).
2. **Contrato inativo**: não entra na geração automática. Parcelas pendentes de antes de ficar inativo continuam aparecendo até serem baixadas/conciliadas (não force resolução na hora de desativar).
3. **Dar baixa**: registra lançamento `tipo = 'pagamento'`. Se `soma(pagamentos) < valor devido` → status `parcial`. Se `soma(pagamentos) >= valor devido` → status `paga`.
4. **Ajustar**: registra lançamento `tipo = 'acrescimo'` ou `'desconto'`, recalculando o valor devido. Permitido em parcela `aberta`/`parcial`/`paga`, bloqueado em `conciliada` sem destravar antes.
5. **Conciliar**: só permitido quando `status = 'paga'` (não faz sentido travar algo ainda em aberto). Seta `status = 'conciliada'`, `conciliada_em`, `conciliada_by`. A partir daqui, bloqueia novos lançamentos de ajuste/pagamento.
6. **Destravar**: qualquer membro da allowlist pode, mas **exige motivo** (campo obrigatório) e grava lançamento `tipo = 'destrava'` com quem/quando/motivo antes de permitir qualquer novo lançamento. Volta o status para `paga` (ponto de partida pra nova correção).
7. **Duas visões no Financeiro**: mês atual e próximo mês são filtros de `competencia` sobre a mesma tabela — não é modelo de dados diferente, só apresentação separada (abas/tabs), pra dar uma visão de planejamento sem misturar com o que já venceu.

## Divisão em fases/tasks

### Fase 1 — Schema e segurança
- Migração SQL: `cards.ativo`, tabelas `parcelas` e `parcela_lancamentos`, índices (incluindo o único de `(card_id, competencia)`), `CHECK` constraints (valores não-negativos, `tipo`/`status` como enum ou check de valores permitidos, `motivo` obrigatório quando `tipo = 'destrava'`).
- RLS policies reaproveitando `is_team_member()`.
- Backfill: `ativo = true` para os cards existentes (já é o default, mas confirmar migração não deixa nulo).
- **Critério de aceite**: `supabase db push` aplica limpo; tentar inserir uma parcela/lançamento fora da allowlist falha por RLS; tentar valor negativo falha por CHECK.

### Fase 2 — Geração automática de parcelas
- Função em `web/src/lib/kanban/` (mesmo diretório dos alertas) que, dado um conjunto de cards ativos, garante parcela de mês atual + próximo mês.
- Chamada lazy ao carregar a aba Financeiro (não em toda navegação do app — só quando a rota financeira é acessada).
- **Critério de aceite**: abrir a aba pela primeira vez no mês cria as parcelas faltantes; abrir de novo não duplica (idempotente); card inativo não gera nada; card com `periodo_fim` no passado não gera parcela além do fim do contrato.

### Fase 3 — Ações financeiras (Server Actions)
- `darBaixa`, `ajustarParcela` (acréscimo/desconto), `conciliarParcela`, `destravarParcela`.
- Validação server-side espelhando os CHECK constraints (mesmo padrão das Server Actions de cards já existentes).
- **Critério de aceite**: cada ação só é possível nos status permitidos (ex: conciliar só se `paga`); tentar ajustar uma parcela conciliada sem destravar falha com mensagem clara pro usuário.

### Fase 4 — UI da aba Financeiro
- Toggle Ativo/Inativo **direto no card do board** (badge/switch pequeno e visível, sem precisar abrir o modal de edição — decisão do usuário, prioriza velocidade no dia a dia sobre board mais "limpo").
- Nova aba de navegação "Financeiro" com sub-visões "Mês atual" / "Próximo mês".
- Lista de parcelas com ações inline (dar baixa, ajustar, conciliar, destravar) — modais simples, sem passo burocrático extra.
- **Critério de aceite**: fluxo completo "abrir Financeiro → dar baixa → conciliar → tentar editar (bloqueado) → destravar com motivo → corrigir" funciona ponta a ponta no navegador, testado manualmente (projeto não tem suíte automatizada hoje).

### Fase 5 — Relatórios financeiros
- Tela/seção com parcelas pagas, a vencer, vencidas, conciliadas.
- Filtros combináveis por imóvel, proprietário e período (reaproveitar padrão de filtros dos relatórios de contrato já existentes).
- **Critério de aceite**: os quatro totais batem com o estado real das parcelas no banco; filtros combinam sem resetar uns aos outros (mesmo comportamento dos relatórios atuais).

### Fase 6 — Documentação
- Atualizar `docs/data-model.md` com as novas entidades (diagrama Mermaid incluso) e a seção de decisões (por que ledger, por que sem cron, por que `ativo` é flag manual e não derivado de `periodo_fim`).
- Se o fluxo de conciliação/destrava tiver alguma sutileza operacional, considerar um runbook curto no mesmo espírito de `supabase/hardening_seguranca.sql`.
- **Critério de aceite**: alguém que não participou da implementação consegue entender o fluxo financeiro só lendo `docs/data-model.md` atualizado.

## Assunções tomadas — confirmar com Victor antes de fase 1, ou ajustar se errado

1. **Sem backfill histórico**: geração começa do mês atual em diante; meses passados dos 46 imóveis não geram parcela retroativa automaticamente.
2. **Forma de pagamento**: não incluída no MVP (pode entrar como campo opcional em `parcela_lancamentos` depois, sem quebrar nada).
3. **Sem exportação de relatório** (PDF/Excel) nesta fase — só tela. Fica alinhado com o relatório de IR, que já está mapeado como visão futura separada.

## Regras gerais para o agente executor

- Seguir `.planning/codebase/CONVENTIONS.md` e o restante de `.planning/codebase/` para estilo de código, estrutura de pastas e padrões já em uso.
- Não implementar multi-tenant agora — mas também não tomar nenhuma decisão de schema que dificulte adicionar `tenant_id` depois (mesma régua já usada no resto do projeto).
- Nunca decidir regra de negócio financeira só no client — sempre espelhar no banco.
- Cada fase acima deve ser um commit (ou conjunto pequeno de commits) autocontido e testável isoladamente antes de passar pra próxima.
- Em caso de dúvida de escopo não coberta aqui, perguntar antes de assumir — especialmente qualquer coisa que toque em dinheiro real de terceiros.
