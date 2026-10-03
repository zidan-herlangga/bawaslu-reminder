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
-- 6. Tabel todo (daftar tugas) - pribadi per akun
-- =====================================================================

create table if not exists public.todos (
  id          uuid primary key default gen_random_uuid(),
  pemilik_id  uuid not null references auth.users (id) on delete cascade,
  teks        text not null check (length(trim(teks)) between 1 and 300),
  tanggal     date not null default ((now() at time zone 'Asia/Jakarta')::date),
  selesai     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists todos_pemilik_tanggal_idx
  on public.todos (pemilik_id, tanggal);

alter table public.todos enable row level security;

-- 6a. Pengguna hanya boleh membaca todo miliknya sendiri
drop policy if exists "read own todos" on public.todos;
create policy "read own todos"
  on public.todos for select
  to authenticated
  using (auth.uid() = pemilik_id);

-- 6b. Pengguna hanya boleh menambah todo miliknya sendiri
drop policy if exists "insert own todo" on public.todos;
create policy "insert own todo"
  on public.todos for insert
  to authenticated
  with check (auth.uid() = pemilik_id);

-- 6c. Pengguna hanya boleh mengubah todo miliknya sendiri
drop policy if exists "update own todo" on public.todos;
create policy "update own todo"
  on public.todos for update
  to authenticated
  using (auth.uid() = pemilik_id)
  with check (auth.uid() = pemilik_id);

-- 6d. Pengguna hanya boleh menghapus todo miliknya sendiri
drop policy if exists "delete own todo" on public.todos;
create policy "delete own todo"
  on public.todos for delete
  to authenticated
  using (auth.uid() = pemilik_id);

-- =====================================================================
-- 7. Target notifikasi jadwal, tabel notifikasi, dan langganan Web Push
-- =====================================================================

-- 7a. Penerima pengingat. NULL = semua staf. Kolom lama otomatis NULL.
alter table public.schedules
  add column if not exists target_divisi text;

-- 7b. Notifikasi in-app: satu baris per penerima (fan-out).
-- Tidak ada kebijakan INSERT: hanya service role (Vercel Function) yang boleh
-- menulis, supaya staf tidak bisa mengirim notifikasi sembarangan.
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  jadwal_id     uuid references public.schedules (id) on delete cascade,
  pengirim_id   uuid not null references auth.users (id) on delete cascade,
  penerima_id   uuid not null references auth.users (id) on delete cascade,
  judul         text not null check (length(trim(judul)) between 1 and 150),
  pesan         text not null check (length(trim(pesan)) between 1 and 500),
  target_divisi text,
  dibaca        boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists notifications_penerima_idx
  on public.notifications (penerima_id, dibaca, created_at desc);

alter table public.notifications enable row level security;

-- 7b-i. Penerima hanya boleh membaca notifikasinya sendiri
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = penerima_id);

-- 7b-ii. Penerima hanya boleh menandai notifikasinya sendiri
drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications"
  on public.notifications for update
  to authenticated
  using (auth.uid() = penerima_id)
  with check (auth.uid() = penerima_id);

-- 7b-iii. Penerima hanya boleh menghapus notifikasinya sendiri
drop policy if exists "delete own notifications" on public.notifications;
create policy "delete own notifications"
  on public.notifications for delete
  to authenticated
  using (auth.uid() = penerima_id);

-- 7c. Langganan Web Push per perangkat (endpoint FCM/Mozilla + kunci rahasia)
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "read own push subscriptions" on public.push_subscriptions;
create policy "read own push subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "insert own push subscriptions" on public.push_subscriptions;
create policy "insert own push subscriptions"
  on public.push_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "update own push subscriptions" on public.push_subscriptions;
create policy "update own push subscriptions"
  on public.push_subscriptions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own push subscriptions" on public.push_subscriptions;
create policy "delete own push subscriptions"
  on public.push_subscriptions for delete
  to authenticated
  using (auth.uid() = user_id);

-- 7d. Token perangkat untuk aplikasi native (Expo, Android dan iOS)
--
-- Terpisah dari push_subscriptions dengan sengaja. Tabel itu menyimpan
-- endpoint Web Push beserta kunci rahasianya, yang bentuknya tidak ada di
-- native. Mencampur keduanya membuat satu perangkat bisa punya lebih dari satu
-- jenis langganan dan membuat penghapusan lebih rumit.
--
-- Token di sini bukan rahasia: siapa pun yang memegangnya bisa mengirim
-- notifikasi ke perangkat itu saja. Karena itu tabelnya read-only untuk
-- pengguna dan hanya bisa ditambah atau dihapus, tidak bisa dibaca daftar
-- token milik orang lain.
create table if not exists public.device_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  token       text not null unique,
  platform    text not null check (platform in ('android', 'ios')),
  created_at  timestamptz not null default now()
);

create index if not exists device_tokens_user_idx
  on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

-- Tidak ada policy select. Device tidak butuh membaca tokennya sendiri, dan
-- menutup baca mencegah satu akun melihat token perangkat akun lain.

drop policy if exists "insert own device tokens" on public.device_tokens;
create policy "insert own device tokens"
  on public.device_tokens for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "delete own device tokens" on public.device_tokens;
create policy "delete own device tokens"
  on public.device_tokens for delete
  to authenticated
  using (auth.uid() = user_id);

-- =====================================================================
-- 8. Refresh schema cache PostgREST + verifikasi
-- =====================================================================

notify pgrst, 'reload schema';

-- Verifikasi 1: kolom slots + target_divisi harus muncul di daftar.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'schedules'
order by ordinal_position;

-- Verifikasi 2: kolom todos harus muncul di daftar.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'todos'
order by ordinal_position;

-- Verifikasi 3: jumlah kebijakan RLS - todos harus 4, notifications 3,
-- push_subscriptions 4.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('todos', 'notifications', 'push_subscriptions')
order by tablename, policyname;

-- Verifikasi 4: harus mengembalikan 200 / daftar kosong, bukan error 42703.
-- select id, judul, target_divisi from public.schedules limit 1;
-- select id, penerima_id, dibaca from public.notifications limit 1;
-- select id, user_id from public.push_subscriptions limit 1;
