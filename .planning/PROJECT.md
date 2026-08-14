# Kanban Aluguel

## What This Is

Um Kanban web para gestão de aluguéis e contratos de imóveis: cada card representa um imóvel, com proprietário, inquilino, valor, telefone e período de contrato. Hoje é usado por uma pessoa (Victor) para acompanhar ~46 imóveis; a visão de longo prazo é virar uma ferramenta de gestão completa para administradoras de aluguel, incluindo módulo financeiro, relatórios de apoio à decisão e emissão de relatório para declaração de IR dos proprietários.

## Core Value

Dar visibilidade e controle sobre a situação de cada contrato de aluguel — quem está em dia, quem está vencendo, quem precisa de contato — sem depender de planilha.

## Business Context

<!-- Hoje é uso interno, sem cobrança. Mantido porque a visão de longo prazo é virar SaaS pago — os campos abaixo refletem o estado atual, não uma meta já definida. -->

- **Customer**: Hoje, só o próprio Victor (uso interno). Visão futura: imobiliárias/administradoras de aluguel como clientes pagantes.
- **Revenue model**: Nenhum hoje. Futuro: SaaS multi-tenant (assinatura por administradora) — modelo de precificação ainda não definido.
- **Success metric**: Ainda não definido — não há cobrança nem múltiplos usuários hoje para medir.
- **Strategy notes**: —

## Requirements

### Validated

<!-- Já implementado e em uso real. -->

- ✓ Board Kanban com colunas e cards arrastáveis (drag-and-drop), incluindo reordenação de colunas — existing
- ✓ Cadastro e edição de imóvel: proprietário, endereço, valor, inquilino, telefone, período de contrato, observações — existing
- ✓ Busca no board (realce, não esconde) e filtros combináveis nos relatórios — existing
- ✓ Relatórios: contratos por status (em dia / vencendo / vencido), gráfico por coluna, tabela de contratos — existing
- ✓ Alertas de contrato vencendo/vencido, calculados na leitura (sem job agendado), com envio manual via WhatsApp (wa.me) — existing
- ✓ Autenticação por e-mail/senha via Supabase, sessão JWT renovada a cada request — existing
- ✓ Autorização em duas camadas: cadastro público fechado + allowlist (`allowed_members`) checada pelas RLS policies — a sessão do usuário nunca ignora o RLS — existing
- ✓ Escrita passa por Server Actions no servidor (não direto do navegador pro banco), com validação server-side espelhando as CHECK constraints do banco — existing
- ✓ Deploy contínuo na Vercel a partir da branch `main` — existing

### Active

<!-- Escopo desta fase: estabilizar e documentar, sem feature nova. -->

- [ ] Documentação detalhada do projeto no Obsidian (arquitetura, decisões, modelo de dados, runbooks de segurança) como fonte de verdade principal para consulta humana
- [ ] Fechar itens de robustez/segurança pendentes identificados em `.planning/codebase/CONCERNS.md` (ex.: `console.error` expondo mensagem de erro do Postgres no console do navegador; falta de Error Boundary; Board component grande demais)
- [ ] Ligar "Leaked Password Protection" no painel do Supabase (pendente desde a revisão de segurança anterior)

### Out of Scope

<!-- Visão de longo prazo, explicitamente fora desta fase. -->

- Módulo financeiro (contas a pagar/receber, conciliação, boletos) — visão de longo prazo, não detalhada ainda; entra em fase futura própria
- Módulo de relatórios para tomada de decisão (além dos relatórios operacionais já existentes) — visão de longo prazo, escopo não definido
- Emissão de relatório para declaração de IR dos proprietários — definido como relatório informativo (PDF/planilha com o resumo do aluguel recebido no ano, para o proprietário ou contador preencher manualmente); sem integração oficial com Receita Federal/e-CAC. Fora desta fase.
- SaaS multi-tenant (múltiplas administradoras usando o sistema, cada uma isolada) — visão de longo prazo confirmada como modelo "cada empresa com board isolado". Exige reformar o schema (tenant_id em todas as tabelas) e o RLS (hoje é um allowlist único compartilhado, não pensado para isolar clientes entre si). Fora desta fase, mas ver Key Decisions.
- Ajustes de dados/UX do dia a dia (ex.: preencher endereços reais dos imóveis, hoje duplicados do nome do proprietário desde a importação inicial) — explicitamente fora desta fase por decisão do usuário

## Context

