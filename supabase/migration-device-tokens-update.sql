-- ============================================================================
-- PERBAIKAN NOTIFIKASI PUSH ANDROID — LANGSUNG SALIN & JALANKAN
-- ----------------------------------------------------------------------------
-- Proyek : bawaslu-reminder (Supabase)
-- Cara   : Supabase Dashboard > SQL Editor > New query > tempel > Run
-- Sifat  : idempotent (aman dijalankan berulang)
--
-- MASALAH  : Aplikasi gagal mendaftarkan token perangkat. Tombol
--            "Push dari server" di tab Akun menampilkan:
--              Menyimpan token ditolak server: new row violates row-level
--              security policy for table "device_tokens" - 42501
--
-- PENYEBAB : Supabase client menyimpan token lewat UPSERT (on_conflict=token).
--            Dua syarat Postgres untuk jalur itu tidak terpenuhi:
--              1) PostgREST melakukan read-back setelah INSERT; read-back itu
--                 tunduk pada RLS, jadi butuh policy SELECT.
--              2) Klausa "on conflict (token)" WAJIB membaca kolom conflict
--                 target, jadi butuh hak SELECT pada tabel.
--            device_tokens sengaja dibuat TANPA policy SELECT (dan tanpa
--            UPDATE). Akibatnya seluruh upsert ditolak dengan 42501.
--
-- PERBAIKAN: Pasang 4 policy (select, insert, update, delete) untuk token
--            milik sendiri. Semua dibatasi auth.uid() = user_id.
--
-- ISINYA   : 1) Policy select/insert/update/delete sesuai schema.sql, supaya
--               DB mendapatkan definisi lengkap dan bisa dipakai di proyek baru.
--            2) Kueri pembuktian di penghujung: harus keluar 4 baris.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Policy SELECT — INI YANG PALING MEMPERBAIKI MASALAH.
--
--    Dibutuhkan oleh read-back PostgREST setelah INSERT DAN oleh klausa
--    ON CONFLICT (token) yang wajib membaca kolom token.
-- ----------------------------------------------------------------------------
drop policy if exists "select own device tokens" on public.device_tokens;
create policy "select own device tokens"
  on public.device_tokens for select
  to authenticated
  using (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 2) Policy INSERT — token baru milik sendiri.
-- ----------------------------------------------------------------------------
drop policy if exists "insert own device tokens" on public.device_tokens;
create policy "insert own device tokens"
  on public.device_tokens for insert
  to authenticated
  with check (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 3) Policy UPDATE — jalur konflik dari upsert (token sudah ada).
-- ----------------------------------------------------------------------------
drop policy if exists "update own device tokens" on public.device_tokens;
create policy "update own device tokens"
  on public.device_tokens for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 4) Policy DELETE — hapus token milik sendiri (mis. saat keluar akun).
-- ----------------------------------------------------------------------------
drop policy if exists "delete own device tokens" on public.device_tokens;
create policy "delete own device tokens"
  on public.device_tokens for delete
  to authenticated
  using (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 5) PEMBUKTIAN — harus menghasilkan EMPAT baris:
--
--    delete own device tokens  | DELETE
--    insert own device tokens  | INSERT
--    select own device tokens  | SELECT
--    update own device tokens  | UPDATE
-- ----------------------------------------------------------------------------
select policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename = 'device_tokens'
 order by cmd;