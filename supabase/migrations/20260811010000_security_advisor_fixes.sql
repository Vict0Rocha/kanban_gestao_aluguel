-- ============================================================
-- Avisos do Security Advisor do Supabase
--
-- RODE UM BLOCO DE CADA VEZ. O BLOCO 3 é verificação e decide
-- se a mudança pode ficar.
-- ============================================================


-- ============================================================
-- BLOCO 1 — search_path fixo em set_updated_at
--
-- Sem SET search_path, um schema malicioso na frente do path
-- poderia sequestrar as funções chamadas dentro do corpo.
-- Aqui o corpo só chama now() (pg_catalog, sempre implícito),
-- então search_path = '' é seguro.
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- BLOCO 2 — Tirar as funções do alcance da API REST
--
-- handle_new_user() é função de trigger: dispara sozinha quando
-- nasce um usuário em auth.users. Ninguém precisa poder chamá-la.
--
-- is_team_member() PRECISA continuar executável por authenticated:
-- as policies de RLS a chamam, e policy roda com as permissões de
-- quem consulta. Revogar de authenticated derruba o board inteiro.
-- Por isso aqui só o anon perde o acesso.
--
-- Revogar EXECUTE não afeta triggers: o Postgres checa essa
-- permissão em CREATE TRIGGER, não a cada linha.
-- ============================================================

revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.is_team_member() from public, anon;
grant  execute on function public.is_team_member() to authenticated;


-- ============================================================
-- BLOCO 3 — VERIFICAÇÃO (rode sozinho, não altera nada)
--
-- Simula um usuário da allowlist e confirma que o RLS ainda
-- consegue avaliar is_team_member(). Se isto falhar com
-- "permission denied for function", rode o BLOCO 4.
--
-- Troque o e-mail pelo seu, igual ao de auth.users.
-- ============================================================

begin;

set local role authenticated;
set local request.jwt.claims to '{"email":"SEU-EMAIL-DA-ALLOWLIST@exemplo.com","role":"authenticated"}';

-- Deve devolver as contagens reais (46 imóveis etc.), não erro
select 'cards' as tabela, count(*) from public.cards
union all
select 'columns', count(*) from public.columns;

rollback;


-- ============================================================
-- BLOCO 4 — ROLLBACK (só se o BLOCO 3 der permission denied)
-- ============================================================

/*
grant execute on function public.is_team_member() to authenticated, anon;
grant execute on function public.handle_new_user() to authenticated, anon;
*/
