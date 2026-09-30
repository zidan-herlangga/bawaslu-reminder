const STORAGE_KEY = 'bawaslu.pengingat.suara';
const SOUND_URL = `${import.meta.env.BASE_URL}notification.wav`;

const listeners = new Set();

let audioContext = null;
let unlockArmed = false;
let wavBuffer = null;
let loadPromise = null;

export function subscribeSound(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
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

function ensureNotificationLoaded() {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const context = getAudioContext();
    if (!context) return null;

    try {
      const response = await fetch(SOUND_URL, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const bytes = await response.arrayBuffer();
      wavBuffer = await context.decodeAudioData(bytes);
      return wavBuffer;
    } catch (error) {
      console.warn('[sound] notification.wav tidak bisa dimuat, pakai nada bawaan.', error);
      wavBuffer = null;
      return null;
    }
  })();

  return loadPromise;
}

function armAudioOnGesture() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || unlockArmed) return;

  const boot = () => {
    getAudioContext();
    ensureNotificationLoaded();
    document.removeEventListener('pointerdown', boot, true);
    document.removeEventListener('keydown', boot, true);
  };

  document.addEventListener('pointerdown', boot, { once: true, capture: true, passive: true });
  document.addEventListener('keydown', boot, { once: true, capture: true });
}

if (typeof window !== 'undefined') {
  armAudioOnGesture();
}

function playSource(context, buffer, volume) {
  const source = context.createBufferSource();
  const gain = context.createGain();

  source.buffer = buffer;
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(context.destination);
  source.start();

  return source;
}

const NOTES = [
  { frequency: 1046.5, at: 0 },
  { frequency: 1318.51, at: 0.14 },
  { frequency: 1567.98, at: 0.28 },
];

function playSynth(context) {
  const start = context.currentTime + 0.02;

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

export async function playChime() {
  const context = getAudioContext();
  if (!context) return false;

  const decoded = await ensureNotificationLoaded();

  if (decoded) {
    playSource(context, decoded, 1);
    return true;
  }

  return playSynth(context);
}

export async function playReminderSound() {
  if (!isSoundEnabled()) return false;
  return playChime();
}
