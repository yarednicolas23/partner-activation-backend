-- Partner Activation Program (Kaspersky) — schema inicial de autenticación
-- Ejecutar en el SQL editor de Supabase (proyecto dev primero).
-- No usa Supabase CLI migrations todavía; formalizar como migraciones más
-- adelante si el proyecto lo justifica.

create type public.user_role as enum ('partner', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  company_name text,
  role public.user_role not null default 'partner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cada usuario ve y edita solo su propio perfil.
-- El backend usa la service role key para operaciones admin (bypassa RLS),
-- por eso no hace falta una policy explícita de "admin ve todo" aquí.
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Crea automáticamente la fila de `profiles` cuando Supabase Auth crea el
-- `auth.users` (dispara al invitar al partner o al aceptar la invitación,
-- según el flujo). El rol de negocio nace siempre en 'partner'; promover a
-- 'admin' es una operación manual desde el panel de Supabase o vía SQL.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
