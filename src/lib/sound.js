const STORAGE_KEY = 'bawaslu.pengingat.suara';
const BASE_URL = import.meta.env.BASE_URL;
const DEFAULT_SOUND_URL = `${BASE_URL}notification.wav`;

// Nada khusus per kategori jadwal. Kategori tanpa file sendiri
// (mis. "Lainnya") jatuh balik ke notification.wav.
const SOUND_BY_KATEGORI = {
  Rapat: `${BASE_URL}rapat.wav`,
  Tugas: `${BASE_URL}tugas.wav`,
  Pengawasan: `${BASE_URL}pengawasan.wav`,
};

// Ikon per kategori dipakai sebagai artwork MediaSession, supaya layar kunci
// dan panel notifikasi HP ALSO membedakan jenis pengingat.
const ARTWORK_PER_KATEGORI = {
  Rapat: '/icon-rapat-192.png',
  Tugas: '/icon-tugas-192.png',
  Pengawasan: '/icon-pengawasan-192.png',
};

const NAMA_PER_KATEGORI = {
  Rapat: 'Pengingat Rapat',
  Tugas: 'Pengingat Tugas',
  Pengawasan: 'Pengawasan Jadwal',
};

const listeners = new Set();

let audioContext = null;
let unlockArmed = false;
let activationSeen = false;

const wavBuffers = new Map();
const loadPromises = new Map();

// Dua elemen <audio> per file. Dua cukup supaya pengingat beruntun tidak
// memotong satu sama lain; lebih dari itu boros dan tidak pernah dipakai.
const AUDIO_PER_URL = new Map();
const JUMLAH_PLAYER_PER_URL = 2;

let lockCount = 0;
let pendingKategori;
const busyListeners = new Set();

export function subscribeSound(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitBusy() {
  const busy = lockCount > 0;
  busyListeners.forEach((listener) => listener(busy));

  // Nada yang datang saat masih berbunyi tidak dibuang: dimainkan begitu
  // nada selesai, supaya tidak ada pengingat yang kehilangan suara.
  if (!busy && pendingKategori !== undefined) {
    const kategori = pendingKategori;
    pendingKategori = undefined;
    if (isSoundEnabled()) void playChime(kategori);
  }
}

export function isSoundBusy() {
  return lockCount > 0;
}

export function subscribeSoundBusy(listener) {
  busyListeners.add(listener);
  return () => {
    busyListeners.delete(listener);
  };
}

function acquire() {
  lockCount += 1;
  emitBusy();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    emitBusy();
  };
}

// Chrome/Firefox hanya boleh menjalankan audio setelah interaksi pertama.
function hasActivation() {
  if (activationSeen) return true;

  try {
    if (navigator.userActivation) return navigator.userActivation.hasBeenActive === true;
  } catch {
    /* browser lama: anggap sudah aktif */
  }
  return true;
}

// Menandai bahwa pengguna benar-benar sudah menyentuh halaman.
function hasRealGesture() {
  try {
    if (navigator.userActivation) return navigator.userActivation.hasBeenActive === true;
  } catch {
    return true;
  }
  return activationSeen;
}

function getAudioContext() {
  if (typeof window === 'undefined') return null;

  // Jangan buat AudioContext sebelum gesture. Browser akan menolaknya dan
  // context yang menggantung suspended hanya menghasilkan warning.
  if (!hasRealGesture()) return null;

  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;

  if (!audioContext) audioContext = new Ctor();

  if (!unlockArmed) {
    unlockArmed = true;
    const resume = () => {
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }
    };
    document.addEventListener('pointerdown', resume, { passive: true });
    document.addEventListener('keydown', resume);
  }

  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});

  return audioContext;
}

function resolveSoundUrl(kategori) {
  const key = String(kategori ?? '').trim();
  return SOUND_BY_KATEGORI[key] || DEFAULT_SOUND_URL;
}

