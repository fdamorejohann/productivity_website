-- Run this in the Supabase SQL Editor

create table if not exists goals (
  id text primary key,
  title text not null,
  type text not null check (type in ('weekly','daily')),
  starred boolean default false,
  done boolean default false,
  color text default '#6b7280',
  created_at timestamptz default now()
);

create table if not exists habits (
  id text primary key,
  label text not null,
  color text not null,
  frequency int not null default 3
);

create table if not exists planned_habits (
  id text primary key,
  habit_id text references habits(id) on delete cascade,
  date text not null,
  done boolean default false
);

create table if not exists calendar_events (
  id text primary key,
  date text not null,
  title text not null,
  time text not null default '09:00'
);

create table if not exists notes (
  id int primary key default 1,
  content text default ''
);

-- Seed the single notes row
insert into notes (id, content) values (1, '') on conflict do nothing;

-- Drink log (private sobriety tracker)
create table if not exists drink_log (
  id uuid primary key default gen_random_uuid(),
  date text not null unique, -- YYYY-MM-DD
  created_at timestamptz default now()
);

-- Powder log (private tracker)
create table if not exists powder_log (
  id uuid primary key default gen_random_uuid(),
  date text not null unique, -- YYYY-MM-DD
  created_at timestamptz default now()
);

-- Food cost tracker
create table if not exists grocery_hauls (
  id uuid primary key default gen_random_uuid(),
  store text not null,
  amount numeric(10,2) not null,
  date text not null, -- YYYY-MM-DD
  notes text not null default '',
  created_at timestamptz default now()
);

create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date text not null, -- YYYY-MM-DD
  created_at timestamptz default now()
);

-- Running plan completions
create table if not exists running_completions (
  id uuid primary key default gen_random_uuid(),
  week int not null,
  run_number int not null,       -- 1 = easy run, 2 = long run
  completed_date text not null,  -- YYYY-MM-DD
  session_id text,               -- linked workout session id
  created_at timestamptz default now(),
  unique(week, run_number)
);
