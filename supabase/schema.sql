-- Jalankan di Supabase Dashboard > SQL Editor > New query > Run.

-- 1. Tabel profil pengguna
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nama_lengkap text not null check (length(trim(nama_lengkap)) between 1 and 200),
  email       text not null unique,
  divisi      text not null check (length(trim(divisi)) > 0),
  jabatan     text not null check (length(trim(jabatan)) > 0),
  role_akses  text not null default 'Staf' check (role_akses = 'Staf'),
  status_akun text not null default 'Aktif' check (status_akun = 'Aktif'),
  created_at  timestamptz not null default now()
);

-- 2. Aktifkan Row Level Security pada profil
alter table public.profiles enable row level security;

-- 3. Kebijakan profil: tiap pengguna hanya boleh menyentuh barisnya sendiri
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role_akses = 'Staf'
    and status_akun = 'Aktif'
  );

drop policy if exists "delete own profile" on public.profiles;
create policy "delete own profile"
  on public.profiles for delete
  using (auth.uid() = id);

-- =====================================================================
-- 4. Tabel jadwal
-- =====================================================================

create table if not exists public.schedules (
  id             uuid primary key default gen_random_uuid(),
  pembuat_id     uuid not null references auth.users (id) on delete cascade,
  pembuat_nama   text not null check (length(trim(pembuat_nama)) between 1 and 200),
  pembuat_divisi text not null check (length(trim(pembuat_divisi)) > 0),
  judul          text not null check (length(trim(judul)) between 1 and 150),
  deskripsi      text not null default '',
  kategori       text not null default 'Lainnya',
  waktu_mulai    timestamptz not null,
  waktu_selesai  timestamptz,
  -- Daftar sesi tanggal & jam: [{"mulai":"<iso>","selesai":"<iso>|null"}, ...]
  -- waktu_mulai/waktu_selesai di atas selalu berisi sesi paling awal / paling akhir
  -- agar pengurutan, indeks, dan ringkasan tetap bekerja tanpa join.
  slots          jsonb not null default '[]'::jsonb,
  status         text not null default 'Aktif'
                 check (status in ('Aktif', 'Selesai', 'Dibatalkan')),
  created_at     timestamptz not null default now(),
  check (jsonb_typeof(slots) = 'array'),
  check (waktu_selesai is null or waktu_selesai >= waktu_mulai)
);

-- Aman dijalankan berulang: menambahkan kolom slots jika tabel sudah terlanjur dibuat.
alter table if exists public.schedules
  add column if not exists slots jsonb not null default '[]'::jsonb;

-- Pastikan constraint cek jsonb_typeof(slots) ikut ada pada tabel lama.
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.schedules'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%jsonb_typeof%slots%'
  ) then
    alter table public.schedules
      add constraint schedules_slots_is_array
      check (jsonb_typeof(slots) = 'array');
  end if;
end $$;

-- Isi ulang slots untuk baris lama yang masih kosong.
update public.schedules
set slots = jsonb_build_array(
      jsonb_build_object(
        'mulai',  to_char(waktu_mulai  at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'selesai', case when waktu_selesai is null then null
                        else to_char(waktu_selesai at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                   end
      )
    )
where slots = '[]'::jsonb
  and waktu_mulai is not null;

create index if not exists schedules_waktu_mulai_idx
  on public.schedules (waktu_mulai);

create index if not exists schedules_pembuat_idx
  on public.schedules (pembuat_id);

alter table public.schedules enable row level security;

-- 4a. Semua pengguna login boleh melihat seluruh jadwal
drop policy if exists "read all schedules" on public.schedules;
create policy "read all schedules"
  on public.schedules for select
  to authenticated
  using (true);

-- 4b. Pengguna hanya boleh membuat jadwal atas namanya sendiri
drop policy if exists "insert own schedule" on public.schedules;
create policy "insert own schedule"
  on public.schedules for insert
  to authenticated
  with check (auth.uid() = pembuat_id);

-- 4c. Hanya pembuat yang boleh mengubah jadwalnya
drop policy if exists "update own schedule" on public.schedules;
create policy "update own schedule"
  on public.schedules for update
  to authenticated
  using (auth.uid() = pembuat_id)
  with check (auth.uid() = pembuat_id);

-- 4d. Hanya pembuat yang boleh menghapus jadwalnya
drop policy if exists "delete own schedule" on public.schedules;
create policy "delete own schedule"
  on public.schedules for delete
  to authenticated
  using (auth.uid() = pembuat_id);

-- =====================================================================
-- 5. (OPSIONAL) Trigger profil otomatis.
-- Aktifkan hanya jika "Confirm email" dinyalakan di Supabase > Authentication >
-- Settings, karena saat itu client belum punya sesi saat pendaftaran.
-- Jika Confirm email DIMATIKAN, jangan aktifkan ini agar tidak dobel tulis.
-- =====================================================================

-- create or replace function public.handle_new_user()
-- returns trigger
-- language plpgsql
-- security definer set search_path = ''
-- as $$
-- begin
--   insert into public.profiles
--     (id, nama_lengkap, email, divisi, jabatan, role_akses, status_akun)
--   values (
--     new.id,
--     coalesce(new.raw_user_meta_data ->> 'nama_lengkap', ''),
--     new.email,
--     coalesce(new.raw_user_meta_data ->> 'divisi', ''),
--     coalesce(new.raw_user_meta_data ->> 'jabatan', ''),
--     'Staf',
--     'Aktif'
--   )
--   on conflict (id) do nothing;
--   return new;
-- end;
-- $$;
--
-- drop trigger if exists on_auth_user_created on auth.users;
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute function public.handle_new_user();

-- =====================================================================
-- 6. Refresh schema cache PostgREST + verifikasi
-- =====================================================================

notify pgrst, 'reload schema';

-- Verifikasi 1: kolom slots harus muncul di daftar.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'schedules'
order by ordinal_position;

-- Verifikasi 2: harus mengembalikan 200 / daftar kosong, bukan error 42703.
-- select id, judul, slots from public.schedules limit 1;
