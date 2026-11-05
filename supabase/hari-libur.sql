-- Tabel hari libur nasional dan cuti bersama
create table if not exists public.hari_libur (
  id uuid primary key default gen_random_uuid(),
  tanggal date not null unique,
  keterangan text not null,
  jenis text not null check (jenis in ('libur_nasional','cuti_bersama')),
  tahun int not null,
  created_at timestamptz not null default now()
);

alter table public.hari_libur enable row level security;

drop policy if exists "hari_libur_select_authenticated" on public.hari_libur;
create policy "hari_libur_select_authenticated" on public.hari_libur
  for select using (auth.uid() is not null);

drop policy if exists "hari_libur_insert_authenticated" on public.hari_libur;
create policy "hari_libur_insert_authenticated" on public.hari_libur
  for insert with check (auth.uid() is not null);

drop policy if exists "hari_libur_update_authenticated" on public.hari_libur;
create policy "hari_libur_update_authenticated" on public.hari_libur
  for update using (auth.uid() is not null);
