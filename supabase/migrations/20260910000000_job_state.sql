-- Día 2: estado del job asíncrono y desglose del score.

alter table public.requests
  add column if not exists step        text,          -- 'hibp' | 'brave' | 'ai' | 'report'
  add column if not exists error       text,
  add column if not exists started_at  timestamptz,
  add column if not exists finished_at timestamptz;

alter table public.reports
  add column if not exists breakdown jsonb not null default '{}'::jsonb; -- {rule: puntos}
