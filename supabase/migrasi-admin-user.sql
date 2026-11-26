-- Migrasi: Admin & User management
-- Jalankan di Supabase Dashboard > SQL Editor > New query > Run.
-- Aman dijalankan berulang (idempoten sebisa mungkin).

-- 1) Perluas role_akses dan status_akun
alter table public.profiles drop constraint if exists profiles_role_akses_check;
alter table public.profiles drop constraint if exists profiles_status_akun_check;

update public.profiles
set role_akses = 'User'
where role_akses is null
   or role_akses not in ('Admin', 'User');

update public.profiles
set status_akun = 'Aktif'
where status_akun is null
   or status_akun not in ('Aktif', 'Nonaktif');

alter table public.profiles
  alter column role_akses set default 'User';

alter table public.profiles
  add constraint profiles_role_akses_check
  check (role_akses in ('Admin', 'User'));

alter table public.profiles
  add constraint profiles_status_akun_check
  check (status_akun in ('Aktif', 'Nonaktif'));

-- 2) Helper admin (SECURITY DEFINER agar tidak rekursif di RLS)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role_akses = 'Admin'
      and p.status_akun = 'Aktif'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 3) RLS: admin boleh update profil siapa pun
drop policy if exists "admin update any profile" on public.profiles;
create policy "admin update any profile"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 4) RLS: admin boleh insert profil (fallback; create user utama lewat API service role)
drop policy if exists "admin insert profile" on public.profiles;
create policy "admin insert profile"
  on public.profiles for insert
  to authenticated
  with check (public.is_admin());

-- 5) Perbarui policy insert/update own profile (default role User, admin tetap Admin)
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile"
  on public.profiles for insert
  to authenticated
  with check (
    auth.uid() = id
    and role_akses = 'User'
    and status_akun = 'Aktif'
  );

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role_akses = case when public.is_admin() then 'Admin' else 'User' end
    and status_akun = 'Aktif'
  );

-- 6) Set admin pertama secara manual (ganti email)
-- update public.profiles
-- set role_akses = 'Admin'
-- where lower(email) = lower('admin@contoh.com');

-- 7) Muat ulang schema cache PostgREST
notify pgrst, 'reload schema';

-- Verifikasi
select id, nama_lengkap, email, role_akses, status_akun
from public.profiles
order by created_at;