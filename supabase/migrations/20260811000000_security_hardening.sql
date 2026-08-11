-- ============================================================
-- Hardening de segurança
--
-- Contexto: as policies originais (20260728000000_init_schema.sql)
-- davam acesso total a qualquer usuário com auth.role() =
-- 'authenticated'. Isso só era seguro porque o cadastro público
-- estava desligado no painel do projeto — uma configuração que
-- não aparece em nenhuma migration e é fácil de religar sem
-- perceber o que se está reabrindo.
--
-- Esta migration move a decisão para dentro do banco: agora o
-- acesso exige estar em public.allowed_members, independente do
-- estado do toggle de cadastro no painel. Também adiciona validação
-- de dados via CHECK constraints, que antes existia só no formulário
-- React (facilmente contornável escrevendo direto no PostgREST).
--
-- Runbook operacional para aplicar/auditar isto passo a passo:
-- supabase/hardening_seguranca.sql
-- ============================================================


-- ------------------------------------------------------------
-- Allowlist de membros da equipe
-- ------------------------------------------------------------

create table if not exists public.allowed_members (
  email text primary key,
  added_at timestamptz not null default now()
);

alter table public.allowed_members enable row level security;
-- Sem policy de select: ninguém lê essa tabela pelo cliente.
-- Gerenciada só pelo SQL Editor / service_role.

-- >>> Ajuste para os e-mails reais da equipe antes de aplicar. <<<
insert into public.allowed_members (email) values
  ('seu-email@exemplo.com')
  -- , ('colega@empresa.com')
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


-- ------------------------------------------------------------
-- Policies: authenticated -> allowlist
-- ------------------------------------------------------------

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
-- (antes, qualquer autenticado listava o e-mail de todo mundo)
create policy "profiles: self read"
  on public.profiles for select to authenticated
  using (auth.uid() = id);


-- ------------------------------------------------------------
-- Validação de dados no banco
-- ------------------------------------------------------------

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
