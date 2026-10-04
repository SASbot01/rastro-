-- Espera con resultados en vivo: lo que ya se ha encontrado mientras la IA redacta (solo contadores y nombres de filtraciones).
alter table public.requests add column if not exists progress jsonb;
notify pgrst, 'reload schema';
