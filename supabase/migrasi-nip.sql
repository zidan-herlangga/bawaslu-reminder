-- Tambah kolom NIP ke tabel profiles.
-- Jalankan di Supabase Dashboard > SQL Editor > New query > Run.
-- Aman dijalankan berulang.

alter table public.profiles
  add column if not exists nip varchar(18);

-- NIP harus unik kalau diisi; baris lama yang belum punya NIP dibiarkan NULL.
create unique index if not exists profiles_nip_key
  on public.profiles (nip)
  where nip is not null;

-- Batasi panjangnya 18 digit angka saja (kosong/NULL tetap diizinkan).
alter table public.profiles
  drop constraint if exists profiles_nip_format;

alter table public.profiles
  add constraint profiles_nip_format
  check (nip is null or nip ~ '^[0-9]{18}$');

-- Isi NIP untuk akun yang login memakai email <nip>@bawaslu.local.
-- Baris lain (email asli) tidak diubah.
update public.profiles
set nip = split_part(email, '@', 1)
where nip is null 
  and email like '%@bawaslu.local'
  and split_part(email, '@', 1) ~ '^[0-9]{18}$';

-- Muat ulang cache skema PostgREST supaya kolom baru langsung dikenali API.
notify pgrst, 'reload schema';

-- Verifikasi
select id, nama_lengkap, email, nip, divisi, jabatan
from public.profiles
order by created_at;
