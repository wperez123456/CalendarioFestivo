-- Ejecutar una sola vez en Supabase SQL Editor.
-- Añade la hora de la cita y conserva los datos antiguos de start_time.
alter table public.events add column if not exists event_time time;
update public.events
set event_time = start_time
where event_time is null and start_time is not null;
create index if not exists events_profile_date_time_idx on public.events(profile_id, date, event_time);

