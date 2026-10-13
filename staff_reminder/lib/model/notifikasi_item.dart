/// Satu baris pada kotak masuk notifikasi (`notifications`).
///
/// Berbeda dari [Notifikasi] di `layanan/notifikasi.dart` (yang menangani push
/// FCM), model ini hanya membawa data baris dari tabel `notifications` untuk
/// ditampilkan di layar Notifikasi.
class NotifikasiItem {
  const NotifikasiItem({
    required this.id,
    required this.judul,
    required this.pesan,
    required this.dibaca,
    this.jadwalId,
    this.kategori,
    this.createdAt,
  });

  final String id;
  final String judul;
  final String pesan;
  final bool dibaca;
  final String? jadwalId;
  final String? kategori;
  final String? createdAt;

  NotifikasiItem salinanDengan({bool? dibaca}) => NotifikasiItem(
    id: id,
    judul: judul,
    pesan: pesan,
    dibaca: dibaca ?? this.dibaca,
    jadwalId: jadwalId,
    kategori: kategori,
    createdAt: createdAt,
  );

  factory NotifikasiItem.dariJson(Map<String, dynamic> json) {
    final relasi = json['schedules'];
    String? kategori;
    if (relasi is Map) kategori = relasi['kategori']?.toString();

    return NotifikasiItem(
      id: (json['id'] ?? '').toString(),
      judul: (json['judul'] ?? '').toString(),
      pesan: (json['pesan'] ?? '').toString(),
      dibaca: json['dibaca'] == true,
      jadwalId: json['jadwal_id']?.toString(),
      kategori: kategori,
      createdAt: json['created_at']?.toString(),
    );
  }
}
