"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getTransactions, getWallets, removeTransaction, saveTransaction, saveWallet,
  Transaction, TransactionKind, Wallet,
} from "@/lib/db";

const categories = {
  income: ["Gaji", "Freelance", "Hadiah", "Investasi", "Lainnya"],
  expense: ["Makanan", "Transportasi", "Belanja", "Tagihan", "Hiburan", "Kesehatan", "Lainnya"],
};
const formatRupiahInput = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Number(digits)) : "";
};
const parseRupiahInput = (value: string) => Number(value.replace(/\D/g, ""));
const rupiah = (value: number) => new Intl.NumberFormat("id-ID", {
  style: "currency", currency: "IDR", maximumFractionDigits: 0,
}).format(value);
const today = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function CaeshApp() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories.expense[0]);
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [walletId, setWalletId] = useState("");
  const [toWalletId, setToWalletId] = useState("");
  const [newWalletName, setNewWalletName] = useState("");
  const [newWalletBalance, setNewWalletBalance] = useState("0");
  const [todayLabel, setTodayLabel] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showWalletForm, setShowWalletForm] = useState(false);
  const [period, setPeriod] = useState("month");
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeNav, setActiveNav] = useState<"overview" | "wallets" | "transactions" | "transfer" | "insights">("overview");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("caesh-theme");
    if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
    setDate(today());
    setTodayLabel(new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }));
    Promise.all([getTransactions(), getWallets()])
      .then(([savedTransactions, savedWallets]) => {
        setTransactions(savedTransactions);
        setWallets(savedWallets);
        setWalletId(savedWallets[0]?.id ?? "");
        setToWalletId(savedWallets[1]?.id ?? "");
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Database lokal tidak dapat dibuka."))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("caesh-theme", theme);
  }, [theme]);

  const walletBalances = useMemo(() => wallets.map((wallet) => {
    const movement = transactions.reduce((sum, item) => {
      if (item.kind === "transfer") {
        if (item.walletId === wallet.id) return sum - item.amount;
        if (item.toWalletId === wallet.id) return sum + item.amount;
        return sum;
      }
      return item.walletId === wallet.id ? sum + (item.kind === "income" ? item.amount : -item.amount) : sum;
    }, 0);
    return { ...wallet, balance: wallet.initialBalance + movement };
  }), [wallets, transactions]);
  const totalBalance = walletBalances.reduce((sum, wallet) => sum + wallet.balance, 0);

  const periodTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter((item) => {
      if (period === "all") return true;
      const itemDate = new Date(item.date + "T00:00:00");
      return itemDate.getFullYear() === now.getFullYear() &&
        (period === "year" || itemDate.getMonth() === now.getMonth());
    });
  }, [transactions, period]);
  const totals = useMemo(() => ({
    income: periodTransactions.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0),
    expense: periodTransactions.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0),
  }), [periodTransactions]);
  const expenseCount = periodTransactions.filter((item) => item.kind === "expense").length;
  const recent = transactions.slice(0, 6);
  const walletName = (id: string) => wallets.find((wallet) => wallet.id === id)?.name ?? "Wallet tidak ditemukan";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = parseRupiahInput(amount);
    if (!Number.isSafeInteger(value) || value <= 0) {
      setError("Masukkan nominal rupiah berupa angka bulat lebih dari nol.");
      return;
    }
    if (!walletId) {
      setError("Buat atau pilih wallet terlebih dahulu.");
      return;
    }
    if (kind === "transfer") {
      if (!toWalletId || toWalletId === walletId) {
        setError("Pilih wallet tujuan yang berbeda dari wallet sumber.");
        return;
      }
      const source = walletBalances.find((wallet) => wallet.id === walletId);
      if (!source || source.balance < value) {
        setError("Saldo wallet sumber tidak mencukupi untuk transfer ini.");
        return;
      }
    }
    const transaction: Transaction = {
      id: crypto.randomUUID(), kind, amount: value,
      category: kind === "transfer" ? "Transfer" : category,
      note: note.trim(), date, walletId,
      ...(kind === "transfer" ? { toWalletId } : {}), createdAt: Date.now(),
    };
    try {
      await saveTransaction(transaction);
      setTransactions((current) => [transaction, ...current].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt));
      setAmount(""); setNote(""); setDate(today()); setShowForm(false); setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Transaksi gagal disimpan.");
    }
  }

  async function handleWalletSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newWalletName.trim();
    const balance = parseRupiahInput(newWalletBalance);
    if (!name) { setError("Nama wallet wajib diisi."); return; }
    if (!Number.isSafeInteger(balance) || balance < 0) { setError("Saldo awal harus berupa angka rupiah bulat, minimal nol."); return; }
    if (wallets.some((wallet) => wallet.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setError("Nama wallet tersebut sudah digunakan."); return;
    }
    const wallet: Wallet = { id: crypto.randomUUID(), name, initialBalance: balance, createdAt: Date.now() };
    try {
      await saveWallet(wallet);
      setWallets((current) => [...current, wallet]);
      setWalletId(wallet.id);
      setNewWalletName(""); setNewWalletBalance("0"); setShowWalletForm(false); setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Wallet gagal disimpan.");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Hapus transaksi ini?")) return;
    try {
      await removeTransaction(id);
      setTransactions((current) => current.filter((item) => item.id !== id));
    } catch { setError("Transaksi gagal dihapus."); }
  }
  function changeKind(next: TransactionKind) { setKind(next); if (next !== "transfer") setCategory(categories[next][0]); }

  return (
    <main className="app-shell" data-theme={theme}>
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Caesh beranda"><span className="brand-mark">c</span><span>caesh<span className="brand-period">.</span></span></a>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Navigasi utama">
          <a className={activeNav === "overview" ? "nav-link active" : "nav-link"} href="#overview" aria-current={activeNav === "overview" ? "page" : undefined} onClick={() => setActiveNav("overview")}><span className="nav-icon">▦</span> Ringkasan</a>
          <a className={activeNav === "wallets" ? "nav-link active" : "nav-link"} href="#wallets" aria-current={activeNav === "wallets" ? "page" : undefined} onClick={() => setActiveNav("wallets")}><span className="nav-icon">▣</span> Wallet</a>
          <a className={activeNav === "transactions" ? "nav-link active" : "nav-link"} href="#transactions" aria-current={activeNav === "transactions" ? "page" : undefined} onClick={() => setActiveNav("transactions")}><span className="nav-icon">↕</span> Transaksi</a>
          <a className={activeNav === "transfer" ? "nav-link active" : "nav-link"} href="#transactions" aria-current={activeNav === "transfer" ? "page" : undefined} onClick={() => { setActiveNav("transfer"); setShowForm(true); }}><span className="nav-icon">⇄</span> Transfer</a>
          <a className={activeNav === "insights" ? "nav-link active" : "nav-link"} href="#insights" aria-current={activeNav === "insights" ? "page" : undefined} onClick={() => setActiveNav("insights")}><span className="nav-icon">⌁</span> Analisis</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card"><span className="privacy-icon">◈</span><strong>Data milikmu.</strong><p>Disimpan di browser ini, bukan di server Caesh.</p><span className="privacy-status"><i /> Penyimpanan lokal aktif</span></div>
          <div className="profile-row"><div className="avatar">Y</div><div><strong>Personal space</strong><span>Mode pribadi</span></div><span className="profile-more">•••</span></div>
        </div>
      </aside>

      <section className="main-panel" id="overview">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> Ringkasan</div><div className="topbar-right"><span className="local-indicator"><i /> Data tersimpan lokal</span><span className="top-date">{todayLabel}</span><button className="theme-toggle" onClick={() => setTheme((current) => current === "light" ? "dark" : "light")} aria-label={theme === "light" ? "Aktifkan tema gelap" : "Aktifkan tema terang"} title={theme === "light" ? "Tema gelap" : "Tema terang"}><span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span><span>{theme === "light" ? "Gelap" : "Terang"}</span></button></div></header>
        <div className="content">
          <div className="welcome-row"><div><div className="eyebrow">PERSONAL FINANCE OVERVIEW</div><h1>Uangmu, lebih <em>terarah.</em></h1><p className="welcome-copy">Pantau arus uang dan bangun kebiasaan finansial yang lebih baik.</p></div><button className="primary-button" onClick={() => setShowForm(true)}><span>＋</span> Tambah transaksi</button></div>
          {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")}>Tutup</button></div>}

          <div className="period-row"><span className="section-kicker">RINGKASAN KEUANGAN</span><div className="period-tabs" aria-label="Periode ringkasan"><button className={period === "month" ? "selected" : ""} onClick={() => setPeriod("month")}>Bulan ini</button><button className={period === "year" ? "selected" : ""} onClick={() => setPeriod("year")}>Tahun ini</button><button className={period === "all" ? "selected" : ""} onClick={() => setPeriod("all")}>Semua</button></div></div>
          <section className="stats-grid" aria-label="Ringkasan saldo">
            <article className="stat-card balance-card"><div className="stat-top"><span>Total saldo semua wallet</span><span className="stat-symbol">↗</span></div><div className="stat-value">{ready ? rupiah(totalBalance) : "Memuat..."}</div><div className="stat-foot"><span className="balance-dot" /> Gabungan saldo seluruh wallet</div><div className="balance-decoration">CAESH</div></article>
            <article className="stat-card"><div className="stat-top"><span>Total pemasukan</span><span className="stat-icon income-icon">↙</span></div><div className="stat-value">{ready ? rupiah(totals.income) : "Memuat..."}</div><div className="stat-foot">Uang yang masuk pada periode ini</div></article>
            <article className="stat-card"><div className="stat-top"><span>Total pengeluaran</span><span className="stat-icon expense-icon">↗</span></div><div className="stat-value">{ready ? rupiah(totals.expense) : "Memuat..."}</div><div className="stat-foot">Uang yang digunakan pada periode ini</div></article>
          </section>

          <section className="wallet-section" id="wallets">
            <div className="wallet-section-heading"><div><div className="section-kicker">TEMPAT PENYIMPANAN UANG</div><h2>Wallet kamu</h2></div><button className="outline-button" onClick={() => setShowWalletForm(true)}>＋ Tambah wallet</button></div>
            <div className="wallet-grid">
              {walletBalances.map((wallet) => <article className="wallet-card" key={wallet.id}><div className="wallet-card-top"><span className="wallet-symbol">▣</span><span className="wallet-caption">WALLET</span></div><strong className="wallet-name">{wallet.name}</strong><div className="wallet-balance">{ready ? rupiah(wallet.balance) : "Memuat..."}</div><div className="wallet-start">Saldo awal {rupiah(wallet.initialBalance)}</div></article>)}
              {wallets.length === 0 && ready && <div className="wallet-empty">Belum ada wallet. Tambahkan wallet pertamamu.</div>}
              <button className="wallet-add-card" onClick={() => setShowWalletForm(true)}><span>＋</span><strong>Buat wallet baru</strong><small>Pisahkan uang berdasarkan tempatnya</small></button>
            </div>
          </section>

          <section className="lower-grid" id="transactions">
            <article className="panel-card transactions-card"><div className="panel-heading"><div><div className="section-kicker">CATATAN TERBARU</div><h2>Aktivitas transaksi</h2></div><button className="text-button" onClick={() => setShowForm(true)}>＋ Catat baru</button></div>
              {!ready ? <div className="empty-state">Memuat data lokal...</div> : recent.length === 0 ? <div className="empty-state"><div className="empty-art">↗</div><strong>Belum ada transaksi</strong><p>Mulai catat pemasukan atau pengeluaran pertamamu.</p><button className="outline-button" onClick={() => setShowForm(true)}>Tambah transaksi pertama</button></div> :
              <div className="transaction-list">{recent.map((item) => <div className="transaction-row" key={item.id}><div className={`transaction-icon ${item.kind}`}>{item.kind === "income" ? "↙" : item.kind === "expense" ? "↗" : "⇄"}</div><div className="transaction-info"><strong>{item.note || item.category}</strong><span>{item.kind === "transfer" ? `${walletName(item.walletId)} → ${walletName(item.toWalletId ?? "")}` : `${item.category} · ${walletName(item.walletId)}`} · {new Date(item.date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span></div><div className={`transaction-amount ${item.kind}`}>{item.kind === "income" ? "+" : item.kind === "expense" ? "−" : "⇄"}{rupiah(item.amount)}</div><button className="delete-button" aria-label="Hapus transaksi" onClick={() => handleDelete(item.id)}>×</button></div>)}</div>}
            </article>
            <article className="panel-card insight-card" id="insights"><div className="section-kicker">KEBIASAAN FINANSIAL</div><h2>Ringkasan aktivitas</h2><p className="insight-description">Gambaran sederhana dari transaksi pada periode yang dipilih.</p><div className="insight-metric"><span>Jumlah transaksi</span><strong>{periodTransactions.length}</strong></div><div className="insight-metric"><span>Rata-rata pengeluaran</span><strong>{rupiah(expenseCount ? totals.expense / expenseCount : 0)}</strong></div><div className="insight-note"><span>✳</span><p>Catat transaksi secara rutin agar ringkasan keuanganmu semakin akurat.</p></div></article>
          </section>
          <footer className="footer-note"><span>CAESH © 2026</span><span>Dirancang untuk mengelola uang dengan lebih sadar.</span><span className="footer-lock">◈ DATA LOKAL</span></footer>
        </div>
      </section>

      {showForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><div className="section-kicker">CATATAN BARU</div><h2 id="modal-title">Tambah transaksi</h2></div><button className="modal-close" onClick={() => setShowForm(false)} aria-label="Tutup">×</button></div>
        <form onSubmit={handleSubmit}><div className="kind-switch"><button type="button" className={kind === "expense" ? "active expense-choice" : ""} onClick={() => changeKind("expense")}>Pengeluaran</button><button type="button" className={kind === "income" ? "active income-choice" : ""} onClick={() => changeKind("income")}>Pemasukan</button><button type="button" className={kind === "transfer" ? "active transfer-choice" : ""} onClick={() => changeKind("transfer")}>Transfer</button></div>
          <label className="field-label" htmlFor="amount">Nominal (Rp)</label><div className="currency-input-wrap"><span>Rp</span><input id="amount" className="amount-input" inputMode="numeric" type="text" placeholder="0" value={amount} onChange={(event) => setAmount(formatRupiahInput(event.target.value))} required /></div>
          <div className="form-grid"><div>{kind !== "transfer" ? <><label className="field-label" htmlFor="category">Kategori</label><select id="category" value={category} onChange={(event) => setCategory(event.target.value)}>{categories[kind].map((item) => <option key={item}>{item}</option>)}</select></> : <><label className="field-label" htmlFor="source-wallet">Dari wallet</label><select id="source-wallet" value={walletId} onChange={(event) => { const nextSource = event.target.value; setWalletId(nextSource); if (toWalletId === nextSource) setToWalletId(wallets.find((wallet) => wallet.id !== nextSource)?.id ?? ""); }} required>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} — {rupiah(walletBalances.find((entry) => entry.id === wallet.id)?.balance ?? 0)}</option>)}</select></>}</div><div><label className="field-label" htmlFor="wallet">{kind === "transfer" ? "Ke wallet" : "Wallet"}</label><select id="wallet" value={kind === "transfer" ? toWalletId : walletId} onChange={(event) => kind === "transfer" ? setToWalletId(event.target.value) : setWalletId(event.target.value)} required>{wallets.filter((wallet) => kind !== "transfer" || wallet.id !== walletId).map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select></div></div>
          <label className="field-label" htmlFor="date">Tanggal</label><input id="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          <label className="field-label" htmlFor="note">Catatan <span>(opsional)</span></label><input id="note" type="text" maxLength={80} placeholder="Contoh: makan siang" value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setShowForm(false)}>Batal</button><button type="submit" className="primary-button">Simpan transaksi</button></div>
        </form></section></div>}

      {showWalletForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowWalletForm(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="wallet-modal-title"><div className="modal-heading"><div><div className="section-kicker">WALLET BARU</div><h2 id="wallet-modal-title">Tambah wallet</h2></div><button className="modal-close" onClick={() => setShowWalletForm(false)} aria-label="Tutup">×</button></div>
        <form onSubmit={handleWalletSubmit}><label className="field-label" htmlFor="wallet-name">Nama wallet</label><input id="wallet-name" type="text" maxLength={32} placeholder="Contoh: BCA, Cash, DANA" value={newWalletName} onChange={(event) => setNewWalletName(event.target.value)} required />
          <label className="field-label" htmlFor="wallet-balance">Saldo pertama kali (Rp)</label><div className="currency-input-wrap"><span>Rp</span><input id="wallet-balance" className="amount-input" inputMode="numeric" type="text" placeholder="0" value={newWalletBalance} onChange={(event) => setNewWalletBalance(formatRupiahInput(event.target.value))} required /></div>
          <p className="wallet-form-hint">Saldo ini menjadi saldo awal wallet. Transaksi berikutnya akan menambah atau menguranginya secara otomatis.</p>
          <div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setShowWalletForm(false)}>Batal</button><button type="submit" className="primary-button">Simpan wallet</button></div>
        </form></section></div>}
    </main>
  );
}
