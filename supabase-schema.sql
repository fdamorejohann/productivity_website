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

-- Trip cost tracker (England & Dublin) — logged in a single currency (£)
create table if not exists trip_expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric(10,2) not null default 0, -- £ paid; 0 when paid with points
  points integer not null default 0,       -- points paid; 0 when paid with £
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

-- ─── Job postings (Jobs panel) ───────────────────────────────────────────────
-- Already exists in Supabase — documented here only, do NOT re-run.
-- Rows come from the external job scanner (it owns posting + fit columns) or from the
-- app's "+ Add job" form (source = 'manual'; may have no description / fit_score).
-- RLS is enabled with no policies: only the service key (our API) can read/write.
create table if not exists public.job_postings (
  id                bigint generated always as identity primary key,
  url               text not null unique,          -- "manual:<slug>" for manual rows without a link
  source            text not null,                 -- scanner source, or 'manual'
  source_job_id     text,
  company           text not null,
  title             text not null,
  location          text,
  remote            boolean,
  salary            text,
  description       text,
  posted_at         timestamptz,
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  closed_at         timestamptz,
  status            text not null default 'new'
                    check (status in ('new','interested',
                                      'applied','screen','interview','offer',
                                      'rejected','withdrawn','skipped','closed')),
  status_changed_at timestamptz not null default now(), -- set by trigger; never written by the app
  applied_at        date,                          -- trigger fills it on → 'applied' if empty
  notes             text,
  why_interested    text,
  contact           text,
  next_step         text,
  follow_up_on      date,
  fit_score         smallint check (fit_score between 1 and 5), -- null = not scored
  fit_summary       text,
  fit_details       jsonb, -- { reasons: string[], red_flags: string[], resume: string|null, ... }
  scored_at         timestamptz,
  updated_at        timestamptz not null default now()
);

create index if not exists job_postings_status_idx   on public.job_postings (status);
create index if not exists job_postings_fit_idx      on public.job_postings (fit_score desc nulls last);
create index if not exists job_postings_unscored_idx on public.job_postings (first_seen_at) where scored_at is null;

create or replace function public.job_postings_touch() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.status_changed_at = now();
    if new.status = 'applied' and new.applied_at is null then
      new.applied_at = current_date;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists job_postings_touch on public.job_postings;
create trigger job_postings_touch before update on public.job_postings
  for each row execute function public.job_postings_touch();

alter table public.job_postings enable row level security;
