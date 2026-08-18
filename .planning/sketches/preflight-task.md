# Tarefa paralela — Levantamento de impacto antes de habilitar geração retroativa de parcelas

## Contexto

Este é o projeto Kanban Aluguel (Next.js + Supabase). Estou abrindo uma nova sessão do Claude Code no mesmo repositório para rodar esta tarefa em paralelo com outra sessão que está formalizando uma nova fase no roadmap GSD (`.planning/ROADMAP.md`).

A nova fase vai mudar a regra de geração automática de parcelas (`web/src/lib/kanban/parcelas.ts`, função `garantirParcelas`/`competenciasAlvo`, ver `.planning/phases/05-aba-financeiro-com-parcelas-autom-ticas/05-01-SUMMARY.md` para como funciona hoje):

- **Hoje**: gera só a parcela do mês atual + próximo mês, para todo contrato com `cards.ativo = true`.
- **Regra nova, já decidida com o usuário**: se o contrato tiver **as duas datas** (`periodo_inicio` E `periodo_fim`) preenchidas, o sistema vai gerar **todas** as parcelas do período inteiro do contrato — incluindo meses **já passados** (geração retroativa/backfill). Se faltar qualquer uma das duas datas, continua gerando só mês atual + próximo, como hoje.

**Isso pode criar bastante parcela "Vencida" de uma vez em produção**, para contratos antigos com as duas datas já cadastradas. Antes dessa regra ser implementada e rodar contra o banco real, preciso saber o tamanho do impacto.

## Sua tarefa

Rode as consultas SQL abaixo no **SQL Editor do Supabase de produção** deste projeto (mesmo banco usado nas fases anteriores — ver `docs/data-model.md` e `supabase/verificacao_financeiro.sql` para o estilo de runbook já usado no projeto, se quiser se situar). São todas **só leitura**, não alteram nada.

Se preferir, pode pedir para o usuário rodar e colar o resultado — ele já fez isso várias vezes nesta sessão e sabe o caminho (Dashboard → SQL Editor).

```sql
-- (1) Quantos contratos ativos têm as DUAS datas preenchidas (esses serão
-- afetados pela geração retroativa) vs. só uma vs. nenhuma
select
  count(*) filter (where periodo_inicio is not null and periodo_fim is not null) as com_periodo_completo,
  count(*) filter (where periodo_inicio is not null and periodo_fim is null)     as so_inicio,
  count(*) filter (where periodo_inicio is null and periodo_fim is not null)     as so_fim,
  count(*) filter (where periodo_inicio is null and periodo_fim is null)         as sem_nenhuma_data,
  count(*)                                                                       as total_ativos
from public.cards
where ativo = true;

-- (2) Para os contratos com período completo: quantos meses cada um cobre
-- (do início até hoje, que é o que a geração retroativa criaria), e o total
-- somado de parcelas novas que a mudança geraria de uma vez
select
  c.id as card_id,
  c.proprietario,
  c.endereco,
  c.periodo_inicio,
  c.periodo_fim,
  greatest(
    0,
    (extract(year from age(least(c.periodo_fim, current_date), c.periodo_inicio)) * 12
     + extract(month from age(least(c.periodo_fim, current_date), c.periodo_inicio)) + 1)::int
  ) as meses_ja_passados_ate_hoje
from public.cards c
where c.ativo = true
  and c.periodo_inicio is not null
  and c.periodo_fim is not null
order by meses_ja_passados_ate_hoje desc;

-- (3) Soma total — quantas parcelas novas a geração retroativa criaria de
-- uma vez só, somando todos os contratos com período completo
select sum(
  greatest(
    0,
    (extract(year from age(least(c.periodo_fim, current_date), c.periodo_inicio)) * 12
     + extract(month from age(least(c.periodo_fim, current_date), c.periodo_inicio)) + 1)::int
  )
) as total_parcelas_retroativas_estimadas
from public.cards c
where c.ativo = true
  and c.periodo_inicio is not null
  and c.periodo_fim is not null;

-- (4) Quantas dessas parcelas retroativas já existem hoje (geradas pela
-- regra antiga, mês atual/próximo) — para saber quantas são REALMENTE
-- novas, não recontar as que já foram criadas
select count(*) as parcelas_ja_existentes
from public.parcelas p
join public.cards c on c.id = p.card_id
where c.ativo = true
  and c.periodo_inicio is not null
  and c.periodo_fim is not null;
```

## O que fazer com o resultado

Depois de rodar, resuma em texto simples:
- Quantos contratos têm período completo (query 1)
- Qual o maior número de meses de um único contrato (query 2, olhando a primeira linha — está ordenado do maior para o menor)
- O total estimado de parcelas novas que a mudança criaria de uma vez (query 3)
- Quantas já existem hoje, para eu saber o incremento real (query 4)

**Não implemente nada de código.** Esta tarefa é só levantamento de dados — a implementação da regra nova está sendo planejada na outra sessão, que vai usar esse número para decidir se precisa de algum cuidado extra (ex.: um checkpoint de confirmação antes de rodar, parecido com o que foi feito na migração da Phase 4).

Quando terminar, me diga o resultado — ou cole na outra aba, que é a que está com o contexto completo do projeto.
