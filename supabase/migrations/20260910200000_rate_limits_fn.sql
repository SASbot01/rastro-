-- Día 5: límite de uso atómico (una sola sentencia, sin carreras) y
-- índice para la caché por correo.

create or replace function public.bump_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_count int;
begin
  insert into public.rate_limits (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case
          when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1
          else public.rate_limits.count + 1 end,
        window_start = case
          when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now()
          else public.rate_limits.window_start end
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;

create index if not exists requests_email_done_idx
  on public.requests (lower(email), created_at desc) where status = 'done';
