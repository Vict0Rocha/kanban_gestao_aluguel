-- ============================================================
-- Hardening de segurança — Kanban Aluguel
--
-- RODE UM BLOCO DE CADA VEZ, na ordem. Não cole o arquivo
-- inteiro de uma vez: os blocos 1, 3 e 5 são verificações cujo
-- resultado decide se você pode seguir para o próximo.
--
-- No SQL Editor você pode selecionar só um trecho com o mouse
-- e apertar Run — ele executa apenas o que estiver selecionado.
-- ============================================================


-- ============================================================
-- BLOCO 1 — VERIFICAÇÃO (rode sozinho, não altera nada)
-- Descobre o e-mail exato de cada usuário do sistema.
-- Anote os e-mails EXATAMENTE como aparecerem aqui.
-- ============================================================

select id, email, created_at
from auth.users
order by created_at;


-- ============================================================
-- BLOCO 2 — Cria a allowlist
-- ANTES DE RODAR: troque a lista de e-mails abaixo pelos que
-- apareceram no BLOCO 1. Copie e cole, não digite de memória.
-- ============================================================

create table if not exists public.allowed_members (
  email text primary key,
  added_at timestamptz not null default now()
);

alter table public.allowed_members enable row level security;
-- Sem policy de select: ninguém lê essa tabela pelo cliente.
-- Você gerencia os membros aqui pelo SQL Editor.

insert into public.allowed_members (email) values
  ('seu-email@exemplo.com')   -- <<< troque pelo que veio no BLOCO 1
  -- , ('colega@empresa.com') -- <<< adicione a equipe
on conflict (email) do nothing;


create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allowed_members
    where email = (select auth.jwt() ->> 'email')
  );
$$;


-- ============================================================
-- BLOCO 3 — VERIFICAÇÃO CRÍTICA (rode sozinho)
--
-- Mostra cada usuário real e se ele está coberto pela allowlist.
-- TODAS as linhas precisam vir com esta_na_allowlist = true.
--
-- Se alguma vier false e você seguir para o BLOCO 4, essa pessoa
-- perde o acesso ao app. Volte ao BLOCO 2 e corrija o e-mail.
-- ============================================================

select
  u.email                        as email_no_auth,
  (a.email is not null)          as esta_na_allowlist
from auth.users u
left join public.allowed_members a on a.email = u.email
order by esta_na_allowlist, u.email;


-- ============================================================
-- BLOCO 4 — Troca as policies (só rode com o BLOCO 3 todo true)
--
-- Sai: "qualquer um autenticado pode tudo"
-- Entra: "só quem está na allowlist pode"
-- ============================================================

drop policy if exists "team full access boards"     on public.boards;
drop policy if exists "team full access columns"    on public.columns;
drop policy if exists "team full access cards"      on public.cards;
drop policy if exists "team full access alerts"     on public.alerts;
drop policy if exists "profiles: authenticated read" on public.profiles;

create policy "team full access boards"
  on public.boards for all to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team full access columns"
  on public.columns for all to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team full access cards"
  on public.cards for all to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

create policy "team full access alerts"
  on public.alerts for all to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- profiles: cada um enxerga só o próprio registro
create policy "profiles: self read"
  on public.profiles for select to authenticated
  using (auth.uid() = id);


-- >>> PARE AQUI e abra o app. Faça login e confirme que os cards
-- >>> aparecem normalmente. Só continue depois disso.
-- >>> Se o board aparecer vazio, rode o BLOCO 7 (rollback).


-- ============================================================
-- BLOCO 5 — VERIFICAÇÃO (rode sozinho, não altera nada)
--
-- Procura dados que violariam as regras do BLOCO 6.
-- Se vier VAZIO, pode seguir.
-- Se vier alguma linha, me mande o resultado antes de continuar.
-- ============================================================