function semuaUrlNada() {
  return new Set([...Object.values(SOUND_BY_KATEGORI), DEFAULT_SOUND_URL]);
}

// --- Pemutaran lewat elemen <audio> -------------------------------------
//
// Ini jalur utama. Web Audio (AudioContext) di-suspend Chrome begitu tab
// masuk background, sehingga suara hilang tepat ketika perangkat ada di
// saku dan aplikasi masih terbuka. Elemen <audio> diprioritaskan sebagai
// media oleh browser, jadi playback-nya bertahan di background. Ini yang
// membuat nada per kategori tetap berbunyi di PWA yang tidak terlihat.

// Mengembalikan elemen <audio> yang siap dipakai untuk url tersebut.
function playerUntuk(url) {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;

  let list = AUDIO_PER_URL.get(url);
  if (!list) {
    list = [];
    AUDIO_PER_URL.set(url, list);
  }

  // Pakai elemen yang sedang tidak berbunyi; kalau tidak ada, buat baru
  // sampai batas dua per file.
  let el = list.find((item) => item.paused || item.ended);
  if (!el && list.length < JUMLAH_PLAYER_PER_URL) {
    el = new Audio();
    el.preload = 'auto';
    el.playsInline = true;
    list.push(el);
  }

  if (!el) el = list[0];

  if (el.dataset.url !== url) {
    el.dataset.url = url;
    el.src = url;
    el.load?.();
  }

  return el;
}

// Unduh semua nada sekaligus saat gesture pertama supaya tidak ada jeda
// network saat pengingat tiba.
function preloadSemuaNada() {
  semuaUrlNada().forEach((url) => {
    const el = playerUntuk(url);
    if (!el) return;

    el.muted = true;

    // play() lalu pause() disimpan supaya browser benar-benar mengunduh file.
    // Promise-nya harus ditangkap: tanpa catch, penolakan AbortError dari
    // pause() sesaat setelah play() muncul sebagai galat tak tertangani di
    // console. Penolakan ini memang wajar dan tidak mengganggu apa pun.
    try {
      const promise = el.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => {});
      }
    } catch {
      /* preload tetap berjalan walau autoplay diblokir */
    }

    el.pause();
    el.currentTime = 0;
    el.muted = false;
  });
}

// iOS hanya mengizinkan audio setelah ada gesture. Satu nada yang diputar
// sangat pelan saat gesture pertama "membuka" izin playback untuk elemen lain.
function unlockIos() {
  if (typeof window === 'undefined') return;

  const el = playerUntuk(DEFAULT_SOUND_URL);
  if (!el) return;

  const volumeBefore = el.volume;
  el.muted = true;
  el.volume = 0;
  try {
    const promise = el.play();
    if (promise && typeof promise.then === 'function') promise.then(() => {}).catch(() => {});
  } catch {
    /* abaikan */
  }
  el.pause();
  el.currentTime = 0;
  el.muted = false;
  el.volume = volumeBefore;
}

// Tampilkan nama dan ikon kategori di layar kunci / panel notifikasi.
function pasangMediaSession(kategori) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

  try {
    const artwork = ARTWORK_PER_KATEGORI[String(kategori ?? '').trim()];
    const nama = NAMA_PER_KATEGORI[String(kategori ?? '').trim()];

    if (nama && typeof MediaMetadata === 'function') {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: nama,
        artist: 'Pengingat Jadwal',
        artwork: artwork ? [{ src: artwork, sizes: '192x192', type: 'image/png' }] : [],
      });
    }

    navigator.mediaSession.playbackState = 'playing';
  } catch {
    /* tidak didukung */
  }
}

