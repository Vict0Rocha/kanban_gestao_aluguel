-- ============================================================
-- Kanban de Aluguel — schema inicial
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- profiles: espelha auth.users, guarda dados básicos da equipe
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- boards: quadros kanban (hoje só existe 1, mas fica pronto
-- caso um dia surja a necessidade de separar por carteira/região)
-- ------------------------------------------------------------
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Aluguéis',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- columns: colunas do board, nome e ordem livres para o usuário
-- ------------------------------------------------------------
create table public.columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  name text not null,
  position double precision not null,
  created_at timestamptz not null default now()
);

create index columns_board_id_idx on public.columns (board_id);

-- ------------------------------------------------------------
-- cards: cada card representa uma casa/imóvel
-- ------------------------------------------------------------
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references public.columns(id) on delete cascade,
  position double precision not null,

  -- obrigatórios
  proprietario text not null,
  valor numeric(12, 2) not null,
  endereco text not null,

  -- opcionais
  inquilino text,
  telefone text,
  periodo_inicio date,
  periodo_fim date,
  observacoes text,

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cards_column_id_idx on public.cards (column_id);
create index cards_periodo_fim_idx on public.cards (periodo_fim);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger cards_set_updated_at
before update on public.cards
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- alerts: alertas gerados automaticamente (ex: contrato vencendo)
-- ------------------------------------------------------------
create type public.alert_type as enum ('contrato_vencendo', 'contrato_vencido');
create type public.alert_status as enum ('pendente', 'enviado', 'descartado');

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  type public.alert_type not null,
  trigger_date date not null,
  status public.alert_status not null default 'pendente',
  created_at timestamptz not null default now()
);

create index alerts_card_id_idx on public.alerts (card_id);

-- evita gerar o mesmo alerta duas vezes no mesmo dia para o mesmo card
create unique index alerts_unique_per_trigger
  on public.alerts (card_id, type, trigger_date);

-- ------------------------------------------------------------
-- RLS: qualquer usuário autenticado (equipe) tem acesso total
-- (mesmo nível de acesso para todos, conforme definido)
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.columns enable row level security;
alter table public.cards enable row level security;
alter table public.alerts enable row level security;

create policy "profiles: authenticated read"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "profiles: self insert"
  on public.profiles for insert
  with check (auth.uid() = id);

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
