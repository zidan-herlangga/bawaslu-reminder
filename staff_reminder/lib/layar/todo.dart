import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../komponen/chip_filter.dart';
import '../komponen/judul_bagian.dart';
import '../komponen/kosong.dart';
import '../layanan/todo_repo.dart';
import '../model/todo.dart';
import '../tema/warna.dart';
import '../util/waktu.dart';

/// Layar Tugas: daftar hal yang harus dilakukan, per tanggal atau seluruhnya.
class LayarTodo extends StatefulWidget {
  const LayarTodo({super.key});

  @override
  State<LayarTodo> createState() => _LayarTodoState();
}

class _LayarTodoState extends State<LayarTodo> {
  final _teks = TextEditingController();

  List<Todo>? _tugas;
  String? _error;
  bool _semua = false;
  late String _tanggal;
  bool _menyimpan = false;
  StreamSubscription<List<Todo>>? _langganan;
  Timer? _realtimeTimer;

  @override
  void initState() {
    super.initState();
    _tanggal = Waktu.hari(DateTime.now());
    _muat();
    _mulaiRealtime();
  }

  @override
  void dispose() {
    _langganan?.cancel();
    _realtimeTimer?.cancel();
    _teks.dispose();
    super.dispose();
  }

  void _mulaiRealtime() {
    _langganan?.cancel();
    _langganan = TodoRepo.stream().listen(
      (data) {
        if (!mounted) return;
        setState(() {
          _tugas = data;
          _error = null;
        });
      },
      onError: (Object _) {
        _langganan?.cancel();
        if (mounted) {
          _realtimeTimer = Timer(const Duration(seconds: 6), _mulaiRealtime);
        }
      },
    );
  }

  Future<void> _muat() async {
    setState(() => _error = null);
    try {
      final hasil = await TodoRepo.ambil();
      if (!mounted) return;
      setState(() => _tugas = hasil);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    }
  }

  List<Todo> get _tampil {
    final semua = _tugas ?? const <Todo>[];
    if (_semua) return semua;
    return semua.where((t) => t.tanggal == _tanggal).toList();
  }

