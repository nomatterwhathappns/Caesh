"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getTransactions,
  removeTransaction,
  saveTransaction,
  Transaction,
  TransactionKind,
} from "@/lib/db";

const categories = {
  income: ["Gaji", "Freelance", "Hadiah", "Investasi", "Lainnya"],
  expense: ["Makanan", "Transportasi", "Belanja", "Tagihan", "Hiburan", "Kesehatan", "Lainnya"],
};

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

const today = () => {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export default function CaeshApp() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories.expense[0]);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [showForm, setShowForm] = useState(false);
  const [period, setPeriod] = useState("month");
  const [error, setError] = useState("");

  useEffect(() => {
    getTransactions()
      .then(setTransactions)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Database lokal tidak dapat dibuka."))
      .finally(() => setReady(true));
  }, []);

  const totals = useMemo(() => {
    const now = new Date();
    const filtered = transactions.filter((item) => {
      if (period === "all") return true;
      const itemDate = new Date(item.date + "T00:00:00");
      return itemDate.getFullYear() === now.getFullYear() && (period === "year" || itemDate.getMonth() === now.getMonth());
    });
    const income = filtered.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
    const expense = filtered.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
    return { income, expense, balance: income - expense };
  }, [transactions, period]);

  const recent = transactions.slice(0, 6);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value <= 0) {
      setError("Masukkan nominal rupiah berupa angka bulat lebih dari nol.");
      return;
    }
    const transaction: Transaction = {
      id: crypto.randomUUID(),
      kind,
      amount: value,
      category,
      note: note.trim(),
      date,
      createdAt: Date.now(),
    };
    try {
      await saveTransaction(transaction);
      setTransactions((current) => [transaction, ...current].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt));
      setAmount("");
      setNote("");
      setDate(today());
      setShowForm(false);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Transaksi gagal disimpan.");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Hapus transaksi ini?")) return;
    try {
      await removeTransaction(id);
      setTransactions((current) => current.filter((item) => item.id !== id));
    } catch {
      setError("Transaksi gagal dihapus.");
    }
  }

  function changeKind(next: TransactionKind) {
    setKind(next);
    setCategory(categories[next][0]);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Caesh beranda">
          <span className="brand-mark">c</span>
          <span>caesh<span className="brand-period">.</span></span>
        </a>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Navigasi utama">
          <a className="nav-link active" href="#overview"><span className="nav-icon">▦</span> Ringkasan</a>
          <a className="nav-link" href="#transactions"><span className="nav-icon">↕</span> Transaksi</a>
          <a className="nav-link" href="#insights"><span className="nav-icon">⌁</span> Analisis</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <span className="privacy-icon">◈</span>
            <strong>Data milikmu.</strong>
            <p>Disimpan di browser ini, bukan di server Caesh.</p>
            <span className="privacy-status"><i /> Penyimpanan lokal aktif</span>
          </div>
          <div className="profile-row">
            <div className="avatar">Y</div>
            <div><strong>Personal space</strong><span>Mode pribadi</span></div>
            <span className="profile-more">•••</span>
          </div>
        </div>
      </aside>

      <section className="main-panel" id="overview">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> Ringkasan</div>
          <div className="topbar-right"><span className="local-indicator"><i /> Offline-ready</span><span className="top-date">{new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span></div>
        </header>

        <div className="content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">PERSONAL FINANCE OVERVIEW</div>
              <h1>Uangmu, lebih <em>terarah.</em></h1>
              <p className="welcome-copy">Pantau arus uang dan bangun kebiasaan finansial yang lebih baik.</p>
            </div>
            <button className="primary-button" onClick={() => setShowForm(true)}><span>＋</span> Tambah transaksi</button>
          </div>

          {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")}>Tutup</button></div>}

          <div className="period-row">
            <span className="section-kicker">RINGKASAN KEUANGAN</span>
            <div className="period-tabs" aria-label="Periode ringkasan">
              <button className={period === "month" ? "selected" : ""} onClick={() => setPeriod("month")}>Bulan ini</button>
              <button className={period === "year" ? "selected" : ""} onClick={() => setPeriod("year")}>Tahun ini</button>
              <button className={period === "all" ? "selected" : ""} onClick={() => setPeriod("all")}>Semua</button>
            </div>
          </div>

          <section className="stats-grid" aria-label="Ringkasan saldo">
            <article className="stat-card balance-card">
              <div className="stat-top"><span>Total arus bersih</span><span className="stat-symbol">↗</span></div>
              <div className="stat-value">{ready ? rupiah(totals.balance) : "Memuat..."}</div>
              <div className="stat-foot"><span className="balance-dot" /> Pemasukan dikurangi pengeluaran</div>
              <div className="balance-decoration">CAESH</div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span>Total pemasukan</span><span className="stat-icon income-icon">↙</span></div>
              <div className="stat-value">{ready ? rupiah(totals.income) : "Memuat..."}</div>
              <div className="stat-foot">Uang yang masuk</div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span>Total pengeluaran</span><span className="stat-icon expense-icon">↗</span></div>
              <div className="stat-value">{ready ? rupiah(totals.expense) : "Memuat..."}</div>
              <div className="stat-foot">Uang yang digunakan</div>
            </article>
          </section>

          <section className="lower-grid" id="transactions">
            <article className="panel-card transactions-card">
              <div className="panel-heading">
                <div><div className="section-kicker">CATATAN TERBARU</div><h2>Aktivitas transaksi</h2></div>
                <button className="text-button" onClick={() => setShowForm(true)}>＋ Catat baru</button>
              </div>
              {!ready ? <div className="empty-state">Memuat data lokal...</div> : recent.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-art">↗</div>
                  <strong>Belum ada transaksi</strong>
                  <p>Mulai catat pemasukan atau pengeluaran pertamamu.</p>
                  <button className="outline-button" onClick={() => setShowForm(true)}>Tambah transaksi pertama</button>
                </div>
              ) : (
                <div className="transaction-list">
                  {recent.map((item) => (
                    <div className="transaction-row" key={item.id}>
                      <div className={`transaction-icon ${item.kind}`}>{item.kind === "income" ? "↙" : "↗"}</div>
                      <div className="transaction-info"><strong>{item.note || item.category}</strong><span>{item.category} · {new Date(item.date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span></div>
                      <div className={`transaction-amount ${item.kind}`}>{item.kind === "income" ? "+" : "−"}{rupiah(item.amount)}</div>
                      <button className="delete-button" aria-label="Hapus transaksi" onClick={() => handleDelete(item.id)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="panel-card insight-card" id="insights">
              <div className="section-kicker">KEBIASAAN FINANSIAL</div>
              <h2>Ringkasan aktivitas</h2>
              <p className="insight-description">Gambaran sederhana dari transaksi pada periode yang dipilih.</p>
              <div className="insight-metric"><span>Jumlah transaksi</span><strong>{transactions.filter((item) => period === "all" || (period === "year" ? item.date.startsWith(String(new Date().getFullYear())) : item.date.startsWith(today().slice(0, 7)))).length}</strong></div>
              <div className="insight-metric"><span>Rata-rata pengeluaran</span><strong>{rupiah(transactions.filter((item) => item.kind === "expense" && (period === "all" || (period === "year" ? item.date.startsWith(String(new Date().getFullYear())) : item.date.startsWith(today().slice(0, 7)))).length ? totals.expense / transactions.filter((item) => item.kind === "expense" && (period === "all" || (period === "year" ? item.date.startsWith(String(new Date().getFullYear())) : item.date.startsWith(today().slice(0, 7))))).length : 0)}</strong></div>
              <div className="insight-note"><span>✳</span><p>Catat transaksi secara rutin agar ringkasan keuanganmu semakin akurat.</p></div>
            </article>
          </section>
          <footer className="footer-note"><span>CAESH © 2026</span><span>Dirancang untuk mengelola uang dengan lebih sadar.</span><span className="footer-lock">◈ DATA LOKAL</span></footer>
        </div>
      </section>

      {showForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-heading"><div><div className="section-kicker">CATATAN BARU</div><h2 id="modal-title">Tambah transaksi</h2></div><button className="modal-close" onClick={() => setShowForm(false)} aria-label="Tutup">×</button></div>
            <form onSubmit={handleSubmit}>
              <div className="kind-switch"><button type="button" className={kind === "expense" ? "active expense-choice" : ""} onClick={() => changeKind("expense")}>Pengeluaran</button><button type="button" className={kind === "income" ? "active income-choice" : ""} onClick={() => changeKind("income")}>Pemasukan</button></div>
              <label className="field-label" htmlFor="amount">Nominal (Rp)</label>
              <input id="amount" className="amount-input" inputMode="numeric" type="number" min="1" step="1" placeholder="0" value={amount} onChange={(event) => setAmount(event.target.value)} required />
              <div className="form-grid">
                <div><label className="field-label" htmlFor="category">Kategori</label><select id="category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories[kind].map((item) => <option key={item}>{item}</option>)}</select></div>
                <div><label className="field-label" htmlFor="date">Tanggal</label><input id="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div>
              </div>
              <label className="field-label" htmlFor="note">Catatan <span>(opsional)</span></label>
              <input id="note" type="text" maxLength={80} placeholder="Contoh: makan siang" value={note} onChange={(event) => setNote(event.target.value)} />
              <div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setShowForm(false)}>Batal</button><button type="submit" className="primary-button">Simpan transaksi</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
