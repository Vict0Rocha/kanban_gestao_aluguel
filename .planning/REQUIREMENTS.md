# Requirements: Kanban Aluguel

**Milestone atual:** v2.0 Módulo Financeiro
**Defined:** 2026-08-16
**Core Value:** Dar visibilidade e controle sobre a situação de cada contrato de aluguel — quem está em dia, quem está vencendo, quem precisa de contato — sem depender de planilha.

**Spec de origem:** `.planning/financeiro-modulo-prompt.md` — decisões de produto já fechadas com o usuário. Os requisitos abaixo derivam dela; não re-perguntar o que já está decidido lá.

## v2.0 Requirements

### CONTRATO — controle de contrato ativo/inativo

- [ ] **CONTRATO-01**: Usuário pode marcar um contrato como ativo ou inativo direto no card do board, sem precisar abrir o modal de edição
- [ ] **CONTRATO-02**: Contrato marcado como inativo para de gerar novas parcelas, mas suas parcelas já existentes continuam visíveis e gerenciáveis até serem resolvidas

### PARCELA — geração automática

- [ ] **PARCELA-01**: Ao abrir a aba Financeiro, o sistema cria automaticamente as parcelas faltantes do mês atual e do próximo mês para cada contrato ativo
- [ ] **PARCELA-02**: Abrir a aba Financeiro repetidamente não duplica parcelas — a geração é idempotente
- [ ] **PARCELA-03**: A parcela guarda o valor do aluguel vigente no momento em que foi gerada, de modo que um reajuste futuro não altera parcelas já criadas
- [ ] **PARCELA-04**: O sistema não gera parcela para competência fora do período do contrato (antes do início ou depois do fim)

### BAIXA — registro de pagamentos e ajustes

- [ ] **BAIXA-01**: Usuário pode dar baixa total em uma parcela, informando a data do pagamento
- [ ] **BAIXA-02**: Usuário pode dar baixa parcial, e a parcela fica marcada como parcialmente paga até que o valor devido seja completado
- [ ] **BAIXA-03**: Usuário pode lançar um acréscimo sobre uma parcela (ex.: multa por atraso), alterando o valor devido
- [ ] **BAIXA-04**: Usuário pode lançar um desconto sobre uma parcela, alterando o valor devido
- [ ] **BAIXA-05**: Todo lançamento registra quem fez, quando e uma observação opcional, e nenhum lançamento anterior é sobrescrito ou apagado

### CONCIL — conciliação e correção

- [ ] **CONCIL-01**: Usuário pode conciliar (travar) uma parcela já paga, protegendo-a contra alteração acidental
- [ ] **CONCIL-02**: Tentar alterar uma parcela conciliada é bloqueado, com mensagem em linguagem simples explicando que é preciso destravar antes
- [ ] **CONCIL-03**: Usuário pode destravar uma parcela conciliada informando um motivo, que é obrigatório
- [ ] **CONCIL-04**: O histórico de destravas de uma parcela fica visível na própria parcela — quem destravou, quando e por quê

### FINUI — aba Financeiro

- [ ] **FINUI-01**: Existe uma aba "Financeiro" na navegação, separada do board e dos relatórios de contrato
- [ ] **FINUI-02**: A aba Financeiro apresenta as parcelas do mês atual e do próximo mês em visões separadas
- [ ] **FINUI-03**: Cada parcela na lista mostra sua situação (a vencer, vencida, paga, parcial, conciliada), o valor devido e o valor já pago
- [ ] **FINUI-04**: Dar baixa em uma parcela leva no máximo dois cliques a partir da lista, sem etapa burocrática intermediária

### FINREL — relatórios financeiros

- [ ] **FINREL-01**: Usuário pode ver um relatório das parcelas pagas
- [ ] **FINREL-02**: Usuário pode ver um relatório das parcelas a vencer
- [ ] **FINREL-03**: Usuário pode ver um relatório das parcelas vencidas
- [ ] **FINREL-04**: Usuário pode ver um relatório das parcelas conciliadas
- [ ] **FINREL-05**: Usuário pode combinar filtros por imóvel, proprietário e período nos relatórios financeiros, sem que um filtro resete os outros

### FINSEG — segurança do módulo financeiro

- [ ] **FINSEG-01**: Parcelas e lançamentos só são legíveis e graváveis por quem está na allowlist — RLS via `is_team_member()`, a mesma função já usada em `cards` e `alerts`
- [ ] **FINSEG-02**: As regras financeiras (valor não-negativo, status válido, motivo obrigatório na destrava) são garantidas por constraints no banco, não apenas pela validação do formulário
- [ ] **FINSEG-03**: Uma operação financeira rejeitada pelo banco não expõe a mensagem crua do Postgres ao usuário — passa por `erroDoBanco()`, como o resto do app

### FINDOC — documentação do módulo

- [ ] **FINDOC-01**: `docs/data-model.md` documenta as novas entidades (diagrama incluso) e o porquê de cada decisão não-óbvia: livro-razão append-only, geração preguiçosa sem cron, flag `ativo` manual em vez de derivada da data

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
- **FIN-FUT-03**: Backfill histórico das parcelas dos meses já passados dos ~46 imóveis

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

Preenchido na criação do roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| — | — | Aguardando roadmap |

**Coverage:**
- v2.0 requirements: 26 total
- Mapped to phases: TBD
- Unmapped: TBD

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
*Requirements v2.0 defined: 2026-08-16*
