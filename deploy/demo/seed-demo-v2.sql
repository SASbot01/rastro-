-- Cuenta demo (demo@rastropro.com): datos para enseñar el bloque "de 8 a 10".
-- Aditivo e idempotente: se puede pasar varias veces. Requiere haber pasado antes seed-demo.sql.

-- 1) Retiradas: Zabasearch retirado y comprobado; Strava retirado; Dateas sigue apareciendo y en plazo.
update public.letters l set
  status = 'answered', outcome = 'deleted', still_listed = false, check_count = 3,
  last_check_at = now() - interval '1 day', removed_at = now() - interval '4 days',
  events = '[]'::jsonb
    || jsonb_build_object('at', now() - interval '18 days', 'type', 'sent')
    || jsonb_build_object('at', now() - interval '9 days', 'type', 'answered')
    || jsonb_build_object('at', now() - interval '4 days', 'type', 'verified_gone')
from public.users u where u.id = l.user_id and u.email = 'demo@rastropro.com' and l.host = 'zabasearch.com';

update public.letters l set
  still_listed = false, check_count = 2, last_check_at = now() - interval '1 day', removed_at = now() - interval '1 day',
  events = coalesce(l.events, '[]'::jsonb)
    || jsonb_build_object('at', now() - interval '1 day', 'type', 'verified_gone')
from public.users u where u.id = l.user_id and u.email = 'demo@rastropro.com' and l.host = 'strava.com' and l.removed_at is null;

update public.letters l set still_listed = true, check_count = 2, last_check_at = now() - interval '1 day'
from public.users u where u.id = l.user_id and u.email = 'demo@rastropro.com' and l.host = 'dateas.com';

-- 2) Sitios comprobados en el ultimo informe.
update public.reports p set site_checks = '[
  {"slug":"dateas","name":"Dateas","host":"dateas.com","status":"listed","url":"https://www.dateas.com/es/persona/ana-garcia-ruiz-valencia","title":"Ana García Ruiz - Valencia | Dateas"},
  {"slug":"infobel","name":"Infobel","host":"infobel.com","status":"listed","url":"https://www.infobel.com/es/spain/ana_garcia_ruiz/valencia","title":"Ana García Ruiz, Valencia - teléfono y dirección | Infobel"},
  {"slug":"paginas-blancas","name":"Páginas Blancas","host":"paginasblancas.es","status":"listed","url":"https://blancas.paginasamarillas.es/jsp/resultados.jsp?ap1=Garcia&ap2=Ruiz&nomprov=Valencia","title":"García Ruiz Ana - Valencia | Páginas Blancas"},
  {"slug":"axesor","name":"Axesor (Experian)","host":"axesor.es","status":"not_found","url":null,"title":null},
  {"slug":"einforma","name":"eInforma (Informa D&B)","host":"einforma.com","status":"not_found","url":null,"title":null},
  {"slug":"infocif","name":"Infocif","host":"infocif.es","status":"not_found","url":null,"title":null},
  {"slug":"empresite","name":"Empresite (elEconomista)","host":"empresite.eleconomista.es","status":"not_found","url":null,"title":null},
  {"slug":"guia-empresas","name":"Guía Empresas (Universia)","host":"guiaempresas.universia.es","status":"not_found","url":null,"title":null},
  {"slug":"cylex","name":"Cylex","host":"cylex.es","status":"not_found","url":null,"title":null},
  {"slug":"pipl","name":"Pipl","host":"pipl.com","status":"not_found","url":null,"title":null},
  {"slug":"yasni","name":"Yasni","host":"yasni.com","status":"not_found","url":null,"title":null}
]'::jsonb
where p.request_id = (select q.id from public.requests q where q.email = 'demo@rastropro.com' and q.status = 'done' order by q.created_at desc limit 1);

-- 3) Memoria de la IA: tres fotos con cambios. La cuenta demo queda fuera de la comprobacion semanal
--    (si no, el cron preguntaria de verdad por "Ana García Ruiz" y estropearia la cronologia preparada).
update public.users set ai_watch_last_at = '2099-01-01' where email = 'demo@rastropro.com';
delete from public.ai_snapshots s using public.users u where u.id = s.user_id and u.email = 'demo@rastropro.com';
with u as (select id from public.users where email = 'demo@rastropro.com'),
q as (select id, created_at, row_number() over (order by created_at) n from public.requests where email = 'demo@rastropro.com' and status = 'done')
insert into public.ai_snapshots (user_id, request_id, source, answers, facts, changes, taken_at)
select u.id, (select id from q where n = 1), 'report',
  '[{"provider":"perplexity","model":null,"question":"¿Quién es Ana García Ruiz (Valencia, Enfermera)?","answer":"Hay varias personas llamadas Ana García Ruiz. En Valencia aparece una enfermera con ese nombre en un listado de resultados de una carrera popular de 10 km, pero no encuentro más información pública fiable sobre ella.","sources":[{"title":"Runedia - 10K Valencia","url":"https://www.runedia.com/resultados/10k-valencia-2025"}]}]'::jsonb,
  '{"perplexity":{"knows_you":true,"employer":null,"role":"Enfermera","city":"Valencia","contact":[],"claims":["Corrió el 10K Valencia de 2025"],"mixes_people":false}}'::jsonb,
  '[]'::jsonb, now() - interval '20 days' from u
