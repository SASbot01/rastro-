-- Campo opcional "profesión o empresa": ancla la identidad frente a homónimos.
alter table public.requests add column if not exists occupation text;
