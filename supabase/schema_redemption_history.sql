-- Partner Activation Program (Kaspersky) — histórico de resgates
-- Ejecutar en el SQL editor de Supabase, después de schema_profile_address.sql.
--
-- `reward_redemptions` guarda solo el estado actual: cada revisión del admin
-- sobrescribe status/admin_note/reviewed_by/reviewed_at. Esta tabla registra
-- cada cambio (solicitud, aprobación, entrega, rechazo, nueva solicitud tras
-- un rechazo) para mostrar el seguimiento de la entrega en el panel admin.
--
-- La escribe solo el backend (service role); sin policies para el parceiro.

create table if not exists public.reward_redemption_events (
  id uuid primary key default gen_random_uuid(),
  redemption_id uuid not null references public.reward_redemptions (id) on delete cascade,
  status public.redemption_status not null,
  note text,
  -- Parceiro en la solicitud, admin en las revisiones.
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists reward_redemption_events_redemption_idx
  on public.reward_redemption_events (redemption_id, created_at);

alter table public.reward_redemption_events enable row level security;

-- Backfill de las solicitudes existentes: solo se conoce la solicitud y el
-- estado actual — los pasos intermedios (ej. la aprobación de algo que ya
-- está entregado) se perdieron al sobrescribirse y no se pueden reconstruir.
insert into public.reward_redemption_events (redemption_id, status, actor_id, created_at)
select r.id, 'pending', r.partner_id, r.requested_at
from public.reward_redemptions r
where not exists (
  select 1 from public.reward_redemption_events e where e.redemption_id = r.id
);

insert into public.reward_redemption_events (redemption_id, status, note, actor_id, created_at)
select r.id, r.status, r.admin_note, r.reviewed_by, coalesce(r.reviewed_at, r.requested_at)
from public.reward_redemptions r
where r.status <> 'pending'
  and not exists (
    select 1 from public.reward_redemption_events e
    where e.redemption_id = r.id and e.status = r.status
  );
