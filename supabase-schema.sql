create table if not exists public.profiles (
  id text primary key check (id in ('erica', 'wilmer')),
  name text not null,
  created_at timestamptz not null default now()
);
insert into public.profiles (id, name) values ('erica','Erica'), ('wilmer','Wilmer') on conflict (id) do nothing;

create table if not exists public.events (
  id uuid primary key,
  profile_id text not null references public.profiles(id),
  title text not null,
  description text,
  date date not null,
  start_time time,
  end_time time,
  all_day boolean not null default false,
  notification_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_profile_date_idx on public.events(profile_id, date);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(), profile_id text not null references public.profiles(id),
  endpoint text not null unique, p256dh text not null, auth text not null, active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.notification_deliveries (
  id text primary key, profile_id text not null references public.profiles(id), sent_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.push_subscriptions enable row level security;
create policy "profiles readable" on public.profiles for select using (true);
create policy "events readable" on public.events for select using (true);
create policy "events writable" on public.events for all using (true) with check (true);
-- Antes de usar con más usuarios, sustituir estas políticas por reglas basadas en auth.uid().
