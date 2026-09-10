-- Cuentas conocidas asociadas al correo (deducidas de filtraciones, pastes y Gravatar).
alter table public.reports add column if not exists accounts jsonb not null default '[]'::jsonb;
