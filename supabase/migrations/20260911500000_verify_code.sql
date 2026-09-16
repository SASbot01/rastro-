-- Verificación por código de 6 dígitos (además del enlace): hash HMAC y contador de intentos.
alter table public.requests
  add column if not exists verify_code_hash text,
  add column if not exists verify_attempts int not null default 0;
