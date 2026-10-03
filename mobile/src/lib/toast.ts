// Toast sederhana untuk aplikasi native.
//
// Web memakai pub/sub supaya komponen mana pun bisa memunculkan toast dari
// provider di layout. Di native tidak ada portal, jadi cukup satu modul: kode
// di mana pun cukup memanggil showToast, dan ToastHost (dipasang sekali di
// layout akar) yang berlangganan dan menampilkannya.

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

  // Disalin dulu supaya berhenti berlangganan di tengah pengiriman tidak
  // mengacaukan iterasi, dan satu pendengar yang melempar galat tidak membuat
  // pendengar lain tidak kebagian pesan.
  for (const listener of Array.from(pendengar)) {
    try {
      listener(item);
    } catch (kesalahan) {
      console.warn('[toast] pendengar gagal:', kesalahan);
    }
  }
}