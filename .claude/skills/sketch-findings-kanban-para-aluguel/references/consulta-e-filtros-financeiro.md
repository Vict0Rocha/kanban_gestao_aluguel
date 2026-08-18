# Consulta e Filtros — aba Financeiro

## Design Decisions

- **Visão padrão: "Vencendo hoje", não mais Mês atual/Próximo mês.** O seletor de mês da Phase 5 é removido, não escondido. Ao entrar em `/financeiro` sem nenhum filtro aplicado, a lista mostra só as parcelas cujo `vencimento` é a data de hoje.
- **Filtros atrás de um botão ("Filtrar"), não uma barra sempre visível.** Testadas duas variantes (A: barra densa sempre visível, estilo Sienge; B: painel colapsável atrás de um botão) — **B venceu**. Mantém a tela calma no caso comum (conferir o que vence hoje) e só expõe o formulário de busca quando o usuário pede.
- **Quatro campos de filtro, todos opcionais**: Proprietário (texto, contém), Inquilino (texto, contém), Período (mês/vencimento), ID do contrato (número). Combinam em E lógico — preencher dois campos restringe mais, nunca amplia.
- **Aplicar um filtro substitui a visão padrão pelo resultado** — não há estado com os dois misturados. O cabeçalho muda de "Vencendo hoje" para "Resultado da busca". Limpar os filtros volta ao padrão.
- **Nova pílula de ID do contrato** (`#1`, `#2`, `#3`…) — pequena, `border-radius: 999px`, fundo `--secondary`, texto `--secondary-foreground`, `font-weight: 700`, números tabulares. Aparece na consulta do Financeiro e (fora do escopo deste sketch, mas confirmado com o usuário) também no card do Board — lá precisa ficar discreta o bastante para não competir com `valor`, que é o foco visual do card.
- **Dois estados vazios distintos**, já testados no sketch: "Nenhuma parcela vence hoje. Use os filtros para consultar outro período." (padrão sem filtro) vs. "Nenhuma parcela encontrada para os filtros aplicados." (filtro sem resultado). Não usar o mesmo texto para os dois.
- **Nenhum token novo de cor/tipografia/espaçamento** — o sketch reusa 1:1 os tokens reais do app (ver Origin), incluindo o padrão de botões (`btn-primary`/`btn-outline`/`btn-ghost`) e o switcher (`bg-muted` track, segmento ativo `bg-card` com sombra, nunca a cor de destaque da marca) já estabelecido nas Phases 5/6.

## CSS Patterns

```css
/* Botão de filtro colapsável — toggle max-height, não display:none,
   para a transição ficar suave */
.filter-drawer {
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.25s ease, opacity 0.2s ease, margin 0.25s ease;
  opacity: 0;
}
.filter-drawer.open {
  max-height: 240px;
  opacity: 1;
  margin-bottom: 16px;
}

/* Pílula de ID sequencial */
.id-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--secondary);
  color: var(--secondary-foreground);
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* Campo de filtro — mesmo padrão de input já usado no resto do app */
.filter-field label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted-foreground);
  margin-bottom: 4px;
}
.filter-field input, .filter-field select {
  width: 100%;
  font-size: 14px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--background);
  color: var(--foreground);
  transition: all 0.15s ease;
}
.filter-field input:focus {
  outline: none;
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 20%, transparent);
}
```

## HTML Structures

```html
<!-- Cabeçalho da lista: título + contador dinâmico + botão de filtro -->
<div style="display:flex; align-items:center; justify-content: space-between;">
  <div>
    <span class="heading">Vencendo hoje</span>          <!-- ou "Resultado da busca" -->
    <span class="subheading">18/08/2026</span>            <!-- vazio quando filtrado -->
  </div>
  <div style="display:flex; align-items:center; gap:12px;">
    <span class="result-count"></span>                    <!-- "N resultado(s) para a busca" -->
    <button class="btn btn-outline btn-sm" onclick="toggleDrawer()">🔍 Filtrar</button>
  </div>
</div>

<!-- Painel de filtro colapsável — 4 campos + Consultar/Limpar -->
<div class="filter-drawer panel">
  <div style="display:grid; grid-template-columns: repeat(4, 1fr) auto; gap:12px; align-items:end;">
    <div class="filter-field"><label>Proprietário</label><input type="text"></div>
    <div class="filter-field"><label>Inquilino</label><input type="text"></div>
    <div class="filter-field"><label>Período (vencimento)</label><input type="month"></div>
    <div class="filter-field"><label>ID do contrato</label><input type="text"></div>
    <div style="display:flex; gap:8px;">
      <button class="btn btn-primary">Consultar</button>
      <button class="btn btn-ghost">Limpar</button>
    </div>
  </div>
</div>

<!-- Coluna ID na tabela -->
<td><span class="id-pill">#1</span></td>
```

## Interaction Logic (validado no sketch, `index.html`)

- Filtro é aplicado só ao clicar "Consultar" (não em tempo real a cada tecla) — evita repaint excessivo e corresponde ao padrão "consulta", não "busca instantânea".
- Os 4 campos combinam em AND: `if (prop && !match) return false` encadeado para cada campo preenchido; campos vazios não entram na comparação.
- "Limpar" reseta todos os campos E volta ao estado padrão (não deixa a tabela vazia).
- Trocar o cabeçalho (`Vencendo hoje` ↔ `Resultado da busca`) e o subtítulo (data ↔ vazio) é o sinal visual principal de "estou vendo o padrão" vs. "estou vendo um resultado filtrado" — mais importante que qualquer outro indicador.

## What to Avoid

- **Variante A (barra de filtros sempre visível) foi rejeitada.** Mantinha a tela "cheia" desde o primeiro segundo, competindo visualmente com o que o usuário mais olha no dia a dia (o que vence hoje). Não reintroduzir esse padrão sem nova validação.
- **Não usar `display: none` para o drawer de filtro** — a transição de altura (`max-height`) é o que faz a abertura/fechamento parecer intencional; um corte abrupto quebra a sensação de painel.
- **Não usar a cor de destaque da marca (`--primary`) nos controles de filtro** — ela já está reservada (link ativo da navegação, pílula ativo/inativo do card, botão de confirmação de diálogo) e um uso a mais competiria por atenção.

## Origin

Synthesized from sketch: 001 (variant B, winner)
Source files available in: `sources/001-consulta-financeiro/index.html`, `sources/themes/default.css`
Tema do sketch espelha 1:1 `web/src/app/globals.css` — não é uma proposta visual nova.
