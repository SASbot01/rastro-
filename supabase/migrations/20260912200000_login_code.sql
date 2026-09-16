-- Codigo de 6 digitos en los enlaces de acceso (misma credencial que el enlace).
alter table public.login_tokens
  add column if not exists code_hash text,
  add column if not exists attempts int not null default 0;