// fetch tanpa timeout bisa menggantung selamanya di jaringan buruk, dan itu
// berarti kunci nada ikut terkunci terus -> suara mati total sampai reload.
function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { cache: 'force-cache', signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

// Cadangan terakhir: kalau elemen <audio> gagal (format tidak didukung atau
// autoplay diblokir total), pakai Web Audio. Jalur ini hanya dipakai kalau
// AudioContext sudah aktif.
function ensureSoundLoaded(url) {
  if (loadPromises.has(url)) return loadPromises.get(url);

  const promise = (async () => {
    const context = getAudioContext();
    if (!context) return null;

    try {
      const response = await fetchWithTimeout(url, 5000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const bytes = await response.arrayBuffer();
      const buffer = await context.decodeAudioData(bytes);
      wavBuffers.set(url, buffer);
      return buffer;
    } catch (error) {
      console.warn(`[sound] ${url} tidak bisa dimuat, pakai nada bawaan.`, error);
      wavBuffers.set(url, null);
      loadPromises.delete(url);
      if (url !== DEFAULT_SOUND_URL) return ensureSoundLoaded(DEFAULT_SOUND_URL);
      return null;
    }
  })();

  loadPromises.set(url, promise);
  return promise;
}

function armAudioOnGesture() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const boot = () => {
    activationSeen = true;
    getAudioContext();
    unlockIos();
    preloadSemuaNada();
    document.removeEventListener('pointerdown', boot, true);
    document.removeEventListener('keydown', boot, true);
  };

  document.addEventListener('pointerdown', boot, { once: true, capture: true, passive: true });
  document.addEventListener('keydown', boot, { once: true, capture: true });
}

if (typeof window !== 'undefined') {
  armAudioOnGesture();
}

// Pola nada cadangan per kategori. Dipakai hanya kalau file WAV gagal dimuat
// (jaringan buruk atau format tidak didukung). Tanpa ini ketiga kategori akan
// berbunyi identik saat fallback terpakai, jadi perbedaan jenis pengingat
// hilang tepat ketika pengguna paling butuh memastikan.
// Rapat: nada naik tiga tingkat (ringan). Tugas: nada turun tiga tingkat
// (menekan). Pengawasan: nada panjang dua tingkat (serius).
const POLA_NADA = {
  Rapat: [1046.5, 1318.51, 1567.98],
  Tugas: [1567.98, 1318.51, 1046.5],
  Pengawasan: [880, 1174.66],
};

const POLA_NADA_DEFAULT = [1046.5, 1318.51, 1567.98];

const JARAK_NADA_MS = 0.14;
const PANJANG_NADA_MS = 0.55;
const PANJANG_TOTAL_MS = 1300;

function playSynth(context, kategori, onDone) {
  const start = context.currentTime + 0.02;
  const durationMs = Math.max(0, (start - context.currentTime) * 1000) + PANJANG_TOTAL_MS;

  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, start + 1.15);
  master.connect(context.destination);

  const nada = POLA_NADA[kategori] || POLA_NADA_DEFAULT;

  nada.forEach((frequency, index) => {
    const at = start + index * JARAK_NADA_MS;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, at);

    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.9, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + PANJANG_NADA_MS);

    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(at);
    oscillator.stop(at + PANJANG_NADA_MS);
  });

  if (onDone) setTimeout(onDone, durationMs);

  return true;
}

export function isSoundEnabled() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

// Browser memblokir audio sampai pengguna pernah berinteraksi di halaman ini.
// Selama belum terjadi, nada notifikasi yang masuk lewat push tidak akan
// berbunyi though notifikasinya tetap tampil, jadi UI perlu memberi tahu.
export function hasSoundActivation() {
  return hasActivation();
}

// Berlangganan perubahan status aktivasi supaya indikator di UI hilang sendiri
// begitu pengguna menyentuh halaman, tanpa perlu reload.
const activationListeners = new Set();

if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    () => activationListeners.forEach((listener) => listener(true)),
    { capture: true, passive: true }
  );
  document.addEventListener(
    'keydown',
    () => activationListeners.forEach((listener) => listener(true)),
    { capture: true }
  );
}

