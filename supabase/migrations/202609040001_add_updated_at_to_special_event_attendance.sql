-- Migration: Add optional updated_at column to special_event_attendance for compatibility
alter table public.special_event_attendance add column if not exists updated_at timestamptz not null default now();
