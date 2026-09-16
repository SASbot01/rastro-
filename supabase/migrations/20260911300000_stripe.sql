-- Día 13 (semana 2): plan Pro con Stripe.
alter table public.users
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text,
  add column if not exists plan_status text;  -- estado bruto de Stripe (active, past_due, canceled...)

-- Eventos de webhook ya procesados (idempotencia).
create table if not exists public.stripe_events (
  id          text primary key,     -- evt_...
  type        text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
