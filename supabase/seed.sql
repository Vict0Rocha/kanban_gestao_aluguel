-- Dados iniciais: um board padrão com as 3 colunas do rascunho
-- (o usuário pode renomear/reordenar/criar novas colunas depois pela UI)

insert into public.boards (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Aluguéis')
on conflict (id) do nothing;

insert into public.columns (board_id, name, position)
values
  ('00000000-0000-0000-0000-000000000001', 'Coluna 1', 1000),
  ('00000000-0000-0000-0000-000000000001', 'Coluna 2', 2000),
  ('00000000-0000-0000-0000-000000000001', 'Coluna 3', 3000);
