<img src="docs/icon.png" alt="" width="72" align="right" />

# Gukak Timetable

**A web app that replaces the monthly Excel workbook used to schedule instructors and rehearsal rooms at the National Gugak High School (국립국악고등학교).**

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e)
![License: MIT](https://img.shields.io/badge/License-MIT-green)

Each month the school builds a private-lesson timetable by hand in a spreadsheet: one
student is paired with one instructor, given a target number of contact hours, and slotted
into a 7-day × 6-room × 30-minute grid. The spreadsheet then computes — with a wall of
formulas — how the plan compares to each student's target, how hours fall across weekdays,
and which rooms are busy.

This project turns that workbook into a shared, editable web app:

- **Drill down** from a month calendar → a week grid → a single day.
- **Edit in place** with role-based permissions (admin, instructor, read-only student view).
- **Per-month rosters and targets** — the student ↔ instructor list is rebuilt every month,
  and the monthly statistics verify the plan against *that month's* targets.
- **Reproduces the spreadsheet's math** — "class difference" vs. target, pairing × weekday
  matrix — so the numbers match what staff already trust.
- **Exports PNG images** of any day or full week for sharing in messengers and printouts.
- **Imports the original `.xlsx`** through a Python parser, including the grey "no-class"
  cells the spreadsheet uses to block out unavailable time.

---

## Screens

| Month calendar | Week grid |
| --- | --- |
| ![Month calendar](docs/home.png) | ![Week grid](docs/week.png) |

| Day view | Monthly statistics |
| --- | --- |
| ![Day view](docs/day.png) | ![Statistics](docs/stats.png) |

> Screenshots use the bundled **anonymized sample data** (`학생01 (교사AT)` …). Real rosters
> contain minor students' names and are never committed to this repository.

---

## How it works

### Roles

| Role | How they get in | What they can do |
| --- | --- | --- |
| **Student** | no login | read-only: month, week, day, stats, image export |
| **Instructor** | `INSTRUCTOR_PASSWORD` | assign a pairing to a cell, write "no-class" blocks, edit day memos |
| **Admin** | `ADMIN_PASSWORD` | everything above + room/time-block structure, per-month roster & targets, settings, Excel import/export |

Auth is a signed HMAC cookie (`<role>.<timestamp>.<signature>`); there are no user accounts.

### Data model (Supabase / Postgres)

| Table | Purpose |
| --- | --- |
| `settings` | school name, active year/month, week start, default rooms and time blocks |
| `pairings` | one student ↔ instructor pair **per month** (`ym = "2026-07"`), with grade and target hours; `unique(ym, label)` |
| `schedule_cells` | one grid cell: `date` × `room` × `slot_index`, `kind` of `pairing` \| `block`, optional memo text and colour |
| `day_memos` | free-text notes attached to a single day |
| `day_configs` | per-day overrides of rooms / time blocks (holidays, exam weeks) |

A **cell** is empty, a **student (pairing)**, or a **no-class block**. Blocks carry the
former "free text" features — a memo and a colour — but only an admin may create or edit
one; by default a block renders as a diagonal hatch.

### Monthly scope

`pairings.ym` makes every month self-contained. The week and day views load the roster for
the month(s) they touch, so a week that straddles a month boundary resolves each day
against the correct list. Statistics for a month clip every week to that month before
counting, so neighbouring-month days never leak in.

### Statistics

Ported from the spreadsheet's formula block:

- **Class difference** — actual assigned hours vs. the month's target per pairing;
  over target is red, under is amber, exact is unmarked.
- **Pairing × weekday** — assigned hours per pairing per weekday (spreadsheet range
  `CY9:DF20`).

Hours are computed proportionally from the 30-minute grid, honouring per-day room/time
overrides.

---

## Getting started

### Prerequisites

- Node.js 20+
- npm
- (optional) Python 3 + `openpyxl`, only to re-parse source spreadsheets

### Run in demo mode (no secrets)

```bash
npm install
npm run dev
```

With no Supabase environment set, the app boots read-only against the bundled sample
(`src/data/seed-2026.json`) and shows a "demo mode" banner.

### Run against Supabase

1. Create a project at <https://supabase.com> (free tier is enough).
2. Paste all of `supabase/schema.sql` into the **SQL Editor** and run it.
3. Copy `.env.example` to `.env.local` and fill in:

   | Variable | Where |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
   | `SUPABASE_ANON_KEY` | Project Settings → API → `anon` public |
   | `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` (server only) |
   | `ADMIN_PASSWORD`, `INSTRUCTOR_PASSWORD` | any strings |
   | `ADMIN_SESSION_SECRET` | any long random string |

4. `npm run dev`, open `/admin`, log in, and use **Data → "import 2026 base data"** to load
   `src/data/seed-2026.json` into the database.

### Re-parse the source spreadsheets (optional)

```bash
python3 -m venv .venv && .venv/bin/pip install openpyxl
make seed        # data/*.xlsx  →  src/data/seed-2026.json
```

Drop the monthly workbooks (`2026년 N월.xlsx`) into `data/`. The parser reads each month's
`SET UP` sheet as that month's roster, classifies grey fills as no-class blocks, maps the
spreadsheet's fill colours to cell colours, and strictly filters out spill-over days from
adjacent months. **The generated file holds real names and is git-ignored**; the copy in
the repo is a small anonymized placeholder.

---

## Deployment

The [`Makefile`](Makefile) wraps the common tasks:

```bash
make check       # lint + build
make deploy      # vercel --prod (after check)
make env-push    # push .env.local values to Vercel (strips inline comments)
```

`make help` lists every target.

---

## Project structure

```
src/
  app/
    page.tsx              month calendar + "class difference" summary
    week/[key]/            week grid (7 days × rooms × slots)
    day/[date]/            single-day grid, editable
    stats/                 monthly statistics
    admin/                 gated: schedule / roster / settings / data tabs
    api/                   auth, schedule, pairings, memos, settings,
                           day-config, seed, export
  components/
    MonthCalendar, DayGrid, DayPanel, Cell, ScheduleBoard, StatsView,
    Capture / DayCapture / MonthCapture   (PNG export)
    admin/  ScheduleEditor, RosterEditor, SettingsForm, DataPanel, AdminGate
  lib/
    schedule.ts   week/month/ym helpers, slot geometry
    stats.ts      target vs. actual, weekday matrix
    time.ts       30-minute slot math
    data.ts       Supabase queries (falls back to demo.ts)
    demo.ts       serves seed-2026.json when Supabase is unset
    auth.ts       HMAC cookie roles
supabase/schema.sql        tables + re-runnable reconcile block
scripts/parse_xlsx.py      .xlsx → seed-2026.json
```

---

## License

Source code is released under the [MIT License](LICENSE). The real timetable data it is
built to manage — student and instructor names, schedules — is **not** part of this
repository and is not covered by that license.