Projeto brownfield: já em produção (Vercel + Supabase), com dados reais de ~46 imóveis. Nasceu de um pedido de planejamento completo (modelagem de dados → scaffold Next.js → board com drag-and-drop → relatórios → alertas/WhatsApp → deploy), seguido por duas rodadas de revisão de segurança que corrigiram um problema crítico (cadastro público aberto + RLS permissivo, que teria exposto todos os dados a qualquer pessoa da internet) e adicionaram allowlist, CHECK constraints, Server Actions e cabeçalhos de segurança.

Ver `.planning/codebase/` para o mapeamento técnico completo (stack, arquitetura, convenções, testes, integrações, riscos conhecidos).

**Ambiente técnico:** Next.js 16.3.0 (App Router) + React 19 + TypeScript, Tailwind CSS 4, Supabase (Postgres + Auth + RLS), deploy na Vercel. Sem testes automatizados hoje — verificação via lint + build + testes manuais no navegador.

## Constraints

- **Segurança**: pilar central do projeto — todo dado sensível (nome, telefone, valor de aluguel de terceiros) protegido por RLS; nenhuma regra de negócio decidida só no frontend
- **Conformidade (LGPD)**: o sistema guarda dados pessoais de proprietários e inquilinos; decisões futuras (SaaS, módulo financeiro) precisam considerar LGPD desde o desenho, não como retrofit
- **Escalabilidade futura**: decisões de schema/arquitetura tomadas hoje não devem inviabilizar a migração futura para multi-tenant — sem precisar implementar multi-tenant agora
- **Design**: visual moderno, consistente com a identidade já definida (cores, tipografia) — ver `docs/` e `web/src/app/globals.css`
- **Usabilidade**: interface precisa ser fácil de usar por usuários leigos (proprietário de imobiliária, não necessariamente técnico) — sem jargão técnico na UI
- **Custo**: hospedagem gratuita (Vercel + Supabase free tier) é uma restrição de origem do projeto

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Documentação principal migra para Obsidian, `.planning/` do GSD fica como rastro técnico interno | Obsidian é markdown puro, versionável, sem dependência de conta/API; público-alvo é o próprio usuário e futura equipe, não colaboração hospedada | — Pending |
| Modelo de SaaS futuro: multi-tenant clássico, cada administradora com board isolado (não um board único com proprietários/inquilinos logando) | Confirmado pelo usuário durante o planejamento; mais simples de raciocinar sobre isolamento de dados (LGPD) do que um modelo com múltiplos papéis de usuário externo | — Pending |
| Módulo de IR será relatório informativo, não integração oficial com Receita Federal | Reduz drasticamente a complexidade regulatória/jurídica do módulo; decisão do usuário | — Pending |
| RLS por allowlist (`allowed_members`) + cadastro público fechado, em vez de apenas `auth.role() = 'authenticated'` | Cadastro público aberto expunha toda a base a qualquer pessoa da internet; corrigido em 2026-08-11 | ✓ Good |
| Escritas via Server Actions com sessão do usuário, não `service_role` | Mantém o RLS como rede de proteção mesmo se a camada de validação nova tiver bug — falha fechada, não aberta | ✓ Good |
| GSD Core (ferramenta de planejamento) instalada localmente, mas seu payload (`.claude/gsd-core`, `commands/`, `agents/`, `hooks/`) fica fora do git | 676 arquivos / ~10,5 MB, maior que o app inteiro; é ferramenta reinstalável (`npx @opengsd/gsd-core@latest`), não conteúdo do projeto | ✓ Good |
| Subagentes customizados do GSD (`gsd-codebase-mapper` etc.) não existem nesta plataforma — adaptados para `general-purpose` com o papel embutido no prompt | Esta plataforma tem um roster fixo de tipos de agente, diferente do Claude Code CLI nativo que o GSD assume | ⚠️ Revisit — funciona, mas exige adaptação manual a cada comando GSD que dependa de subagente dedicado |

## Evolution

Este documento evolui em transições de fase e marcos do projeto.

**Depois de cada transição de fase** (via `/gsd-transition`):
1. Requisito invalidado? → Mover para Out of Scope com o motivo
2. Requisito validado? → Mover para Validated com referência da fase
3. Novo requisito surgiu? → Adicionar em Active
4. Decisão a registrar? → Adicionar em Key Decisions
5. "What This Is" ainda é preciso? → Atualizar se desatualizou

**Depois de cada marco** (via `/gsd-complete-milestone`):
1. Revisão completa de todas as seções
2. Core Value ainda é a prioridade certa?
3. Business Context ainda reflete a realidade (cliente, modelo de receita)?
4. Auditar Out of Scope — os motivos ainda valem?
5. Atualizar Context com o estado atual

---
*Last updated: 2026-08-14 after initialization*
