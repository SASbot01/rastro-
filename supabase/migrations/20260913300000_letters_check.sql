-- Comprobacion de resultado: ¿sigue apareciendo la persona en la URL de la carta?
alter table public.letters
  add column if not exists last_check_at timestamptz,
  add column if not exists still_listed boolean;
