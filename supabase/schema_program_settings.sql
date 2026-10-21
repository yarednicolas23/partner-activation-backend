-- Partner Activation Program (Kaspersky) — prazo geral do programa
-- Ejecutar en el SQL editor de Supabase, después de schema_program_deadlines.sql.
--
-- Regla: el prazo geral (duración en meses) se aplica solo a parceiros
-- convidados DESPUÉS del cambio. Para eso cada parceiro guarda su propio prazo
-- en `program_deadlines` en el momento del pré-cadastro (trigger abajo); cambiar
-- `program_settings` no mueve los prazos ya guardados. Los parceiros ya activos
-- se ajustan uno por uno desde el admin (Timeline).

create table if not exists public.program_settings (
  -- Tabla de una sola fila.
  id boolean primary key default true check (id),
  duration_months integer not null default 6 check (duration_months between 1 and 60),
  extension_months integer not null default 3 check (extension_months between 1 and 24),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.program_settings (id) values (true) on conflict (id) do nothing;

alter table public.program_settings enable row level security;

-- Origen del prazo de cada parceiro:
--   program   = snapshot del prazo geral al ser convidado
--   admin     = ajustado a mano por el admin
--   extension = prorrogação aprobada
alter table public.program_deadlines
  add column if not exists source text not null default 'admin'
  check (source in ('program', 'admin', 'extension'));

update public.program_deadlines d
set source = 'extension'
from public.deadline_extension_requests r
where r.partner_id = d.partner_id
  and r.status = 'approved'
  and r.new_deadline_at = d.deadline_at;

-- Backfill: los parceiros existentes sin prazo guardado quedan con el prazo
-- geral vigente hoy (6 meses desde el pré-cadastro), el mismo que ya veían.
insert into public.program_deadlines (partner_id, deadline_at, source)
select p.id, p.created_at + make_interval(months => s.duration_months), 'program'
from public.profiles p
cross join public.program_settings s
where not exists (
  select 1 from public.program_deadlines d where d.partner_id = p.id
);

-- Snapshot del prazo geral en cada pré-cadastro nuevo. El intervalo en meses
-- de Postgres ajusta al último día del mes (31/08 + 6 meses = 28/02), igual
-- que addMonths en el backend.
create or replace function public.snapshot_program_deadline()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.program_deadlines (partner_id, deadline_at, source)
  select new.id, new.created_at + make_interval(months => s.duration_months), 'program'
  from public.program_settings s
  on conflict (partner_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created_snapshot_deadline on public.profiles;
create trigger on_profile_created_snapshot_deadline
  after insert on public.profiles
  for each row execute procedure public.snapshot_program_deadline();
