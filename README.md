# Caesh

**Caesh** adalah aplikasi pengelola keuangan pribadi berbasis web untuk penggunaan pribadi. Aplikasi menggunakan Next.js dan menyimpan transaksi di browser melalui IndexedDB.

## Menjalankan secara lokal

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

## Deploy ke Vercel

1. Import repository GitHub `nomatterwhathappns/Caesh` ke Vercel.
2. Framework Preset: Next.js.
3. Root Directory: `./`.
4. Build Command: `npm run build`.
5. Output Directory: biarkan default.
6. Deploy.

Tidak ada environment variable wajib untuk versi awal ini.

## Privasi dan penyimpanan

- Data transaksi disimpan di IndexedDB browser pada perangkat dan profil browser yang digunakan.
- Tidak ada backend, API keuangan, akun pengguna, database cloud, atau sinkronisasi antarperangkat pada versi awal.
- Vercel meng-host kode aplikasi; transaksi tidak dikirim ke Vercel oleh fitur pencatatan versi awal.
- Data tidak terenkripsi oleh aplikasi. Menghapus data situs/browser dapat menghapus transaksi.
- Gunakan browser dan perangkat yang sama untuk mengakses data yang sama.
- Deployment Protection mengatur akses ke situs, bukan mengenkripsi data lokal.
- Jangan jadikan aplikasi ini satu-satunya catatan keuangan sebelum backup/restore dan pengujian keamanan tersedia.

## Fitur versi awal

- Dashboard ringkasan pemasukan, pengeluaran, dan arus bersih.
- Catat pemasukan dan pengeluaran.
- Kategori dasar dan tanggal transaksi.
- Daftar transaksi terbaru dan hapus transaksi.
- Filter ringkasan bulan ini, tahun ini, dan semua transaksi.

## Belum tersedia

Akun/dompet, transfer, edit transaksi, kategori kustom, anggaran, target tabungan, ekspor/impor backup, app lock, grafik analisis, dan dukungan offline penuh (PWA/service worker) masih dalam roadmap.
