# Sketch Manifest

## Design Direction

Extensão da aba Financeiro (já em produção desde a Phase 5/6) com uma camada de consulta/filtros, inspirada em ERPs profissionais como o Sienge — mas sem introduzir um sistema visual novo. Tema do sketch espelha 1:1 os tokens reais de `web/src/app/globals.css` (verde `#74ac1c`, Sora/Plus Jakarta Sans, claro e escuro), porque a pergunta não é "como deveria ser o visual" — isso já está decidido — e sim "como a busca se encaixa no que já existe".

## Reference Points

- Sienge (ERP de gestão imobiliária/construção) — telas de "Consulta de parcelas" e filtros de contrato, enviadas pelo usuário como referência de densidade de filtro e fluxo de consulta → baixa.
- O próprio app (Phase 5/6 já aprovadas) — seletor Mês atual/Próximo mês, badges de situação, coluna de Ações — é a base que não pode ser contradita, só estendida.

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | consulta-financeiro | Onde os filtros (proprietário, inquilino, período, ID) ficam sem competir com o seletor Mês atual/Próximo mês já em produção? | B — filtros atrás de um botão; seletor Mês atual/Próximo mês **removido**, substituído por padrão "Vencendo hoje" | financeiro, filtros, consulta, layout |
