const STORAGE_KEY = 'bawaslu.pengingat.suara';

const listeners = new Set();

let audioContext = null;
let unlockArmed = false;

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

  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {})

  return audioContext;
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

const NOTES = [
  { frequency: 1046.5, at: 0 },
  { frequency: 1318.51, at: 0.14 },
  { frequency: 1567.98, at: 0.28 },
];

export function playChime() {
  const context = getAudioContext();
  if (!context) return false;

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

export function playReminderSound() {
  if (!isSoundEnabled()) return false;
  return playChime();
}
