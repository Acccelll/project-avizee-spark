create table if not exists public.help_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seen_tours text[] not null default '{}',
  disabled_first_visit boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.help_progress enable row level security;

create policy "help_progress self select" on public.help_progress
  for select using (auth.uid() = user_id);
create policy "help_progress self insert" on public.help_progress
  for insert with check (auth.uid() = user_id);
create policy "help_progress self update" on public.help_progress
  for update using (auth.uid() = user_id);

create or replace function public.touch_help_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_help_progress on public.help_progress;
create trigger trg_touch_help_progress
  before update on public.help_progress
  for each row execute function public.touch_help_progress();

create table if not exists public.help_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  route text not null,
  helpful boolean not null,
  comment text,
  created_at timestamptz not null default now()
);

alter table public.help_feedback enable row level security;

create policy "help_feedback self insert" on public.help_feedback
  for insert with check (auth.uid() = user_id);
create policy "help_feedback admin read" on public.help_feedback
  for select using (public.has_role(auth.uid(), 'admin'));

create index if not exists idx_help_feedback_route_created on public.help_feedback (route, created_at desc);