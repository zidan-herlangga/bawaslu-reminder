const listeners = new Set();

export function subscribeToast(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function showToast(message, tone = 'info') {
  if (!message) return;
  const item = { message: String(message), tone, at: Date.now() };
  listeners.forEach((listener) => listener(item));
}
