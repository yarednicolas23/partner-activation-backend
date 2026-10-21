-- Partner Activation Program (Kaspersky) — prazo do programa e prorrogações
-- Ejecutar en el SQL editor de Supabase, después de schema_redemption_history.sql.
--
-- Hasta ahora el prazo (6 meses desde el pre-registro) se calculaba solo en el
-- frontend. Ahora lo resuelve el backend:
--   - Sin fila en `program_deadlines` → prazo padrão (profiles.created_at + 6
--     meses, calculado en el backend).
--   - Con fila → prazo ajustado por el admin o extendido por una prorrogação.
--
-- Tabla separada (y no una columna en `profiles`) a propósito: la policy
-- `profiles_update_own` deja al parceiro editar su propia fila vía la API de
-- Supabase, y con eso podría cambiar su propio prazo.
--
-- Ambas tablas las escribe y lee solo el backend (service role); sin policies.

create table if not exists public.program_deadlines (
  partner_id uuid primary key references public.profiles (id) on delete cascade,
  deadline_at timestamptz not null,
  note text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.program_deadlines enable row level security;

do $$
begin
  create type public.extension_status as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.deadline_extension_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.profiles (id) on delete cascade,
  status public.extension_status not null default 'pending',
  -- Justificativa opcional do parceiro.
  reason text,
  -- Prazo vigente no momento da solicitação: só se aceita uma solicitação
  -- por prazo (ver deadline-logic.ts).
  previous_deadline_at timestamptz not null,
  -- Novo prazo concedido (só em 'approved').
  new_deadline_at timestamptz,
  admin_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  requested_at timestamptz not null default now()
);

-- No máximo uma solicitação pendente por parceiro.
create unique index if not exists deadline_extension_requests_one_pending_idx
  on public.deadline_extension_requests (partner_id)
  where status = 'pending';

create index if not exists deadline_extension_requests_partner_idx
  on public.deadline_extension_requests (partner_id, requested_at desc);

alter table public.deadline_extension_requests enable row level security;
