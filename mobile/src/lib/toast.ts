// Toast sederhana untuk aplikasi native.
//
// Web memakai pub/sub supaya komponen mana pun bisa memunculkan toast dari
// provider di layout. Di native tidak ada portal, jadi cukup satu modul: layar
// yang Rentan dari mana pun cukup memanggil showToast, dan layarnya yang
// memerhatikannya.

export type NadaToast = 'sukses' | 'galat' | 'info';

export interface PesanToast {
  pesan: string;
  nada: NadaToast;
}

type Pendengar = (item: PesanToast) => void;

const pendengar = new Set<Pendengar>();

export function subscribeToast(listener: Pendengar): () => void {
  pendengar.add(listener);
  return () => {
    pendengar.delete(listener);
  };
}

export function showToast(pesan: string, nada: NadaToast = 'info'): void {
  if (!pesan) return;
  const item: PesanToast = { pesan: String(pesan), nada };
  for (const listener of pendengar) listener(item);
}
