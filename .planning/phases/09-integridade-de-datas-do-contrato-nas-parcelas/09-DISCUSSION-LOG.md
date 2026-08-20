# Phase 9: Integridade de datas do contrato nas parcelas - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-20
**Phase:** 09-integridade-de-datas-do-contrato-nas-parcelas
**Areas discussed:** Nenhuma (usuário respondeu "sem preferência" no menu de seleção)

---

## Decisões tomadas antes desta sessão formal de discussão

Estas não foram reabertas — vieram direto da conversa que originou a fase, incluindo uma consulta SQL real contra produção.

### Apagar vs. só esconder as parcelas órfãs

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Apagar de verdade do banco | Exclusão permanente das órfãs sem pagamento/lançamento | ✓ |
| Só esconder, nunca apagar (recomendado por Claude) | Mantém D-03 já documentado; reversível | |

**Escolha do usuário:** "Apagar de verdade do banco"
**Notas:** Contraria a decisão D-03 já documentada em `docs/data-model.md`, que o próprio usuário havia dado na Phase 6.2. Confirmada mesmo depois de eu apontar o conflito diretamente. Razão dada: evitar "informações soltas e desnecessárias no banco de dados".

### Verificar dado existente em produção antes de desenhar a lógica

| Opção | Descrição | Selecionada |
|-------|-----------|-------------|
| Sim, verificar antes (recomendado) | Query read-only pra achar órfãs já existentes | ✓ |
| Não, só corrigir daqui pra frente | Ignora o que já existe | |

**Escolha do usuário:** "Sim, verificar antes"
**Notas:** Query executada contra produção pelo usuário — achou 27 parcelas órfãs em 2 contratos ("A", "outro"), todas `status='aberta'` sem lançamento. Confirma que o problema é real, não hipotético. A segunda query (parcelas protegidas fora do período) não teve resultado confirmado pelo usuário — tratado como não-bloqueante, já que protegidas nunca são tocadas de qualquer forma.

---

## Menu de seleção de áreas (sessão formal desta skill)

| Área | Descrição | Selecionada |
|------|-----------|-------------|
| Quando a poda acontece | Síncrono no salvar vs. preguiçoso na leitura | |
| Avisar antes de apagar | Confirmação vs. silencioso | |
| O que conta como "sem data" | Só as duas vazias vs. também prazo indeterminado | |
| Limpeza das 27 órfãs já existentes | Mesmo plano vs. separado | |

**Escolha do usuário:** "Sem preferência" (nenhuma área selecionada)
**Notas:** Usuário optou por deixar as quatro decisões a critério de Claude. Ver CONTEXT.md § Claude's Discretion (D-04 a D-08) para as decisões tomadas e o raciocínio de cada uma.

---

## Claude's Discretion

- **D-04** (quando a poda roda): síncrona, dentro de `updateCardAction`, só quando as datas de fato mudam.
- **D-05** (confirmação antes de apagar): aviso com contagem + clique de confirmação só quando a edição de fato apaga alguma parcela; sem fricção nova no caso comum (zero parcelas afetadas).
- **D-06** ("sem data" — escopo): só quando as duas datas estão vazias; contrato de prazo indeterminado (só `periodo_inicio`) mantém o comportamento atual (atual + próximo mês).
- **D-07** (retroatividade da mudança de D-06): não apaga parcela de "próximo mês" já gerada antes desta fase para contrato sem data.
- **D-08** (limpeza das 27 órfãs): entra no mesmo plano de execução, via script SQL revisável pelo usuário — não uma migração que apaga sem mostrar antes.

## Deferred Ideas

- **Página dedicada de Relatório Financeiro** (botão próprio, rota nova, filtro dinâmico ao vivo, lista de contratos, exportação em PDF) — pedido pelo usuário na mesma conversa, mas é capacidade nova, não integridade de dado. Vira Phase 10.
- **Ativo/inativo também apagando** — não pedido; toggle continua só escondendo (Phase 6.2), sem mudança nesta fase.
