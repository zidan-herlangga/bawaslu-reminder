-- Penjadwalan pengingat otomatis.
--
-- Jalankan satu kali di Supabase > SQL Editor > New query.
--
--
-- Kenapa ini perlu ada
-- -------------------
-- Pengingat yang dijadwalkan di perangkat dibatalkan Android begitu proses
-- aplikasi berhenti. Officer juga tidak pernah membuka aplikasi tepat 15 menit
-- sebelum rapat, jadi pengingat di perangkat tidak bisa diandalkan sebagai
-- satu-satunya pengingat.
--
-- Yang di sini berjalan di server. Cron memanggil /api/pengingat-terjadwal
-- setiap menit, endpoint itu mencari jadwal yang masuk jendela 15 menit, lalu
-- menulis ke tabel notifications dan mengirim web push serta FCM. Aplikasi tidak
-- perlu terbuka sama sekali.
--
--
-- Yang perlu diisi lebih dulu
-- --------------------------
-- 1. URL Vercel produksi. Ganti https://GANTI-DOMAIN-ANDA.vercel.app di bawah.
-- 2. Rahasia yang sama dengan CRON_SECRET di Vercel > Environment Variables.
--    Buat nilainya dengan perintah ini, lalu tempel di kedua tempat:
--
--      node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
--
-- Rahasia itu menjaga endpoint supaya tidak bisa dipanggil orang luar yang
-- menebak URL-nya. Tanpa itu, siapa pun bisa membuat server mengirim push ke
-- seluruh staf.
--
--
-- Kenapa pakai pg_cron dan bukan cron di Vercel
-- --------------------------------------------
-- Cron Vercel hanya boleh berjalan tiap menit di paket Pro. Kalau proyek ini
-- di paket Hobby, jadwal tiap menit akan ditolak saat deploy. pg_cron milik
-- Supabase tidak punya batas itu, jadi pilihan ini aman di paket apa pun.


-- 1. Ekstensi. pg_cron menjadwalkan, pg_net melakukan HTTP request.
create extension if not exists pg_cron;
create extension if not exists pg_net;


-- 2. Simpan rahasia di Vault, bukan ditulis langsung di dalam jadwal.
--    Baris ini gagal kalau namanya sudah ada, jadi yang kedua dihapus dulu.
--    Jalankan blok hapus di bawah sebelum menjalankan blok ini bila perlu
--    mengganti nilai.
--
--    GANTI NILAI RAHASIA DI SINI
select vault.create_secret(
  'GANTI-DENGAN-RAHASIA-DARI-PERINTAH-NODE-DI-ATAS',
  'cron_pengingat'
);


-- 3. Pasang jadwalnya.
--   _unschedule lebih dulu supaya blok ini boleh dijalankan berulang kali tanpa
--    membuat job ganda. Job ganda akan mengirim pengingat berulang.
select cron.unschedule(jobid)
from cron.job
where jobname = 'pengingat-terjadwal';

select cron.schedule(
  'pengingat-terjadwal',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://GANTI-DOMAIN-ANDA.vercel.app/api/pengingat-terjadwal',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'cron_pengingat'
        )
      ),
      timeout_milliseconds := 30000
    );
  $$
);


-- 4. Periksa hasilnya.
--
--    Job harus terlihat. Kolom schedule harus berisi * * * * *.
select jobid, jobname, schedule, active
from cron.job
where jobname = 'pengingat-terjadwal';

--    Riwayat pemanggilan. run_success berubah dari false ke true kalau endpoint
--    menjawab 2xx. Kalau selalu false, periksa tiga hal: URL salah, CRON_SECRET
--    di Vercel tidak sama dengan yang disimpan di Vault, atau endpoint belum
--    ter-deploy.
--
--    Jalankan ini sekitar 1-2 menit setelah memasang jadwal:
--
-- select
--   status_code,
--   content::text,
--   started_at
-- from net._http_response
-- order by id desc
-- limit 5;


-- Catatan untuk mengganti rahasia di kemudian hari
-- ---------------------------------------------
--   select vault.delete_secret('cron_pengingat');
-- lalu ulangi langkah 2 dan 3. Nilai di Vercel juga harus diperbarui, kalau
-- tidak keduanya berbeda dan semua pemanggilan ditolak dengan 401.