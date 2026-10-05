-- Centinela Rastro (Equipos): eventos de seguridad que las apps del cliente
-- (su CRM, su panel, etc.) envían a Rastro por la API para que avise al
-- responsable. NO es un IDS: la app decide qué evento manda y con qué gravedad;
-- Rastro los guarda, los agrupa y avisa al titular cuando algo es crítico.
create table if not exists public.sentinel_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  kind        text not null,                                  -- login_failed, login_new_country, export_bulk, admin_added, password_changed, other…
  severity    text not null default 'info' check (severity in ('info','warn','critical')),
  source      text,                                           -- qué app lo envió (p. ej. "helm-crm")
  actor       text,                                           -- usuario del CRM afectado (correo o id), opcional
  ip          text,
  country     text,
  message     text,
  meta        jsonb,
  alerted     boolean not null default false,                 -- si ya se avisó al titular por este evento
  created_at  timestamptz not null default now()
);
create index if not exists sentinel_events_org_idx on public.sentinel_events (org_id, created_at desc);
alter table public.sentinel_events enable row level security;  -- solo el servidor (service_role) entra
