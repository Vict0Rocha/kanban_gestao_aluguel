-- ============================================================
-- Arquivamento de contrato e backstop contra exclusão com
-- lançamento — Kanban Aluguel (Phase 6.2)
--
-- Implementa D-07 (arquivamento rastreável: public.cards.arquivado_em
-- timestamptz null) e o backstop de banco pedido por D-14/D-15:
-- um trigger que recusa a exclusão de qualquer public.cards que
-- tenha lançamento financeiro (public.parcela_lancamentos) ligado
-- a alguma de suas public.parcelas.
--
-- ESTA MIGRAÇÃO É ESTRITAMENTE ADITIVA. O app está em produção no
-- Vercel + Supabase com ~48 imóveis reais, com parcelas e
-- lançamentos reais, e nenhum ambiente de staging (mesma régua de
-- 20260816000000_financeiro_schema.sql e
-- 20260818000000_cards_numero_sequencial.sql). Nada aqui apaga
-- coluna, apaga tabela, renomeia, troca tipo de coluna existente
-- nem troca o "on delete cascade" de nenhuma FK já existente — só
-- cria uma coluna nova, uma função nova e um trigger novo.
--
-- Também é REEXECUTÁVEL: a coluna usa "add column if not exists",
-- a função usa "create or replace function" e o trigger é
-- derrubado com "drop trigger if exists" antes de ser recriado —
-- rodar esta migração uma segunda vez não erra e não muda nada.
--
-- Runbook operacional que ensaia e prova estas regras contra o
-- banco real, com ensaio em transação revertida e verificação
-- pós-push: supabase/verificacao_cards_arquivado_em.sql
-- ============================================================


-- ------------------------------------------------------------
-- Seção 1 — cards.arquivado_em: quando o contrato foi arquivado
--
-- Nulável por nascimento, SEM default e SEM UPDATE de backfill:
-- nulo já significa "não arquivado" (D-07), então não existe
-- nenhum estado anterior a preencher para os ~48 cards existentes.
-- Como não há UPDATE aqui, o trigger cards_set_updated_at não
-- dispara — o updated_at de nenhum card muda por causa desta
-- migração. É exatamente essa invariante que o runbook confere
-- comparando updated_at_max antes e depois do rollback do ensaio.
--
-- timestamptz em vez de boolean (D-07): a coluna guarda QUANDO o
-- contrato foi arquivado, não só SE foi. Rastreabilidade é barata
-- de desenhar agora e cara de acrescentar depois — um boolean
-- exigiria uma segunda coluna de data no dia em que alguém pedisse
-- "desde quando este contrato está arquivado".
-- ------------------------------------------------------------

alter table public.cards
  add column if not exists arquivado_em timestamptz;


-- ------------------------------------------------------------
-- Seção 1b — por que NÃO existe índice em arquivado_em
--
-- public.cards tem ~48 linhas hoje. Nesse volume o planner do
-- Postgres varre a tabela inteira de qualquer jeito (seq scan é
-- mais barato que usar um índice), então um índice aqui só
-- acrescentaria custo de manutenção em todo insert/update de
-- cards sem devolver ganho nenhum de leitura. Isto é uma decisão
-- deliberada, não um esquecimento — não "consertar" depois sem
-- motivo novo.
--
-- Gatilho explícito para revisitar: se public.cards passar da
-- ordem de milhares de linhas, o primeiro passo é um índice
-- parcial `on public.cards (id) where arquivado_em is not null`
-- (ou equivalente sobre arquivado_em is null, dependendo de qual
-- lado da consulta dominar). O mesmo raciocínio é registrado em
-- docs/data-model.md no plano 06.2-03.
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- Seção 2 — backstop de exclusão contra o cascade (D-14/D-15)
--
-- Hoje public.cards -> public.parcelas -> public.parcela_lancamentos
-- é uma cadeia de "on delete cascade" (20260816000000_financeiro_schema.sql,
-- linhas 47 e 162): apagar um card apaga suas parcelas, que apaga
-- os lançamentos financeiros ligados a elas, sem nenhuma trava.
-- Este trigger é o backstop de banco contra isso — independente de
-- qualquer validação em deleteCardAction (plano 06.2-05), que é a
-- segunda linha de defesa, não a única.
-- ------------------------------------------------------------

