# Requirements: Kanban Aluguel

**Defined:** 2026-08-14
**Core Value:** Dar visibilidade e controle sobre a situação de cada contrato de aluguel — quem está em dia, quem está vencendo, quem precisa de contato — sem depender de planilha.

## v1 Requirements

Requisitos desta fase: estabilizar e documentar, sem feature nova de produto.

### DOCS

- [x] **DOCS-01**: Documentação completa do projeto publicada num vault Obsidian — arquitetura, decisões-chave, modelo de dados, runbooks de segurança. 22 notas em `kanba aluguel/`, entrada única (`Kanban Aluguel.md`), guia dedicado para agentes de IA
- [x] **DOCS-02**: A suposição de "board único, sem isolamento entre clientes" está documentada, junto com o caminho de migração necessário para SaaS multi-tenant. Ver `Políticas RLS.md#Limitação: board único`
- [x] **DOCS-03**: A dependência da proteção CSRF automática do Next.js Server Actions está documentada para futuros mantenedores. Coberto em `Modelo de Segurança.md` — nota: ficou breve (uma linha de tabela), pode ser encorpado se necessário

### SEC

- [x] **SEC-01**: ~~Mensagens de erro do Postgres não aparecem no console do navegador em produção~~ — **já era verdade; requisito nasceu de um falso positivo**. Verificado em 2026-08-14: os 9 `console.error` apontados estão em `web/src/lib/kanban/actions.ts`, que é `"use server"` — rodam no servidor e vão para os logs da Vercel, nunca para o navegador. O que chega ao cliente passa por `erroDoBanco()`, que mapeia apenas o *código* do erro (`23514`, `23503`, `PGRST116`) para uma frase em português; o objeto de erro cru do Supabase não sai do servidor. Busca por `error.message`/`error.details`/`error.hint`/`JSON.stringify(error)` em todo o `src/` encontrou só [board.tsx:106](../web/src/components/kanban/board.tsx:106), lendo a mensagem já sanitizada. Nenhuma mudança de código foi necessária.
- [ ] **SEC-02**: "Leaked Password Protection" está ligado no Supabase Auth — pendente de verdade, requer ação no painel. Usuário optou por não mexer em configuração de segurança por enquanto (2026-08-14)
- [x] **SEC-03**: ~~Verificação de e-mail está ligada no Supabase Auth~~ — **já era verdade; requisito nasceu de outro falso positivo do mesmo `CONCERNS.md`**. Verificado em 2026-08-14 via `GET /auth/v1/settings`: `mailer_autoconfirm: false`, ou seja, o Supabase **exige** confirmação de e-mail, não confirma automaticamente. Nenhuma ação necessária.

### ROBUST

- [x] **ROBUST-01**: Um erro de renderização em um componente do board não derruba a tela inteira — existe um Error Boundary com opção de recarregar. Implementado com `error.tsx` do App Router em dois níveis (raiz e grupo `(app)`) — nesta versão do Next a prop é `retry`, não `reset`.
- [x] **ROBUST-02**: Quando o board aparece vazio por o usuário não estar na allowlist, uma mensagem explica o motivo em vez de silêncio. Implementado no `(app)/layout.tsx` via `supabase.rpc("is_team_member")`. ⚠️ Verificado por lint/build e por simetria com queries já existentes no mesmo Server Component — **não verificado com uma sessão autenticada real**, ver nota abaixo.

## v2 Requirements

Reconhecidos, mas fora do roadmap desta fase.

### TEST

- **TEST-01**: Testes para as funções de validação em `actions.ts` (`textoObrigatorio`, `validarValor`, `validarTelefone`, `validarPeriodo`, `validarDetalhes`)
- **TEST-02**: Testes de integração para RLS + Server Actions (caminho feliz, negação por allowlist, input malformado)
- **TEST-03**: Testes E2E do fluxo principal (login → criar card → editar → excluir)

### REFACTOR

- **REFACTOR-01**: Extrair lógica de busca e de escrita-otimista do componente Board (385 linhas) para hooks dedicados
- **REFACTOR-02**: Centralizar utilidades de data (`lib/kanban/date.ts`) para eliminar formatação inline duplicada

## Out of Scope

| Feature | Reason |
|---------|--------|
| Rate limiting em Server Actions | Prematuro na escala atual (uso interno, poucos usuários); reconsiderar se abrir para múltiplos clientes |
| Paginação de cards / busca otimizada (Trie, fuse.js) | Performático até milhares de cards; hoje são ~46 |
| Auditoria de negações do RLS | Baixa prioridade no estágio atual; útil quando o sistema escalar |
| Memoização do cálculo de alertas | Otimização prematura no volume atual de dados |
| Módulo financeiro | Visão de longo prazo, fora desta fase — ver PROJECT.md |
| Relatórios de tomada de decisão (além dos já existentes) | Visão de longo prazo, fora desta fase |
| Módulo de declaração de IR | Visão de longo prazo, fora desta fase — formato definido como relatório informativo, sem integração oficial |
| SaaS multi-tenant | Visão de longo prazo, exige reforma de schema/RLS — ver PROJECT.md Key Decisions |

## Traceability

Preenchido na criação do roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Complete (falso positivo — nada a corrigir) |
| SEC-02 | Phase 1 | Pending — depende de ação do usuário no painel, adiado por escolha dele |
| SEC-03 | Phase 1 | Complete (falso positivo — nada a corrigir) |
| ROBUST-01 | Phase 2 | Complete |
| ROBUST-02 | Phase 2 | Complete — código escrito, aguarda confirmação com login real |
| DOCS-01 | Phase 3 | Complete |
| DOCS-02 | Phase 3 | Complete |
| DOCS-03 | Phase 3 | Complete (breve, pode encorpar) |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0 ✓
- Complete: 7 de 8 — só SEC-02 resta, e depende de uma ação que o usuário optou por adiar

**Nota de calibragem:** `SEC-01` e `SEC-03` vieram de `.planning/codebase/CONCERNS.md`, gerado por um modelo rápido (haiku) que confundiu código `"use server"` com código `"use client"` e não checou a configuração real do Supabase antes de afirmar que a verificação de e-mail estava desligada. **Dois de dois** achados de segurança daquele documento que foram verificados se provaram falsos. Os itens restantes devem ser tratados como **hipóteses a verificar**, não como fatos — vários são reais (allowlist silenciosa, schema inicial permissivo), mas cada um merece confirmação antes de virar trabalho.

---
*Requirements defined: 2026-08-14*
*Last updated: 2026-08-14 after Phase 2 e Phase 3 completion*