  Future<void> _tambah() async {
    final teks = _teks.text.trim();
    if (teks.isEmpty) return;
    setState(() => _menyimpan = true);
    try {
      await TodoRepo.tambah(teks, _tanggal);
      _teks.clear();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal menambah tugas: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _menyimpan = false);
    }
  }

  Future<void> _toggle(Todo todo) async {
    setState(() {
      _tugas = _tugas
          ?.map((t) => t.id == todo.id ? t.salin(selesai: !t.selesai) : t)
          .toList();
    });
    try {
      await TodoRepo.setSelesai(todo.id, !todo.selesai);
    } catch (_) {
      if (mounted) await _muat();
    }
  }

  Future<void> _hapus(Todo todo) async {
    setState(() => _tugas = _tugas?.where((t) => t.id != todo.id).toList());
    try {
      await TodoRepo.hapus(todo.id);
    } catch (_) {
      if (mounted) await _muat();
    }
  }

  Future<void> _ubah(Todo todo) async {
    final hasil = await showDialog<({String teks, String tanggal})>(
      context: context,
      builder: (_) => _DialogUbahTugas(todo: todo),
    );
    if (hasil == null) return;
    final teks = hasil.teks.trim();
    if (teks.isEmpty) return;

    final sebelum = _tugas;
    setState(() {
      _tugas = _tugas
          ?.map((t) => t.id == todo.id ? t.salin(teks: teks, tanggal: hasil.tanggal) : t)
          .toList();
    });
    try {
      await TodoRepo.ubah(todo.id, teks: teks, tanggal: hasil.tanggal);
    } catch (e) {
      if (!mounted) return;
      setState(() => _tugas = sebelum);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Gagal menyimpan perubahan: $e')),
      );
    }
  }

  Future<void> _pilihTanggal() async {
    final awal = DateTime.tryParse(_tanggal) ?? DateTime.now();
    final hasil = await showDatePicker(
      context: context,
      initialDate: awal,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (hasil != null) setState(() => _tanggal = Waktu.hari(hasil));
  }

  @override
  Widget build(BuildContext context) {
    final daftar = _tampil;
    final belumSelesai = daftar.where((t) => !t.selesai).length;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        Row(
          children: [
            Expanded(
              child: ChipFilter(
                label: 'Tanggal dipilih',
                aktif: !_semua,
                onTap: () => setState(() => _semua = false),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: ChipFilter(
                label: 'Semua Tugas',
                aktif: _semua,
                onTap: () => setState(() => _semua = true),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        if (!_semua)
          GestureDetector(
            onTap: _pilihTanggal,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Warna.card,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Warna.line),
              ),
              child: Row(
                children: [
                  const Icon(Icons.calendar_today_rounded, size: 16, color: Warna.muted),
                  const SizedBox(width: 10),
                  Text(
                    Waktu.tanggalPanjang(_tanggal),
                    style: const TextStyle(
                      color: Warna.ink,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Spacer(),
                  const Icon(Icons.expand_more_rounded, size: 18, color: Warna.muted),
                ],
              ),
            ),
          ),
        if (!_semua) const SizedBox(height: 12),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: _teks,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _tambah(),
                decoration: InputDecoration(
                  hintText: 'Tulis tugas baru...',
                  isDense: true,
                  filled: true,
                  fillColor: Warna.card,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Warna.line),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Warna.blue, width: 1.6),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            SizedBox(
              height: 50,
              child: FilledButton(
                onPressed: _menyimpan ? null : _tambah,
                style: FilledButton.styleFrom(
                  backgroundColor: Warna.blue,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: const Icon(Icons.add_rounded),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        JudulBagian(
          judul: _semua ? 'Semua Tugas' : Waktu.tanggalPanjang(_tanggal),
          ikon: Icons.checklist_rounded,
          keterangan: '$belumSelesai belum selesai',
        ),
        const SizedBox(height: 12),
        if (_error != null)
          Kosong(ikon: Icons.cloud_off_rounded, judul: 'Gagal memuat', pesan: _error!)
        else if (_tugas == null)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 40),
            child: Center(child: CircularProgressIndicator(color: Warna.blue)),
          )
        else if (daftar.isEmpty)
          const Kosong(
            ikon: Icons.task_alt_rounded,
            judul: 'Belum ada tugas',
            pesan: 'Tambahkan tugas agar tidak ada yang terlewat.',
          )
        else
          for (final t in daftar) ...[
            _BarisTugas(
              todo: t,
              onToggle: () => _toggle(t),
              onUbah: () => _ubah(t),
              onHapus: () => _hapus(t),
            ),
            const SizedBox(height: 10),
          ],
      ],
    );
  }
}

class _BarisTugas extends StatelessWidget {
  const _BarisTugas({
    required this.todo,
    required this.onToggle,
    required this.onUbah,
    required this.onHapus,
  });

  final Todo todo;
  final VoidCallback onToggle;
  final VoidCallback onUbah;
  final VoidCallback onHapus;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Warna.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Warna.line),
      ),
      child: Row(
        children: [
          InkWell(
            onTap: onToggle,
            borderRadius: const BorderRadius.horizontal(left: Radius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Icon(
                todo.selesai
                    ? Icons.check_box_rounded
                    : Icons.check_box_outline_blank_rounded,
                size: 24,
                color: todo.selesai ? Warna.green : Warna.muted,
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: onToggle,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      todo.teks,
                      style: TextStyle(
                        color: todo.selesai ? Warna.muted : Warna.ink,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        decoration:
                            todo.selesai ? TextDecoration.lineThrough : TextDecoration.none,
                      ),
                    ),
                    if (todo.tanggal.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        Waktu.tanggalPendek(todo.tanggal),
                        style: const TextStyle(color: Warna.muted, fontSize: 11.5),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
          IconButton(
            onPressed: onUbah,
            icon: const Icon(Icons.edit_outlined, size: 20),
            color: Warna.blue,
            tooltip: 'Ubah tugas',
          ),
          IconButton(
            onPressed: onHapus,
            icon: const Icon(Icons.delete_outline_rounded, size: 20),
            color: Warna.red,
            tooltip: 'Hapus tugas',
          ),
        ],
      ),
    );
  }
}

class _DialogUbahTugas extends StatefulWidget {
  const _DialogUbahTugas({required this.todo});

  final Todo todo;

  @override
  State<_DialogUbahTugas> createState() => _DialogUbahTugasState();
}

class _DialogUbahTugasState extends State<_DialogUbahTugas> {
  late final TextEditingController _teks;
  late String _tanggal;

  @override
  void initState() {
    super.initState();
    _teks = TextEditingController(text: widget.todo.teks);
    _tanggal = widget.todo.tanggal.isEmpty
        ? Waktu.hari(DateTime.now())
        : widget.todo.tanggal;
  }

  @override
  void dispose() {
    _teks.dispose();
    super.dispose();
  }

  Future<void> _pilihTanggal() async {
    final awal = DateTime.tryParse(_tanggal) ?? DateTime.now();
    final hasil = await showDatePicker(
      context: context,
      initialDate: awal,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (hasil != null) setState(() => _tanggal = Waktu.hari(hasil));
  }

  void _simpan() {
    final teks = _teks.text.trim();
    if (teks.isEmpty) return;
    Navigator.pop(context, (teks: teks, tanggal: _tanggal));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Ubah tugas'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _teks,
            autofocus: true,
            maxLength: 300,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _simpan(),
            decoration: InputDecoration(
              labelText: 'Tugas',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 4),
          InkWell(
            onTap: _pilihTanggal,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
              child: Row(
                children: [
                  const Icon(Icons.calendar_today_rounded, size: 16, color: Warna.muted),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      Waktu.tanggalPanjang(_tanggal),
                      style: const TextStyle(
                        color: Warna.ink,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const Icon(Icons.expand_more_rounded, size: 18, color: Warna.muted),
                ],
              ),
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Batal'),
        ),
        FilledButton(
          onPressed: _simpan,
          style: FilledButton.styleFrom(
            backgroundColor: Warna.blue,
            foregroundColor: Colors.white,
          ),
          child: const Text('Simpan'),
        ),
      ],
    );
  }
}
