-- 국악고 강사·강의실 시간표 — Supabase schema
-- Run in Supabase SQL Editor (or `supabase db push`).

create extension if not exists "pgcrypto";

-- single-row settings (id is always 1)
create table if not exists public.settings (
  id                 int primary key default 1,
  school_name        text not null default '국립국악고등학교',
  year               int  not null default 2026,
  month              int  not null default 7,
  week_start         text not null default 'mon' check (week_start in ('mon','sun')),
  rooms              jsonb not null default '["I","II","III","大","中","우"]'::jsonb,
  time_slots_weekday jsonb not null default '[]'::jsonb,
  time_slots_weekend jsonb not null default '[]'::jsonb,
  updated_at         timestamptz not null default now(),
  constraint settings_singleton check (id = 1)
);

create table if not exists public.pairings (
  id           uuid primary key default gen_random_uuid(),
  ym           text not null default '',          -- "YYYY-MM" roster/target month
  student_name text not null,
  grade        text not null default '',
  teacher_name text not null default '',
  target_hours numeric,
  label        text not null,
  sort_order   int  not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create unique index if not exists pairings_ym_label_key on public.pairings (ym, label);

create table if not exists public.schedule_cells (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,
  room       text not null,
  slot_index int  not null,
  kind       text not null check (kind in ('pairing','block')),
  pairing_id uuid references public.pairings(id) on delete cascade,
  text       text,
  color      text,                       -- 직접 입력 칸 배경 tint: y|r|g|b
  updated_at timestamptz not null default now(),
  unique (date, room, slot_index)
);
create index if not exists schedule_cells_date_idx on public.schedule_cells (date);

-- ruled memo column: { "HH:MM": { "text": "...", "red": true } }
create table if not exists public.day_memos (
  date  date primary key,
  lines jsonb not null default '{}'::jsonb
);

-- per-date override of grid shape; null column => fall back to settings
create table if not exists public.day_configs (
  date  date primary key,
  rooms jsonb,
  slots jsonb
);

-- ---------------------------------------------------------------------------
-- reconcile pre-existing tables (safe to run repeatedly)
-- ---------------------------------------------------------------------------
-- schedule_cells: 직접입력(text)을 비수업(block)으로 통합 — 셀 상태 = 비어있음/pairing/block
alter table public.schedule_cells add column if not exists color text;
alter table public.schedule_cells drop constraint if exists schedule_cells_kind_check;
update public.schedule_cells set kind = 'block' where kind = 'text';
alter table public.schedule_cells
  add constraint schedule_cells_kind_check check (kind in ('pairing','block'));

-- pairings: global roster -> per-month roster (ym = "YYYY-MM")
alter table public.pairings add column if not exists ym text not null default '';
drop index if exists pairings_label_key;
create unique index if not exists pairings_ym_label_key on public.pairings (ym, label);

-- day_memos: old "memos" array column -> "lines" object column
alter table public.day_memos add column if not exists lines jsonb not null default '{}'::jsonb;
alter table public.day_memos drop column if exists memos;

-- seed the settings row
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- Row Level Security: anyone may read, only the service role writes
-- (the Next.js API routes use the service-role key and gate writes behind ADMIN_PASSWORD).
alter table public.settings       enable row level security;
alter table public.pairings       enable row level security;
alter table public.schedule_cells enable row level security;
alter table public.day_memos      enable row level security;
alter table public.day_configs    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings','pairings','schedule_cells','day_memos','day_configs'] loop
    execute format('drop policy if exists "public read %1$s" on public.%1$s', t);
    execute format('create policy "public read %1$s" on public.%1$s for select using (true)', t);
  end loop;
end $$;
