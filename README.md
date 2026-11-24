# Caesh

**Caesh** adalah aplikasi pengelola keuangan pribadi dengan arah pengembangan local-first. Web app Next.js saat ini digunakan sebagai preview dan tempat pengembangan. Target akhirnya adalah aplikasi desktop dan Android yang menyimpan data masing-masing pengguna di perangkatnya.

## Menjalankan versi web secara lokal

Persyaratan: Node.js 20.9 atau lebih baru.

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

Periksa build produksi dengan:

```bash
npm run build
npm run start
```

## Deploy preview ke Vercel

1. Import repository GitHub `nomatterwhathappns/Caesh` ke Vercel.
2. Framework Preset: Next.js.
3. Root Directory: `./`.
4. Build Command: `npm run build`.
5. Output Directory: biarkan default.
6. Deploy.

Vercel digunakan untuk hosting preview web, bukan sebagai tempat penyimpanan data keuangan pengguna.

## Privasi dan penyimpanan

- Data keuangan disimpan secara lokal pada perangkat pengguna.
- Tidak ada backend keuangan, akun pengguna, database cloud, atau sinkronisasi antarperangkat yang direncanakan.
- Data antar pengguna dan antar perangkat tidak otomatis bercampur atau tersinkron.
- Penyimpanan lokal aplikasi saat ini menggunakan IndexedDB di browser.
- Data lokal belum dienkripsi oleh aplikasi. Menghapus data situs/browser dapat menghapus data.
- Fitur Backup dan Pulihkan tersedia untuk mengekspor atau memulihkan transaksi, wallet, foto wallet, wishlist, serta preferensi ke file JSON. Simpan file backup di lokasi aman di luar perangkat.

## Kebijakan perlindungan data

Menjaga data pengguna agar tidak hilang atau rusak saat aplikasi diperbarui adalah persyaratan utama pengembangan Caesh.

- Pembaruan normal tidak boleh menghapus atau membuat ulang database pengguna.
- Perubahan struktur database harus memakai versi dan migrasi bertahap.
- Migrasi harus mempertahankan transaksi, wallet, wishlist, dan foto wallet yang sudah ada.
- Jika migrasi gagal, proses harus dibatalkan; aplikasi tidak boleh diam-diam mengganti data dengan database kosong.
- Perubahan yang berpotensi menghapus atau mengubah data secara destruktif harus didahului backup/restore dan pengujian pemulihan.
- Setiap versi aplikasi harus diuji agar data tetap tersedia setelah update.

Kebijakan ini sudah didokumentasikan. Caesh memiliki pengujian otomatis untuk migrasi database versi 1, 2, dan 3 serta alur backup/restore. Pengujian perangkat nyata dan verifikasi update pada aplikasi desktop/Android tetap wajib sebelum rilis publik.

## Fitur saat ini

- Ringkasan saldo dan arus uang.
- Beberapa wallet dengan saldo awal dan foto.
- Transaksi pemasukan, pengeluaran, dan transfer.
- Riwayat dan pencarian transaksi.
- Analisis pengeluaran.
- Wishlist dengan pencatatan pembelian.
- Penyimpanan lokal melalui IndexedDB.
