import { useEffect, useState } from 'react';

/**
 * Lacak apakah perangkat sedang punya koneksi internet.
 *
 * Kenapa perlu ada: di lapangan sinyal sering hilang sesaat. Tanpa indikator
 * ini, orang mengira aplikasinya rusak lalu menekan tombol berulang kali.
 * `navigator.onLine` saja tidak cukup karena ia hanya berarti ada jaringan ke
 * Wi-Fi, bukan benar-benar ada internet. Karena itu status "offline" dipakai
 * hanya sebagai petunjuk, sedangkan kegagalan sebenarnya tetap ditentukan
 * dari error Supabase.
 */
export function useOnline() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  );

  useEffect(() => {
    const naik = () => setOnline(true);
    const turun = () => setOnline(false);

    window.addEventListener('online', naik);
    window.addEventListener('offline', turun);

    // Judul tab atau jendela sering dipakai untuk berganti jaringan (misalnya
    // keluar dari Wi-Fi perkantoran ke seluler). Menyinkronkan ulang saat tab
    // kembali terlihat menutup celah di mana status basi.
    const sinkron = () => setOnline(navigator.onLine !== false);
    document.addEventListener('visibilitychange', sinkron);
    window.addEventListener('focus', sinkron);

    return () => {
      window.removeEventListener('online', naik);
      window.removeEventListener('offline', turun);
      document.removeEventListener('visibilitychange', sinkron);
      window.removeEventListener('focus', sinkron);
    };
  }, []);

  return online;
}