-- Partner Activation Program (Kaspersky) — sistema de recompensas
-- Ejecutar en el SQL editor de Supabase, después de schema_missions.sql.
--
-- Elegibilidad por milestone completado (no por puntos/tiers): la
-- estructura de puntos y tiers sigue "pendiente de definir" con Kaspersky
-- (CLAUDE.md), así que un reward se desbloquea al completar el milestone
-- asociado — reusa el motor de milestones que ya existe en vez de inventar
-- un sistema de puntos que después habría que rehacer.
--
-- Fulfillment físico queda fuera de la plataforma (CLAUDE.md): acá solo se
-- gestiona elegibilidad, solicitud y estado de la redención. El stock es
-- informativo/ABM manual del admin, no se descuenta automáticamente al
-- redimir.

create type public.reward_type as enum ('physical', 'digital', 'mixed');
create type public.redemption_status as enum ('pending', 'approved', 'rejected', 'fulfilled');

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  type public.reward_type not null default 'physical',
  milestone_id uuid not null references public.milestones (id) on delete restrict,
  stock int,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Una fila por (reward, partner) — evita solicitudes duplicadas del mismo
-- reward por el mismo partner mientras la anterior sigue en curso.
create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.rewards (id) on delete cascade,
  partner_id uuid not null references public.profiles (id) on delete cascade,
  status public.redemption_status not null default 'pending',
  admin_note text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  requested_at timestamptz not null default now(),
  unique (reward_id, partner_id)
);

alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;

-- El backend filtra elegibilidad/ownership con la service role key (no RLS)
-- — mismo criterio que milestones/task_evidence.
create policy "rewards_select_authenticated"
  on public.rewards for select
  using (auth.role() = 'authenticated');

create policy "reward_redemptions_select_own"
  on public.reward_redemptions for select
  using (auth.uid() = partner_id);

create policy "reward_redemptions_insert_own"
  on public.reward_redemptions for insert
  with check (auth.uid() = partner_id);
