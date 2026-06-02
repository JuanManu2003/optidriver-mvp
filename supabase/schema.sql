-- ===========================================================================
-- OptiDriver · Esquema Supabase
-- Ejecuta este script en: Supabase → SQL Editor → New query → Run
-- ===========================================================================

-- ─── Perfiles (extiende auth.users) ────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  first_name  text,
  last_name   text,
  phone       text,
  city        text,
  platform    text,
  hours_per_day int default 8,
  created_at  timestamptz default now()
);

-- ─── Vehículos ──────────────────────────────────────────────────────────────
create table if not exists public.vehicles (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  brand       text not null,
  model       text not null,
  year        int  not null,
  fuel_type   text default 'gasoline',
  engine_cc   int,
  plate_num   text,
  is_default  boolean default true,
  created_at  timestamptz default now()
);

-- ─── Viajes ───────────────────────────────────────────────────────────────
create table if not exists public.trips (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  vehicle_id       bigint references public.vehicles(id),
  started_at       timestamptz default now(),
  ended_at         timestamptz,
  distance_km      numeric default 0,
  duration_min     numeric default 0,
  avg_speed        numeric default 0,
  avg_rpm          numeric default 0,
  avg_fuel_per_100 numeric default 0,
  score            int default 0,
  cost_clp         int default 0,
  savings_clp      int default 0,
  loss_clp         int default 0,
  harsh_brakes     int default 0,
  harsh_accels     int default 0,
  idle_seconds     int default 0,
  source           text default 'simulator',
  created_at       timestamptz default now()
);

-- ─── Row Level Security (cada usuario ve solo lo suyo) ──────────────────────
alter table public.profiles  enable row level security;
alter table public.vehicles  enable row level security;
alter table public.trips     enable row level security;

-- Perfiles
drop policy if exists "perfil propio" on public.profiles;
create policy "perfil propio" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Vehículos
drop policy if exists "vehiculos propios" on public.vehicles;
create policy "vehiculos propios" on public.vehicles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Viajes
drop policy if exists "viajes propios" on public.trips;
create policy "viajes propios" on public.trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Crear perfil automáticamente al registrarse ────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''           -- search_path fijo (recomendación de seguridad)
as $$
begin
  insert into public.profiles (id, first_name, last_name, phone, city, platform, hours_per_day)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'platform',
    coalesce((new.raw_user_meta_data->>'hours_per_day')::int, 8)
  );
  return new;
end;
$$;

-- La función solo debe correr vía trigger, no por la API REST/RPC.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