export function subscribeSoundActivation(listener) {
  activationListeners.add(listener);
  return () => {
    activationListeners.delete(listener);
  };
}

export function setSoundEnabled(enabled) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* mode privat: abaikan */
  }
  listeners.forEach((listener) => listener(enabled));
}

// Memutar file WAV lewat elemen <audio>. Mengembalikan true kalau playback
// benar-benar dimulai.
function playViaElement(url, release) {
  const el = playerUntuk(url);
  if (!el) return false;

  let selesai = false;
  let watchdog = null;

  const selesaiMain = () => {
    if (selesai) return;
    selesai = true;
    if (watchdog) clearTimeout(watchdog);
    release();
  };

  try {
    el.currentTime = 0;
  } catch {
    /* belum ada metadata */
  }

  el.onended = selesaiMain;
  el.onerror = selesaiMain;

  // Batas waktu mencegah kunci nada macet kalau 'ended' tidak pernah datang,
  // misalnya elemen dibekukan browser saat tab diem. Durasi diambil dari
  // metadata kalau sudah tersedia, kalau belum pakai batas yang aman.
  let durasiMs = 12000;
  if (Number.isFinite(el.duration) && el.duration > 0) {
    durasiMs = Math.min(30000, Math.max(2000, el.duration * 1000 + 1500));
  }
  watchdog = setTimeout(selesaiMain, durasiMs);

  try {
    const promise = el.play();
    if (promise && typeof promise.then === 'function') {
      promise
        .then(() => {})
        .catch(() => {
          // Ditolak autoplay: lepas kunci supaya nada berikutnya tetap
          // punya kesempatan, lalu biar jalur cadangan yang menangani.
          selesaiMain();
          return false;
        });
    }
    return true;
  } catch {
    selesaiMain();
    return false;
  }
}

// Cadangan Web Audio dipakai kalau elemen <audio> tidak bisa berjalan.
async function playViaWebAudio(url, kategori, release) {
  const context = getAudioContext();
  if (!context) {
    release();
    return false;
  }

  let buffer = wavBuffers.get(url);
  if (buffer === undefined) buffer = await ensureSoundLoaded(url);

  if (context.state !== 'running') {
    await Promise.race([
      context.resume().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 800)),
    ]);
  }

  if (context.state !== 'running') {
    console.warn(`[sound] dilewatkan: AudioContext tetap ${context.state}`);
    release();
    return false;
  }

  if (buffer) {
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = 1;
    source.connect(gain);
    gain.connect(context.destination);

    let selesai = false;
    let watchdog = null;
    const selesaiMain = () => {
      if (selesai) return;
      selesai = true;
      if (watchdog) clearTimeout(watchdog);
      release();
    };
    source.onended = selesaiMain;
    watchdog = setTimeout(selesaiMain, Math.min(30000, Math.max(2000, buffer.duration * 1000 + 1500)));
    source.start();
    return true;
  }

  playSynth(context, kategori, release);
  return true;
}

export async function playChime(kategori) {
  // Satu nada pada satu waktu: klik berulang selama nada masih berbunyi
  // diabaikan.
  if (lockCount > 0) {
    console.warn('[sound] dilewatkan: nada sebelumnya belum selesai');
    return false;
  }

  if (!hasActivation()) {
    console.warn('[sound] dilewatkan: belum ada gesture pengguna');
    return false;
  }

  const release = acquire();
  const url = resolveSoundUrl(kategori);
  pasangMediaSession(kategori);

  // Jalur utama: elemen <audio>. Kalau gagal, baru coba Web Audio.
  if (playViaElement(url, release)) return true;

  return playViaWebAudio(url, kategori, release);
}

export async function playReminderSound(kategori) {
  if (!isSoundEnabled()) return false;

  // Sedang berbunyi -> jangan dibuang, tunggu giliran lewat emitBusy().
  if (lockCount > 0) {
    pendingKategori = kategori;
    return false;
  }

  return playChime(kategori);
}