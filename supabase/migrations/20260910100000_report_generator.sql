-- Día 3: quién redactó el informe ('ai' = Anthropic; 'template' = plantillas de respaldo).
alter table public.reports
  add column if not exists generator text not null default 'template'
  check (generator in ('ai','template'));
