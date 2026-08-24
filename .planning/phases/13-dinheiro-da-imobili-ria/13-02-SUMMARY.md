---
plan: 13-02
phase: 13-dinheiro-da-imobili-ria
completed: 2026-08-24
---

# Plan 13-02 Summary — Ensaio da migração de dinheiro da imobiliária

## What Was Built

Task 1 (`checkpoint:human-verify`): o usuário rodou a Parte A do runbook
(`supabase/verificacao_dinheiro_imobiliaria.sql`) contra o banco de produção real,
via SQL Editor do Supabase Studio, colando a Parte A inteira (BLOCO 2+3) num único
clique de "Run", seguindo o aviso de pooling D-19. Baseline anotado
(`cards_total=58`, `parcelas_total=551`, `lancamentos_total=43`,
`updated_at_max=2026-08-21 20:49:26.781354+00`).

A execução completa terminou sem nenhum erro visível — o que, pela própria estrutura
do script (cada verificação propaga um `raise exception 'FALHOU: ...'` se uma
CHECK/FK/RLS deixasse passar algo que deveria recusar), é evidência observada de que
as dez recusas de validação e os quatro lados do backstop de exclusão ampliado
funcionaram como esperado. As mensagens individuais `NOTICE` não ficaram visíveis na
interface do SQL Editor (sem painel de logs separado nesta versão) — registrado
honestamente no runbook como limitação de observação, não como lacuna de cobertura.

Duas rodadas extras aconteceram, ambas sem dano: uma com o placeholder de e-mail
ainda não substituído (RLS recusou corretamente o insert de teste, erro `42501`
abortou a transação automaticamente — mesmo efeito do `rollback` explícito, nada
persistiu) e uma terceira, completa, com o e-mail real, confirmando a prova positiva
de RLS. O banco foi conferido limpo (idêntico ao baseline) depois de cada uma das
três rodadas.

Task 2 (`auto`): o bloco `RESULTADO DO ENSAIO` de
`supabase/verificacao_dinheiro_imobiliaria.sql` foi preenchido com o caminho de
execução, o baseline, os ids usados, o veredito de cada prova, o relato honesto das
duas rodadas extras, e a confirmação pós-rollback — idêntica em todas as três
rodadas.

## Requirements Completed
IMOB-01, IMOB-02, IMOB-03, IMOB-04 (base para — nenhum código de aplicação existe
ainda; este plano só prova que o schema, quando aplicado, se comporta como
projetado)

## Deviations from Plan
Nenhum desvio no arquivo de migração nem no runbook — nenhuma correção foi
necessária. As duas rodadas extras (não previstas no fluxo "uma rodada limpa" do
plano) foram causadas por um erro operacional do usuário (placeholder de e-mail não
substituído numa das três vezes), não por um defeito no runbook ou na migração —
registradas por transparência no `RESULTADO DO ENSAIO`, sem impacto no veredito.

## Next Phase Readiness
- `supabase/verificacao_dinheiro_imobiliaria.sql` carrega o registro completo do
  ensaio, commitado no git — base suficiente para o `checkpoint:decision` do plano
  13-03
- Nada foi aplicado em produção — o banco está no estado exato de antes do ensaio
- Próximo: plano 13-03, aplicar a migração de verdade (atrás do checkpoint de
  decisão)

---
*Phase: 13-dinheiro-da-imobili-ria*
*Completed: 2026-08-24*
