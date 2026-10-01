-- HRLY · Supabase schema. Run once in Supabase → SQL Editor.
-- The backend uses the service-role key, which bypasses RLS. RLS is enabled with no policies,
-- so the anon key (never shipped to the browser here anyway) cannot read candidate data.

create extension if not exists pgcrypto;

create table if not exists public.candidates (
  id            uuid primary key default gen_random_uuid(),
  name          text,
  email         text,
  phone         text,
  city          text,
  applied_role  text not null check (applied_role in ('PM', 'SPM')),
  source        text not null default 'admin' check (source in ('admin', 'portal')),
  status        text not null default 'processing'
                check (status in ('processing', 'ready', 'failed', 'emailed')),
  error         text,
  cv_path       text,              -- path inside the 'cvs' storage bucket (signed URLs are generated on demand)
  cv_filename   text,
  redacted_text text,              -- exactly what the AI saw, after the PII shield
  pii_report    jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.evaluations (
  id             uuid primary key default gen_random_uuid(),
  candidate_id   uuid not null references public.candidates(id) on delete cascade,
  role           text not null check (role in ('PM', 'SPM')),
  raw_total      numeric(3,1),
  final_total    numeric(3,1),
  recommendation text,
  json_data      jsonb not null,   -- full rubric Part A7 output + HRLY extras
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (candidate_id, role)
);

create table if not exists public.emails (
  id           uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references public.candidates(id) on delete cascade,
  email_type   text not null check (email_type in ('invite', 'hold', 'rejection')),
  to_email     text,
  subject      text,
  draft_body   text,
  status       text not null default 'draft' check (status in ('draft', 'sent', 'failed')),
  resend_id    text,
  error        text,
  sent_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists candidates_created_idx on public.candidates (created_at desc);

alter table public.candidates  enable row level security;
alter table public.evaluations enable row level security;
alter table public.emails      enable row level security;

-- Private bucket for CV files.
insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', false)
on conflict (id) do nothing;

-- Migration for databases created before the applicant portal existed:
alter table public.candidates add column if not exists source text not null default 'admin';
create index if not exists candidates_email_role_idx on public.candidates (lower(email), applied_role);
