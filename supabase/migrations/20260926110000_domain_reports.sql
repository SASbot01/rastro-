-- Informe de exposicion de un dominio de empresa (Rastro Equipos, herramienta de venta).
-- Solo datos de la empresa: DNS del correo, web, dominios parecidos, correos TAPADOS y lo que dice la IA.
-- Nunca guarda datos de personas: los correos se conservan solo como "in***@dominio.es".
create table if not exists public.domain_reports (
  id         uuid primary key default gen_random_uuid(),
  domain     text not null,                 -- dominio normalizado en minusculas, sin www
  locale     text not null default 'es',
  report     jsonb not null,                -- DomainReport (lib/domain-report-core.ts)
  score      int  not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null  -- cuenta que lo genero (admin o titular de equipo)
);
create index if not exists domain_reports_domain_idx on public.domain_reports (domain, locale, created_at desc);
alter table public.domain_reports enable row level security;

grant all on all tables in schema public to service_role;
notify pgrst, 'reload schema';
