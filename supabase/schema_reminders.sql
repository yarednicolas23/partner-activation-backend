-- Partner Activation Program (Kaspersky) — recordatorios de inactividad
-- Ejecutar en el SQL editor de Supabase, después de schema.sql.
--
-- Throttle de recordatorios: sin esta columna, un partner con una tarea
-- pendiente recibiría el mismo email cada vez que corre el cron (diario).

alter table public.profiles
  add column if not exists reminded_at timestamptz;