select
  id,
  proprietario,
  valor,
  telefone,
  periodo_inicio,
  periodo_fim,
  case when valor <= 0                            then 'valor <= 0 · '        else '' end ||
  case when length(btrim(proprietario)) = 0       then 'proprietario vazio · ' else '' end ||
  case when length(btrim(endereco)) = 0           then 'endereco vazio · '     else '' end ||
  case when telefone is not null
        and telefone !~ '^[0-9()+.\-\s]{8,25}$'   then 'telefone fora do formato · ' else '' end ||
  case when periodo_inicio is not null and periodo_fim is not null
        and periodo_fim < periodo_inicio          then 'periodo invertido · '  else '' end
  as problemas
from public.cards
where valor <= 0
   or length(btrim(proprietario)) = 0
   or length(btrim(endereco)) = 0
   or (telefone is not null and telefone !~ '^[0-9()+.\-\s]{8,25}$')
   or (periodo_inicio is not null and periodo_fim is not null
       and periodo_fim < periodo_inicio);


-- ============================================================
-- BLOCO 6 — Validação no banco (só rode com o BLOCO 5 vazio)
--
-- Hoje a validação existe só no formulário React. Como o
-- navegador escreve direto no PostgREST, dá para gravar valor
-- negativo ou período invertido passando por fora da tela.
-- Estas constraints são a validação de verdade.
--
-- O Postgres não tem "ADD CONSTRAINT IF NOT EXISTS", então cada
-- regra é derrubada antes de ser recriada. Isso torna o bloco
-- reexecutável: rodar duas vezes não dá erro.
-- ============================================================

alter table public.cards drop constraint if exists cards_valor_positivo;
alter table public.cards drop constraint if exists cards_proprietario_valido;
alter table public.cards drop constraint if exists cards_endereco_valido;
alter table public.cards drop constraint if exists cards_inquilino_tamanho;
alter table public.cards drop constraint if exists cards_telefone_formato;
alter table public.cards drop constraint if exists cards_observacoes_tamanho;
alter table public.cards drop constraint if exists cards_periodo_coerente;
alter table public.columns drop constraint if exists columns_name_valido;

alter table public.cards
  add constraint cards_valor_positivo
    check (valor > 0 and valor < 10000000),
  add constraint cards_proprietario_valido
    check (length(btrim(proprietario)) between 1 and 200),
  add constraint cards_endereco_valido
    check (length(btrim(endereco)) between 1 and 300),
  add constraint cards_inquilino_tamanho
    check (inquilino is null or length(inquilino) <= 200),
  add constraint cards_telefone_formato
    check (telefone is null or telefone ~ '^[0-9()+.\-\s]{8,25}$'),
  add constraint cards_observacoes_tamanho
    check (observacoes is null or length(observacoes) <= 2000),
  add constraint cards_periodo_coerente
    check (periodo_inicio is null or periodo_fim is null
           or periodo_fim >= periodo_inicio);

alter table public.columns
  add constraint columns_name_valido
    check (length(btrim(name)) between 1 and 60);


-- ============================================================
-- BLOCO 6B — VERIFICAÇÃO (rode sozinho, não altera nada)
--
-- Confere o que realmente ficou aplicado. O esperado são as
-- 8 regras: 7 em cards + 1 em columns.
-- ============================================================

select
  conrelid::regclass          as tabela,
  conname                     as regra,
  pg_get_constraintdef(oid)   as definicao
from pg_constraint
where conrelid in ('public.cards'::regclass, 'public.columns'::regclass)
  and contype = 'c'
order by conrelid::regclass::text, conname;


-- ============================================================
-- BLOCO 7 — ROLLBACK (só se algo der errado)
--
-- Devolve as policies antigas. Use se o app parar de mostrar
-- os cards depois do BLOCO 4. O SQL Editor roda como superusuário
-- e ignora RLS, então você nunca fica sem saída por aqui.
-- ============================================================

/*
drop policy if exists "team full access boards"  on public.boards;
drop policy if exists "team full access columns" on public.columns;
drop policy if exists "team full access cards"   on public.cards;
drop policy if exists "team full access alerts"  on public.alerts;
drop policy if exists "profiles: self read"      on public.profiles;

create policy "team full access boards"
  on public.boards for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "team full access columns"
  on public.columns for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "team full access cards"
  on public.cards for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "team full access alerts"
  on public.alerts for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "profiles: authenticated read"
  on public.profiles for select
  using (auth.role() = 'authenticated');
*/
