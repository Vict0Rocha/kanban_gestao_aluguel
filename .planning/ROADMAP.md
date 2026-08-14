# Roadmap: Kanban Aluguel

## Overview

Esta fase estabiliza e documenta o Kanban Aluguel sem adicionar features novas. Primeiro fecha as pendências de segurança e robustez identificadas em `.planning/codebase/CONCERNS.md`, depois publica a documentação completa do projeto num vault Obsidian — nessa ordem para que os documentos capturem o estado final, já corrigido, em vez de precisarem de retrabalho depois.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Fechar pendências de segurança** - Erros do Postgres deixam de vazar pro console; toggles de segurança do Supabase Auth ligados
- [ ] **Phase 2: Robustez de interface** - Board sobrevive a erro de renderização; usuário fora da allowlist entende por que o board está vazio
- [ ] **Phase 3: Documentação no Obsidian** - Arquitetura, decisões, modelo de dados e runbooks de segurança publicados como fonte de verdade

## Phase Details

### Phase 1: Fechar pendências de segurança
**Goal**: Nenhum dos itens de segurança identificados em CONCERNS.md continua pendente
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03
**Success Criteria** (what must be TRUE):
  1. Uma escrita rejeitada pelo banco (constraint ou RLS) não produz nenhuma mensagem de erro do Postgres no console do navegador em produção
  2. "Leaked Password Protection" aparece ativado no painel do Supabase Auth
  3. Verificação de e-mail aparece ativada no painel do Supabase Auth
**Plans**: TBD

Plans:
- [ ] 01-01: TBD

### Phase 2: Robustez de interface
**Goal**: A interface se recupera de erros em vez de quebrar silenciosamente ou travar o usuário sem explicação
**Mode:** mvp
**Depends on**: Nothing (independente da Phase 1, sequenciada depois por convenção)
**Requirements**: ROBUST-01, ROBUST-02
**Success Criteria** (what must be TRUE):
  1. Um erro de renderização dentro do board mostra uma tela de recuperação com opção de recarregar, em vez de página em branco
  2. Um usuário que faz login sem estar na allowlist vê uma mensagem explicando por que o board está vazio, em vez de silêncio
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Documentação no Obsidian
**Goal**: O projeto tem uma fonte de verdade legível por humanos, cobrindo arquitetura, decisões e segurança
**Mode:** mvp
**Depends on**: Phase 1, Phase 2 (a documentação deve refletir o estado já corrigido, não um alvo em movimento)
**Requirements**: DOCS-01, DOCS-02, DOCS-03
**Success Criteria** (what must be TRUE):
  1. O vault Obsidian tem páginas cobrindo arquitetura, decisões-chave, modelo de dados e runbooks de segurança
  2. A suposição de "board único, sem isolamento entre clientes" e o caminho de migração para SaaS multi-tenant estão documentados
  3. A dependência da proteção CSRF automática do Next.js Server Actions está documentada para futuros mantenedores
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fechar pendências de segurança | 0/? | Not started | - |
| 2. Robustez de interface | 0/? | Not started | - |
| 3. Documentação no Obsidian | 0/? | Not started | - |