create or replace function public.impedir_exclusao_de_card_com_lancamento()
returns trigger
language plpgsql
set search_path = ''
-- security invoker é o padrão do Postgres, declarado aqui por
-- omissão e explicado por escrito: "security definer" seria
-- errado neste trigger. Ele faria o SELECT interno abaixo IGNORAR
-- o RLS de public.parcelas/public.parcela_lancamentos, o que abriria
-- uma pista de "existe lançamento" para quem não deveria nem
-- enxergar a linha de public.cards que está tentando apagar. Com
-- security invoker (o comportamento correto e o default), quem não
-- é public.is_team_member() não consegue nem ver o card para
-- apagar — o trigger nunca chega a rodar para essa pessoa. Não há
-- brecha aqui que privilégio extra precise fechar.
--
-- set search_path = '' exige nomes de tabela totalmente
-- qualificados no corpo abaixo (public.parcelas, não parcelas) —
-- mesma blindagem contra schema malicioso no path já usada em
-- public.set_updated_at() (20260811010000_security_advisor_fixes.sql).
as $$
begin
  if exists (
    select 1
    from public.parcela_lancamentos pl
    join public.parcelas p on p.id = pl.parcela_id
    where p.card_id = old.id
  ) then
    -- Único "raise exception" do schema hoje, por isso o SQLSTATE
    -- default P0001 (raise_exception) é um sinal não ambíguo para
    -- o mapeamento em deleteCardAction/deleteColumnAction (plano
    -- 06.2-05). Se outro "raise exception" for acrescentado ao
    -- schema no futuro, esse mapeamento por SQLSTATE precisa ser
    -- revisitado — não é mais garantido que P0001 só possa vir
    -- daqui.
    --
    -- Esta mensagem normalmente NÃO chega à tela como está: a
    -- Server Action mapeia P0001 para o próprio texto em português
    -- (D-15), com a oferta de arquivar em vez de excluir (D-16).
    raise exception 'Contrato com lançamento financeiro registrado não pode ser excluído. Arquive o contrato em vez de excluir.';
  end if;

  -- O predicado acima é EXATAMENTE o de D-14: qualquer lançamento
  -- de qualquer tipo (pagamento, acréscimo, desconto, destrava e,
  -- no futuro, conciliação — D-17) trava a exclusão. Um card com
  -- parcelas geradas mas ZERO lançamentos passa por aqui e é
  -- apagado normalmente — esta é a metade da regra que um leitor
  -- futuro tende a "consertar" para mais restritiva; não fazer
  -- isso sem reabrir D-14 com o usuário. Nada de valor humano se
  -- perde apagando parcelas só geradas automaticamente.
  --
  -- D-17: a Phase 7 (conciliação) também grava um
  -- public.parcela_lancamentos, então ela entra automaticamente
  -- sob este mesmo predicado — nenhum código novo será necessário
  -- nesta trava quando a Phase 7 chegar, só confirmar.
  return old;
end;
$$;

drop trigger if exists cards_impede_exclusao_com_lancamento on public.cards;

create trigger cards_impede_exclusao_com_lancamento
  before delete on public.cards
  for each row
  execute function public.impedir_exclusao_de_card_com_lancamento();


-- ------------------------------------------------------------
-- Seção 2b — o segundo caminho de cascade: excluir a COLUNA
--
-- public.columns -> public.cards também é "on delete cascade"
-- (20260728000000_init_schema.sql, linha 59), e o diálogo de
-- excluir coluna já avisa que os imóveis daquela coluna serão
-- excluídos junto. Como o trigger acima é "for each row", ele
-- dispara também para cada card apagado por esse cascade — ou
-- seja, apagar uma coluna que contém um contrato com lançamento
-- passa a ser recusado, atomicamente, junto com a transação
-- inteira (nenhum card da coluna é apagado se qualquer um deles
-- tiver lançamento).
--
-- Isto é intencional, não um efeito colateral, e é a razão
-- principal de o backstop existir no BANCO e não só na Server
-- Action de exclusão de card: deleteColumnAction nunca cobriu
-- este caminho de cascade, então sem este trigger o histórico
-- financeiro de um contrato podia ser apagado em silêncio
-- excluindo a coluna, mesmo que deleteCardAction ganhasse uma
-- trava própria no plano 06.2-05. Provado na Prova 2.6 do runbook.
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- Seção 3 — declaração de RLS: nada muda aqui
--
-- Nenhuma policy é criada, alterada ou removida por esta
-- migração. public.cards já está coberta pela policy
-- "team full access cards" (public.is_team_member()) desde
-- 20260811000000_security_hardening.sql, e a coluna arquivado_em
-- herda essa mesma proteção sem precisar de predicado novo — não
-- há coluna sensível nova que exija uma regra de acesso diferente
-- do resto da linha.
--
-- O trigger cards_impede_exclusao_com_lancamento roda como
-- "security invoker" (papel de quem chama), então o SELECT interno
-- dele em public.parcelas/public.parcela_lancamentos é filtrado
-- pelo mesmo RLS que já vale para o usuário que está tentando
-- apagar — nenhum caminho novo de leitura sem RLS é aberto por
-- este trigger.
-- ------------------------------------------------------------
