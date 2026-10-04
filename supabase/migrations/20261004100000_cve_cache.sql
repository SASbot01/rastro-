-- Caché de consultas a NVD (buscador de CVE/exploit del Lab). Compartida entre cuentas; datos públicos.
create table if not exists public.cve_cache (
  id         text primary key,            -- CVE-AAAA-NNNN
  data       jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.cve_cache enable row level security;
grant all on all tables in schema public to service_role;
notify pgrst, 'reload schema';
