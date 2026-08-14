# Requirements: Kanban Aluguel

**Defined:** 2026-08-14
**Core Value:** Dar visibilidade e controle sobre a situação de cada contrato de aluguel — quem está em dia, quem está vencendo, quem precisa de contato — sem depender de planilha.

## v1 Requirements

Requisitos desta fase: estabilizar e documentar, sem feature nova de produto.

### DOCS

- [ ] **DOCS-01**: Documentação completa do projeto publicada num vault Obsidian — arquitetura, decisões-chave, modelo de dados, runbooks de segurança
- [ ] **DOCS-02**: A suposição de "board único, sem isolamento entre clientes" está documentada, junto com o caminho de migração necessário para SaaS multi-tenant quando isso entrar em pauta
- [ ] **DOCS-03**: A dependência da proteção CSRF automática do Next.js Server Actions está documentada para futuros mantenedores

### SEC

- [ ] **SEC-01**: Mensagens de erro do Postgres (violação de constraint, negação de RLS) não aparecem mais no console do navegador em produção
- [ ] **SEC-02**: "Leaked Password Protection" está ligado no Supabase Auth
- [ ] **SEC-03**: Verificação de e-mail está ligada no Supabase Auth

### ROBUST

- [ ] **ROBUST-01**: Um erro de renderização em um componente do board não derruba a tela inteira — existe um Error Boundary com opção de recarregar
- [ ] **ROBUST-02**: Quando o board aparece vazio por o usuário não estar na allowlist, uma mensagem explica o motivo em vez de silêncio

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
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| SEC-03 | Phase 1 | Pending |
| ROBUST-01 | Phase 2 | Pending |
| ROBUST-02 | Phase 2 | Pending |
| DOCS-01 | Phase 3 | Pending |
| DOCS-02 | Phase 3 | Pending |
| DOCS-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-14*
*Last updated: 2026-08-14 after roadmap creation*
