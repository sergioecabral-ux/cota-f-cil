create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_id uuid references public.events(id) on delete set null,
  page text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "Users manage own feedback" on public.feedback;

create policy "Users manage own feedback"
on public.feedback
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists feedback_user_id_idx on public.feedback(user_id);
create index if not exists feedback_event_id_idx on public.feedback(event_id);