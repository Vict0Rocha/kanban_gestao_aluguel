---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 1
total_count: 2
last_updated: 2026-08-26T15:31:46.968Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 06.1 | deviation | supabase/verificacao_cards_numero.sql |  | Ensaio da migração cards.numero não ficou confinado a transação revertida: connection pooling do Supabase Studio SQL Editor commitou a migração de verdade em produção; usuário aceitou explicitamente como aplicada em vez de reverter | fixed |  | 2026-08-18T19:17:11.819Z | 2026-08-18T19:17:51.440Z |
| 2 | 14 | unrun-verify | .planning/phases/14-cancelamento-de-taxas-e-cau-o/14-04-PLAN.md |  | Task 3 (checkpoint:human-verify, gate=blocking) da 14-04 pendente: taxa visivel/cancelavel e cascata pagamento->taxa precisam ser confirmadas em producao via SQL | open |  | 2026-08-26T15:31:46.968Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "06.1",
    "file": "supabase/verificacao_cards_numero.sql",
    "line": null,
    "description": "Ensaio da migração cards.numero não ficou confinado a transação revertida: connection pooling do Supabase Studio SQL Editor commitou a migração de verdade em produção; usuário aceitou explicitamente como aplicada em vez de reverter",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-18T19:17:11.819Z",
    "resolved_at": "2026-08-18T19:17:51.440Z"
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "14",
    "file": ".planning/phases/14-cancelamento-de-taxas-e-cau-o/14-04-PLAN.md",
    "line": null,
    "description": "Task 3 (checkpoint:human-verify, gate=blocking) da 14-04 pendente: taxa visivel/cancelavel e cascata pagamento->taxa precisam ser confirmadas em producao via SQL",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T15:31:46.968Z",
    "resolved_at": null
  }
]
````

