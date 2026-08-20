# Phase 7: Conciliação e destrava rastreada - Discussion Log

**Date:** 2026-08-20

## Areas Presented

1. Fricção do Conciliar
2. Parcela travada, visual
3. Contrato inativo/arquivado
4. Nenhum — segue no seu critério

**User selected:** "Fricção do Conciliar" + "Nenhum — segue no seu critério" (discutir só o primeiro, resto por conta do Claude)

## Area 1: Fricção do Conciliar

**Question:** Ao clicar em "Conciliar" numa parcela paga, qual nível de fricção?

**Options presented:**
- Um clique direto (recomendado)
- Popup de confirmação simples
- Depende do estado da parcela

**User's answer:** Um clique direto (recomendado)

**Resolution:** D-07 em CONTEXT.md — mesmo padrão de Pagamento/Ajustar hoje, sem confirmação extra, já que Destravar existe como caminho de correção.

## Claude's Discretion (áreas não selecionadas para discussão)

- **Parcela travada, visual** — badge `conciliada` já existe (`parcela-situacao-badge.tsx`, ícone `Lock`); forma exata dos botões Pagamento/Ajustar/Destravar na linha fica para a UI-SPEC (D-08).
- **Contrato inativo/arquivado** — conciliar/destravar continuam disponíveis independente do estado do contrato, mesma filosofia de D-01/D-05 da Phase 6.2 (D-09).

## Deferred Ideas

None — nenhuma ideia de escopo novo surgiu durante a discussão.
