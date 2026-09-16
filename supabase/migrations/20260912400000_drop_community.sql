-- Comunidad retirada (decision del propietario, 10-09-2026).
drop table if exists public.community_messages;
alter table public.users drop column if exists alias;
