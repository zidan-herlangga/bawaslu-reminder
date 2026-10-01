function broadcastShown(id) {
  if (!id) return Promise.resolve();

  return self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((list) => {
      list.forEach((client) => {
        try {
          client.postMessage({ type: 'bawaslu-push-shown', id: String(id) });
        } catch {
          /* abaikan */
        }
      });
    })
    .catch(() => {});
}

// Ikon per kategori. Service worker tidak bisa memutar audio, jadi warna ikon
// adalah pembeda yang selalu terlihat di panel notifikasi, termasuk saat
// aplikasi sudah ditutup total.
const IKON_PER_KATEGORI = {
  Rapat: '/icon-rapat-192.png',
  Tugas: '/icon-tugas-192.png',
  Pengawasan: '/icon-pengawasan-192.png',
};

const IKON_DEFAULT = '/icon-192.png';

// Pola getaran dibedakan per kategori supaya penerima bisa merasakan jenis
// pengingat tanpa melihat layar. Service worker tidak punya AudioContext,
// jadi nada kustom hanya bisa dimainkan oleh halaman yang sedang terbuka;
// suara saat aplikasi tertutup tetap bawaan sistem.
const GETARAN_PER_KATEGORI = {
  Rapat: [200, 80, 200],
  Tugas: [120, 60, 120, 60, 120],
  Pengawasan: [300, 100, 300],
};

const GETARAN_DEFAULT = [180, 90, 180];

// Tanpa skipWaiting, service worker lama tetap melayani push sampai semua
// tab PWA ditutup. Akibatnya notifikasi per kategori tidak pernah sampai ke
// perangkat yang suduh dipakai harian.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const kategori = payload.kategori || null;
  const getaran = (kategori && GETARAN_PER_KATEGORI[kategori]) || GETARAN_DEFAULT;
  const ikon = (kategori && IKON_PER_KATEGORI[kategori]) || IKON_DEFAULT;
  const title = payload.title || 'Pengingat jadwal';
  const options = {
    body: payload.body || '',
    icon: ikon,
    badge: ikon,
    // Tag memuat kategori supaya pengingat rapat dan tugas tidak saling
    // menggantikan di panel notifikasi.
    tag: payload.tag || payload.id || 'bRi-jadwal',
    renotify: true,
    // Ditulis eksplisit supaya tidak pernah ikut diam kalau setelan sistem
    // sebelumnya menyalakan mode senyap untuk notifikasi ini.
    silent: false,
    requireInteraction: false,
    vibrate: getaran,
    data: { url: payload.url || '/', kategori },
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      broadcastShown(payload.id),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
