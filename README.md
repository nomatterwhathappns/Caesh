# Caesh

**Caesh** adalah aplikasi Android pengelola keuangan pribadi (*personal finance manager*) yang dirancang untuk penggunaan satu pengguna, sepenuhnya offline, dan menyimpan data secara lokal di perangkat.

> Status: tahap fondasi awal. Fitur yang belum diimplementasikan atau diuji tidak dianggap selesai.

## Tujuan

- Mencatat pemasukan, pengeluaran, dan transfer.
- Mengelola akun/dompet, kategori, anggaran, dan target tabungan.
- Menampilkan ringkasan serta laporan berdasarkan transaksi nyata.
- Menjaga data tetap berada di perangkat tanpa akun, backend, sinkronisasi cloud, iklan, atau analitik eksternal.

## Prinsip utama

1. **Offline-first:** aplikasi tidak memerlukan koneksi internet saat digunakan.
2. **Privasi:** tidak ada permission `INTERNET` dan tidak ada pengiriman data finansial ke layanan pihak ketiga.
3. **Akurasi:** nominal uang disimpan sebagai bilangan bulat rupiah (`Long`), bukan `Float`/`Double`.
4. **Integritas:** transfer antar-akun bukan pemasukan atau pengeluaran baru.
5. **Transparansi:** status implementasi dan hasil pengujian dicatat apa adanya.

## Teknologi

- Kotlin
- Android / Jetpack Compose
- MVVM dengan pemisahan domain dan data secara proporsional
- Room untuk penyimpanan lokal
- Kotlin Coroutines dan Flow
- DataStore untuk preferensi aplikasi

Enkripsi database, backup terenkripsi, autentikasi lokal, OCR, dan fitur lanjutan akan ditambahkan melalui tahap implementasi dan verifikasi terpisah. Jangan menganggap data sudah terenkripsi sebelum fitur tersebut benar-benar tersedia dan diuji.

## Menjalankan proyek

1. Install Android Studio versi stabil.
2. Buka folder repository ini sebagai proyek Gradle.
3. Tunggu Gradle Sync selesai.
4. Jalankan konfigurasi `app` pada Android Emulator atau perangkat Android melalui USB debugging.

Untuk membuat APK debug: **Build → Build Bundle(s) / APK(s) → Build APK(s)**. APK debug biasanya tersedia di `app/build/outputs/apk/debug/` setelah build berhasil.

## Roadmap

- [x] Menetapkan identitas dan prinsip proyek.
- [ ] Fondasi Android dan tema UI.
- [ ] Database lokal dan model akun/transaksi/kategori.
- [ ] Dashboard dan pencatatan transaksi.
- [ ] Transfer dan kalkulasi saldo yang konsisten.
- [ ] Budget dan target tabungan.
- [ ] Statistik, pencarian, dan insight lokal.
- [ ] Backup/restore terenkripsi dan pengamanan aplikasi.
- [ ] OCR lokal, notifikasi, dan fitur tambahan.
- [ ] Pengujian, audit privasi, dan APK.

## Keamanan dan batasan

Caesh masih dalam tahap pengembangan dan belum layak dipakai sebagai satu-satunya catatan keuangan. Jangan masukkan data finansial sensitif sebelum penyimpanan terenkripsi, backup/restore, dan pengujian keamanan selesai.
