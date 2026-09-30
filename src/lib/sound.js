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

const listeners = new Set();

let audioContext = null;
let unlockArmed = false;
const wavBuffers = new Map();
const loadPromises = new Map();

let lockCount = 0;
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

// Chrome/Firefox hanya boleh membuat/menjalankan AudioContext setelah gesture
// pertama. Sebelum itu, semua permintaan nada dibatalkan tanpa mengunci tombol.
function hasActivation() {
  try {
    if (navigator.userActivation) return navigator.userActivation.hasBeenActive === true;
  } catch {
    /* browser lama: anggap sudah aktif */
  }
  return true;
}

function getAudioContext() {
  if (typeof window === 'undefined') return null;

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

function ensureSoundLoaded(url) {
  if (loadPromises.has(url)) return loadPromises.get(url);

  const promise = (async () => {
    const context = getAudioContext();
    if (!context) return null;

    try {
      const response = await fetch(url, { cache: 'force-cache' });
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
  if (typeof window === 'undefined' || typeof document === 'undefined' || unlockArmed) return;

  const boot = () => {
    getAudioContext();
    ensureSoundLoaded(DEFAULT_SOUND_URL);
    document.removeEventListener('pointerdown', boot, true);
    document.removeEventListener('keydown', boot, true);
  };

  document.addEventListener('pointerdown', boot, { once: true, capture: true, passive: true });
  document.addEventListener('keydown', boot, { once: true, capture: true });
}

if (typeof window !== 'undefined') {
  armAudioOnGesture();
}

function playSource(context, buffer, volume, onDone) {
  const source = context.createBufferSource();
  const gain = context.createGain();

  source.buffer = buffer;
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(context.destination);
  if (onDone) source.onended = onDone;
  source.start();

  return source;
}

// onended tidak pernah terpanggil jika context tertahan suspended, jadi kunci
// selalu punya batas waktu agar tombol tidak macet selamanya.
function startWav(context, buffer, release) {
  let finished = false;
  let watchdog = null;

  const finish = () => {
    if (finished) return;
    finished = true;
    if (watchdog) clearTimeout(watchdog);
    release();
  };

  const limitMs = Math.min(15000, Math.max(2000, buffer.duration * 1000 + 1500));
  watchdog = setTimeout(finish, limitMs);

  playSource(context, buffer, 1, finish);
}

const NOTES = [
  { frequency: 1046.5, at: 0 },
  { frequency: 1318.51, at: 0.14 },
  { frequency: 1567.98, at: 0.28 },
];

function playSynth(context, onDone) {
  const start = context.currentTime + 0.02;
  const durationMs = Math.max(0, (start - context.currentTime) * 1000) + 1300;

  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, start);
  master.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, start + 1.15);
  master.connect(context.destination);

  NOTES.forEach((note) => {
    const at = start + note.at;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(note.frequency, at);

    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.9, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.55);

    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(at);
    oscillator.stop(at + 0.6);
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

export function setSoundEnabled(enabled) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* mode privat: abaikan */
  }
  listeners.forEach((listener) => listener(enabled));
}

export async function playChime(kategori) {
  // Satu nada pada satu waktu: klik berulang selama nada masih berbunyi diabaikan.
  if (lockCount > 0) return false;

  // Belum ada gesture sama sekali -> jangan buat AudioContext, jangan kunci tombol.
  if (!hasActivation()) return false;

  const release = acquire();
  let handedOff = false;

  try {
    const context = getAudioContext();
    if (!context) return false;

    const buffer = await ensureSoundLoaded(resolveSoundUrl(kategori));

    if (context.state !== 'running') {
      await Promise.race([
        context.resume().catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);
    }
    if (context.state !== 'running') return false;

    if (buffer) {
      startWav(context, buffer, release);
      handedOff = true;
      return true;
    }

    playSynth(context, release);
    handedOff = true;
    return true;
  } finally {
    if (!handedOff) release();
  }
}

export async function playReminderSound(kategori) {
  if (!isSoundEnabled()) return false;
  return playChime(kategori);
}
