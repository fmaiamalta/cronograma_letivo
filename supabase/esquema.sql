-- Cronograma Letivo: uma linha por professor, só acessível pelo próprio.
-- Colar no Supabase: SQL Editor › New query › Run.

create table if not exists public.cronogramas (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dados jsonb not null,
  atualizado timestamptz not null default now()
);

alter table public.cronogramas enable row level security;

create policy "ler o próprio" on public.cronogramas
  for select using (auth.uid() = user_id);
create policy "criar o próprio" on public.cronogramas
  for insert with check (auth.uid() = user_id);
create policy "alterar o próprio" on public.cronogramas
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "apagar o próprio" on public.cronogramas
  for delete using (auth.uid() = user_id);
