# Caesh

**CAESH** adalah aplikasi pengelola keuangan pribadi dengan pendekatan **local-first**. Aplikasi ini dirancang untuk membantu pengguna mencatat uang, memantau saldo, mengelola wallet, dan merencanakan pembelian tanpa harus menyimpan data keuangan di server.

<p align="center">
  <strong>Bordeaux Estate · Personal Finance Manager</strong>
</p>

## Fitur

### Ringkasan keuangan
- Ringkasan total saldo, pemasukan, dan pengeluaran.
- Filter periode ringkasan: bulan ini, tahun ini, dan semua.
- Filter wallet yang dihitung dalam total saldo.
- Preferensi privasi untuk menyembunyikan nominal wallet.

### Wallet
- Membuat dan mengelola beberapa wallet dengan saldo awal.
- Foto background per wallet, termasuk pengaturan posisi dan zoom.
- Detail wallet dan catatan.
- Kategori Notes untuk mencatat utang dan piutang.

### Transaksi dan utang
- Pencatatan pemasukan, pengeluaran, dan transfer antar-wallet.
- Riwayat transaksi, pencarian, dan filter.
- Pencatatan utang/piutang per orang.
- Pembayaran utang bertahap, pelunasan, dan riwayat pergerakan utang.

### Wishlist
- Menyimpan daftar barang atau tujuan yang ingin dibeli.
- Melacak status wishlist.
- Mencatat pembelian dan wallet yang digunakan.

### Widget dan tampilan
- Widget pengeluaran Android dengan pilihan wallet dan periode.
- Pengaturan background widget, posisi gambar, dan zoom.
- Tema **Bordeaux Estate** Light dan Dark.
- Tampilan kartu saldo dengan motif **Liquid Silk**.
- Antarmuka responsif untuk portrait dan landscape.

### Pembaruan aplikasi Android
- Pemeriksaan pembaruan dari dalam aplikasi.
- Verifikasi file APK menggunakan SHA-256 sebelum proses instalasi.
- APK Android ditandatangani menggunakan signing key rilis.

## Unduh CAESH Android

**Versi terbaru: v1.14.2**

[Unduh CAESH v1.14.2 (APK)](https://github.com/nomatterwhathappns/Caesh/releases/download/caesh-v1.14.2/Caesh.apk)

[Semua rilis CAESH](https://github.com/nomatterwhappns/Caesh/releases)

Aplikasi juga dapat memeriksa pembaruan ketika dibuka. Jika pembaruan tersedia, ikuti instruksi yang muncul di aplikasi. Verifikasi SHA-256 dilakukan sebelum APK diteruskan ke installer Android.

## Menjalankan versi web secara lokal

Persyaratan:
- Node.js 22 atau lebih baru.
- npm.

Clone repository dan pasang dependensi:

```bash
git clone https://github.com/nomatterwhathappns/Caesh.git
cd Caesh
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000).

Untuk menjalankan pemeriksaan:

```bash
npm test
npm run lint
npm run build
```

Perintah `npm run build` menjalankan pengujian terlebih dahulu sebelum build Next.js.

## Build Android

Build APK rilis dikelola melalui GitHub Actions pada branch `caesh`.

Workflow Android melakukan:
1. Instalasi dependensi Node.js.
2. Pengujian data dan database.
3. Export aplikasi web untuk Android.
4. Sinkronisasi project Capacitor Android.
5. Konfigurasi updater dan widget Android.
6. Build APK.
7. Penandatanganan APK rilis jika Android signing secrets tersedia.
8. Publikasi APK ke GitHub Releases dan pembuatan manifest pembaruan SHA-256.

Lihat [workflow Build Android APK](https://github.com/nomatterwhathappns/Caesh/actions/workflows/android-apk.yml).

## Privasi dan penyimpanan data

CAESH menggunakan pendekatan local-first:
- Data transaksi, wallet, dan wishlist disimpan di perangkat melalui IndexedDB.
- Preferensi tampilan dan pengaturan tertentu disimpan secara lokal di perangkat.
- CAESH tidak menggunakan backend keuangan, akun pengguna, atau database cloud untuk menyimpan data keuangan.
- Data tidak otomatis tersinkron antarperangkat.
- Data lokal aplikasi **belum dienkripsi oleh CAESH**. Keamanan perangkat dan akun sistem operasi tetap penting.
- Menghapus data aplikasi, data browser, atau penyimpanan perangkat dapat menghilangkan data CAESH.

**Catatan:** pemeriksaan SHA-256 pada updater digunakan untuk memeriksa integritas file APK yang diunduh. SHA-256 bukan enkripsi data keuangan dan bukan pengganti keamanan perangkat.

## Perlindungan data saat pembaruan

Pembaruan aplikasi harus mempertahankan database lokal pengguna:
- Pembaruan normal tidak boleh menghapus atau membuat ulang database.
- Perubahan struktur database harus menggunakan migrasi bertahap yang mempertahankan data lama.
- Jika migrasi gagal, aplikasi tidak boleh diam-diam mengganti database dengan database kosong.
- Pengujian migrasi database dilakukan sebagai bagian dari pemeriksaan proyek.

Meskipun demikian, selalu pertimbangkan risiko kehilangan data pada perangkat dan jangan menghapus data aplikasi saat memasang pembaruan.

## Teknologi

- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Capacitor](https://capacitorjs.com/)
- IndexedDB
- GitHub Actions

## Status proyek

CAESH dikembangkan secara bertahap. Versi Android saat ini tersedia sebagai APK melalui GitHub Releases. Versi web dapat dijalankan secara lokal untuk pengembangan dan pengujian.

---

<p align="center">
  <strong>CAESH</strong><br/>
  Personal finance, kept personal.
</p>
