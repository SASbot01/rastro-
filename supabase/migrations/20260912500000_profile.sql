-- Perfil editable: nombre para mostrar y foto (JPEG pequeno en data URL, <=120 KB).
alter table public.users
  add column if not exists display_name text,
  add column if not exists avatar text;