union all
select u.id, (select id from q where n = 2), 'report',
  '[{"provider":"perplexity","model":null,"question":"¿Quién es Ana García Ruiz (Valencia, Enfermera)?","answer":"Ana García Ruiz es enfermera en Valencia. Según su perfil profesional trabaja en el Hospital La Fe. Participa en carreras populares y su perfil de Strava es público, con rutas que empiezan en el barrio de Benimaclet.","sources":[{"title":"LinkedIn","url":"https://www.linkedin.com/in/ana-garcia-ruiz-enfermera"},{"title":"Strava","url":"https://www.strava.com/athletes/ana-garcia-ruiz"}]},{"provider":"openai","model":"gpt-5-mini","question":"¿Quién es Ana García Ruiz (Valencia, Enfermera)?","answer":"No encuentro información fiable sobre una Ana García Ruiz enfermera en Valencia. Hay varias personas con ese nombre y no puedo distinguirlas.","sources":[]}]'::jsonb,
  '{"perplexity":{"knows_you":true,"employer":"Hospital La Fe","role":"Enfermera","city":"Valencia","contact":["social"],"claims":["Corre carreras populares","Sus rutas de Strava empiezan en Benimaclet"],"mixes_people":false},"openai":{"knows_you":false,"employer":null,"role":null,"city":null,"contact":[],"claims":[],"mixes_people":false}}'::jsonb,
  '[{"provider":"perplexity","kind":"employer_new","before":null,"after":"Hospital La Fe","minor":false,"worse":true},{"provider":"perplexity","kind":"contact_new","before":null,"after":"social","minor":false,"worse":true},{"provider":"perplexity","kind":"claim_new","before":null,"after":"Sus rutas de Strava empiezan en Benimaclet","minor":true,"worse":true}]'::jsonb,
  now() - interval '10 days' from u
union all
select u.id, (select id from q where n = 3), 'report',
  '[{"provider":"perplexity","model":null,"question":"¿Quién es Ana García Ruiz (Valencia, Enfermera)?","answer":"Ana García Ruiz es enfermera en el Hospital La Fe de Valencia. En un directorio telefónico aparece un número fijo a su nombre en Valencia. Su perfil de Strava ya no es público.","sources":[{"title":"LinkedIn","url":"https://www.linkedin.com/in/ana-garcia-ruiz-enfermera"},{"title":"Infobel","url":"https://www.infobel.com/es/spain/ana_garcia_ruiz/valencia"}]},{"provider":"openai","model":"gpt-5-mini","question":"¿Quién es Ana García Ruiz (Valencia, Enfermera)?","answer":"Ana García Ruiz figura como enfermera en Valencia, vinculada al Hospital Universitari i Politècnic La Fe según su perfil de LinkedIn. No he encontrado datos de contacto.","sources":[{"title":"LinkedIn","url":"https://www.linkedin.com/in/ana-garcia-ruiz-enfermera"}]}]'::jsonb,
  '{"perplexity":{"knows_you":true,"employer":"Hospital La Fe","role":"Enfermera","city":"Valencia","contact":["phone"],"claims":["Aparece un teléfono fijo a su nombre en un directorio"],"mixes_people":false},"openai":{"knows_you":true,"employer":"Hospital Universitari i Politècnic La Fe","role":"Enfermera","city":"Valencia","contact":[],"claims":[],"mixes_people":false}}'::jsonb,
  '[{"provider":"perplexity","kind":"contact_new","before":null,"after":"phone","minor":false,"worse":true},{"provider":"perplexity","kind":"contact_gone","before":"social","after":null,"minor":false,"worse":false},{"provider":"openai","kind":"learned_you","before":null,"after":null,"minor":false,"worse":true},{"provider":"openai","kind":"employer_new","before":null,"after":"Hospital Universitari i Politècnic La Fe","minor":false,"worse":true},{"provider":"openai","kind":"city_new","before":null,"after":"Valencia","minor":false,"worse":true}]'::jsonb,
  now() - interval '2 days' from u;

select 'retiradas' k, count(*) from public.letters l join public.users u on u.id = l.user_id where u.email = 'demo@rastropro.com' and l.removed_at is not null
union all select 'fotos IA', count(*) from public.ai_snapshots s join public.users u on u.id = s.user_id where u.email = 'demo@rastropro.com';
