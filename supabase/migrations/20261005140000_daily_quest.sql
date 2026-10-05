-- Reto diario de privacidad + racha (retención). Un reto al día (igual para todos,
-- determinista por fecha); al marcarlo hecho sube la racha. Guardamos en la cuenta
-- para que la racha siga en cualquier dispositivo.
alter table public.users
  add column if not exists quest_streak int not null default 0,   -- racha actual (días seguidos)
  add column if not exists quest_best   int not null default 0,   -- récord de racha
  add column if not exists quest_last    date;                    -- último día que completó el reto
