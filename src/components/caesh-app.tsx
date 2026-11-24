"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getTransactions, getWallets, removeTransaction, removeWallet, saveTransaction, saveWallet,
  Transaction, TransactionKind, Wallet,
} from "@/lib/db";

const categories = {
  income: ["Gaji", "Freelance", "Hadiah", "Investasi", "Lainnya"],
  expense: ["Makanan", "Transportasi", "Belanja", "Tagihan", "Hiburan", "Kesehatan", "Lainnya"],
};
type CategoryKind = "income" | "expense";
type CategoryOptions = Record<CategoryKind, string[]>;
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
  const [otherCategory, setOtherCategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<CategoryOptions>({ income: categories.income.filter((item) => item !== "Lainnya"), expense: categories.expense.filter((item) => item !== "Lainnya") });
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
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionFilter, setTransactionFilter] = useState<"all" | TransactionKind>("all");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("caesh-theme");
    if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
    setDate(today());
    try {
      const savedCategories = window.localStorage.getItem("caesh-categories");
      if (savedCategories) {
        const parsed = JSON.parse(savedCategories) as Partial<CategoryOptions>;
        setCategoryOptions({
          income: Array.isArray(parsed.income) ? parsed.income.filter((item): item is string => typeof item === "string" && item.trim().length > 0 && item !== "Lainnya") : categories.income.filter((item) => item !== "Lainnya"),
          expense: Array.isArray(parsed.expense) ? parsed.expense.filter((item): item is string => typeof item === "string" && item.trim().length > 0 && item !== "Lainnya") : categories.expense.filter((item) => item !== "Lainnya"),
        });
      }
    } catch { /* Keep built-in categories if local settings are unreadable. */ }
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
  const walletName = (id: string) => wallets.find((wallet) => wallet.id === id)?.name
    ?? transactions.find((item) => item.walletId === id)?.walletName
    ?? transactions.find((item) => item.toWalletId === id)?.toWalletName
    ?? "Wallet tidak ditemukan";
  const recent = transactions.slice(0, 6);
  const visibleTransactions = transactions.filter((item) => { const query = transactionSearch.trim().toLocaleLowerCase(); const matchesSearch = !query || [item.note, item.category, walletName(item.walletId), item.toWalletId ? walletName(item.toWalletId) : ""].join(" ").toLocaleLowerCase().includes(query); return matchesSearch && (transactionFilter === "all" || item.kind === transactionFilter); });
  const transferTransactions = transactions.filter((item) => item.kind === "transfer");
  const expenseByCategory = periodTransactions.filter((item) => item.kind === "expense").reduce<Record<string, number>>((result, item) => { result[item.category] = (result[item.category] ?? 0) + item.amount; return result; }, {});
  const largestExpense = Math.max(1, ...Object.values(expenseByCategory));

  function persistCategoryOptions(next: CategoryOptions) {
    setCategoryOptions(next);
    window.localStorage.setItem("caesh-categories", JSON.stringify(next));
  }

  function removeSelectedCategory() {
    if (kind === "transfer" || category === "Lainnya") return;
    const confirmed = window.confirm(`Hapus kategori "${category}" dari daftar pilihan? Riwayat transaksi lama dengan kategori ini tetap tersimpan.`);
    if (!confirmed) return;
    const next = { ...categoryOptions, [kind]: categoryOptions[kind].filter((item) => item !== category) };
    persistCategoryOptions(next);
    setCategory(next[kind][0] ?? "Lainnya");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = parseRupiahInput(amount);
    const finalCategory = category === "Lainnya" ? otherCategory.trim() : category;
    if (kind !== "transfer" && !finalCategory) {
      setError("Isi nama kategori pada kolom Lainnya terlebih dahulu.");
      return;
    }
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
      category: kind === "transfer" ? "Transfer" : finalCategory,
      note: note.trim(), date, walletId,
      ...(kind === "transfer" ? { toWalletId } : {}), createdAt: Date.now(),
    };
    try {
      await saveTransaction(transaction);
      if (kind !== "transfer" && category === "Lainnya" && !categoryOptions[kind].some((item) => item.toLocaleLowerCase() === finalCategory.toLocaleLowerCase())) {
        persistCategoryOptions({ ...categoryOptions, [kind]: [...categoryOptions[kind], finalCategory] });
      }
      setTransactions((current) => [transaction, ...current].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt));
      setAmount(""); setNote(""); setOtherCategory(""); setDate(today()); setShowForm(false); setError("");
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

  async function handleWalletDelete(id: string) {
    if (wallets.length <= 1) {
      setError("Caesh harus memiliki minimal satu wallet. Tambahkan wallet lain sebelum menghapus yang ini.");
      return;
    }
    const wallet = wallets.find((item) => item.id === id);
    if (!wallet) return;
    const related = transactions.filter((item) => item.walletId === id || item.toWalletId === id);
    const balance = walletBalances.find((item) => item.id === id)?.balance ?? wallet.initialBalance;
    const message = related.length
      ? `Hapus wallet "${wallet.name}" dengan saldo ${rupiah(balance)}? Saldo ini akan dikeluarkan dari total saldo Caesh. ${related.length} transaksi terkait akan tetap tersimpan di riwayat dengan nama wallet ini. Jika masih ada uang, transfer dulu ke wallet lain. Penghapusan wallet tidak bisa dibatalkan.`
      : `Hapus wallet "${wallet.name}" dengan saldo ${rupiah(balance)}? Saldo ini akan dikeluarkan dari total saldo Caesh. Jika masih ada uang, transfer dulu ke wallet lain. Penghapusan wallet tidak bisa dibatalkan.`;
    if (!window.confirm(message)) return;
    try {
      await removeWallet(id);
      const nextWallets = wallets.filter((item) => item.id !== id);
      setWallets(nextWallets);
      if (walletId === id) setWalletId(nextWallets[0]?.id ?? "");
      if (toWalletId === id) setToWalletId(nextWallets.find((item) => item.id !== walletId)?.id ?? nextWallets[0]?.id ?? "");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Wallet gagal dihapus.");
    }
  }
  function changeKind(next: TransactionKind) { setKind(next); if (next !== "transfer") { setCategory(categoryOptions[next][0] ?? "Lainnya"); setOtherCategory(""); } }

  return (
    <main className="app-shell" data-theme={theme}>
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Caesh beranda"><span className="brand-mark">c</span><span>caesh<span className="brand-period">.</span></span></a>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Navigasi utama">
          <button type="button" className={activeNav === "overview" ? "nav-link active" : "nav-link"} aria-current={activeNav === "overview" ? "page" : undefined} onClick={() => setActiveNav("overview")}><span className="nav-icon">▦</span> Ringkasan</button>
          <button type="button" className={activeNav === "transactions" ? "nav-link active" : "nav-link"} aria-current={activeNav === "transactions" ? "page" : undefined} onClick={() => setActiveNav("transactions")}><span className="nav-icon">↕</span> Transaksi</button>
          <button type="button" className="nav-link nav-add-transaction" onClick={() => { setKind("expense"); setShowForm(true); }} aria-label="Tambah transaksi"><span className="nav-icon">＋</span><span className="nav-add-label">Tambah</span></button>
          <button type="button" className={activeNav === "transfer" ? "nav-link active" : "nav-link"} aria-current={activeNav === "transfer" ? "page" : undefined} onClick={() => { setActiveNav("transfer"); setKind("transfer"); }}><span className="nav-icon">⇄</span> Transfer</button>
          <button type="button" className={activeNav === "insights" ? "nav-link active" : "nav-link"} aria-current={activeNav === "insights" ? "page" : undefined} onClick={() => setActiveNav("insights")}><span className="nav-icon">⌁</span> Analisis</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-row"><div className="avatar">Y</div><div><strong>Personal space</strong><span>Mode pribadi</span></div><span className="profile-more">•••</span></div>
        </div>
      </aside>

      <section className="main-panel" id="overview">
        <header className="topbar"><div className="topbar-spacer" aria-hidden="true" /><div className="topbar-right"><span className="top-date">{todayLabel}</span><button className="theme-toggle" onClick={() => setTheme((current) => current === "light" ? "dark" : "light")} aria-label={theme === "light" ? "Aktifkan tema gelap" : "Aktifkan tema terang"} title={theme === "light" ? "Tema gelap" : "Tema terang"}><span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span><span>{theme === "light" ? "Gelap" : "Terang"}</span></button></div></header>
        <div className={activeNav === "overview" ? "content overview-content" : "content"}>
          <div className="welcome-row"><div><div className="eyebrow">{({ overview: "PERSONAL FINANCE OVERVIEW", wallets: "MONEY STORAGE", transactions: "TRANSACTION HISTORY", transfer: "MOVE YOUR MONEY", insights: "FINANCIAL INSIGHTS" })[activeNav]}</div><h1>{({ overview: <>Uangmu, lebih <em>terarah.</em></>, wallets: <>Kelola <em>wallet.</em></>, transactions: <>Semua <em>transaksi.</em></>, transfer: <>Pindahkan <em>uang.</em></>, insights: <>Kenali pola <em>keuangan.</em></> })[activeNav]}</h1></div>{activeNav !== "transfer" && <button className="primary-button" onClick={() => { setKind("expense"); setShowForm(true); }}><span>＋</span> Tambah transaksi</button>}</div>
          {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")}>Tutup</button></div>}

          {activeNav === "overview" && <>
          <div className="period-row"><span className="section-kicker">RINGKASAN KEUANGAN</span><div className="period-tabs" aria-label="Periode ringkasan"><button className={period === "month" ? "selected" : ""} onClick={() => setPeriod("month")}>Bulan ini</button><button className={period === "year" ? "selected" : ""} onClick={() => setPeriod("year")}>Tahun ini</button><button className={period === "all" ? "selected" : ""} onClick={() => setPeriod("all")}>Semua</button></div></div>
          <section className="stats-grid" aria-label="Ringkasan saldo">
            <article className="stat-card balance-card"><div className="stat-top"><span>Total saldo semua wallet</span><span className="stat-symbol">↗</span></div><div className="stat-value">{ready ? rupiah(totalBalance) : "Memuat..."}</div><div className="stat-foot"><span className="balance-dot" /> Gabungan saldo seluruh wallet</div><div className="balance-decoration">CAESH</div></article>
            <article className="stat-card"><div className="stat-top"><span>Total pemasukan</span><span className="stat-icon income-icon">↙</span></div><div className="stat-value">{ready ? rupiah(totals.income) : "Memuat..."}</div><div className="stat-foot">Uang yang masuk pada periode ini</div></article>
            <article className="stat-card"><div className="stat-top"><span>Total pengeluaran</span><span className="stat-icon expense-icon">↗</span></div><div className="stat-value">{ready ? rupiah(totals.expense) : "Memuat..."}</div><div className="stat-foot">Uang yang digunakan pada periode ini</div></article>
          </section>
          <section className="overview-wallet-panel" aria-label="Wallet">
            <div className="overview-wallet-heading"><div><span className="section-kicker">TEMPAT PENYIMPANAN UANG</span><strong>Wallet kamu</strong></div><button type="button" aria-label="Tambah wallet" onClick={() => setShowWalletForm(true)}>＋</button></div>
            <div className="overview-wallet-list">
              {walletBalances.map((wallet) => <article className="overview-wallet-item" key={wallet.id}><div className="overview-wallet-item-top"><button type="button" className="wallet-delete-button" aria-label={`Hapus wallet ${wallet.name}`} title="Hapus wallet" onClick={() => handleWalletDelete(wallet.id)}>×</button></div><strong className="wallet-name">{wallet.name}</strong><div className="overview-wallet-bottom"><div className="wallet-balance">{ready ? rupiah(wallet.balance) : "Memuat..."}</div><div className="wallet-start">Saldo awal {rupiah(wallet.initialBalance)}</div></div></article>)}
              {wallets.length === 0 && ready && <div className="wallet-empty">Belum ada wallet. Tambahkan wallet pertamamu.</div>}
            </div>
          </section>

          </>}

          {activeNav === "overview" && <section className="lower-grid" id="transactions">
            <article className="panel-card transactions-card"><div className="panel-heading"><div><div className="section-kicker">CATATAN TERBARU</div><h2>Aktivitas transaksi</h2></div><button className="text-button" onClick={() => setShowForm(true)}>＋ Catat baru</button></div>
              {!ready ? <div className="empty-state">Memuat data lokal...</div> : recent.length === 0 ? <div className="empty-state"><div className="empty-art">↗</div><strong>Belum ada transaksi</strong><p>Mulai catat pemasukan atau pengeluaran pertamamu.</p><button className="outline-button" onClick={() => setShowForm(true)}>Tambah transaksi pertama</button></div> :
              <div className="transaction-list">{recent.map((item) => <div className="transaction-row" key={item.id}><div className={`transaction-icon ${item.kind}`}>{item.kind === "income" ? "↙" : item.kind === "expense" ? "↗" : "⇄"}</div><div className="transaction-info"><strong>{item.note || item.category}</strong><span>{item.kind === "transfer" ? `${walletName(item.walletId)} → ${walletName(item.toWalletId ?? "")}` : `${item.category} · ${walletName(item.walletId)}`} · {new Date(item.date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span></div><div className={`transaction-amount ${item.kind}`}>{item.kind === "income" ? "+" : item.kind === "expense" ? "−" : "⇄"}{rupiah(item.amount)}</div><button className="delete-button" aria-label="Hapus transaksi" onClick={() => handleDelete(item.id)}>×</button></div>)}</div>}
            </article>
            <article className="panel-card insight-card" id="insights"><div className="section-kicker">KEBIASAAN FINANSIAL</div><h2>Ringkasan aktivitas</h2><div className="insight-metric"><span>Jumlah transaksi</span><strong>{periodTransactions.length}</strong></div><div className="insight-metric"><span>Rata-rata pengeluaran</span><strong>{rupiah(expenseCount ? totals.expense / expenseCount : 0)}</strong></div><div className="insight-note"><span>✳</span><p>Catat transaksi secara rutin agar ringkasan keuanganmu semakin akurat.</p></div></article>
          </section>}

          {activeNav === "transactions" && <section className="panel-card page-section" id="transactions">
            <div className="panel-heading"><div><div className="section-kicker">RIWAYAT LENGKAP</div><h2>Semua transaksi</h2></div><span className="result-count">{visibleTransactions.length} catatan</span></div>
            <div className="transaction-tools"><input aria-label="Cari transaksi" type="search" placeholder="Cari catatan, kategori, atau wallet..." value={transactionSearch} onChange={(event) => setTransactionSearch(event.target.value)} /><select aria-label="Filter jenis transaksi" value={transactionFilter} onChange={(event) => setTransactionFilter(event.target.value as "all" | TransactionKind)}><option value="all">Semua jenis</option><option value="income">Pemasukan</option><option value="expense">Pengeluaran</option><option value="transfer">Transfer</option></select></div>
            {!ready ? <div className="empty-state">Memuat data lokal...</div> : visibleTransactions.length === 0 ? <div className="empty-state"><strong>Tidak ada transaksi ditemukan</strong><p>Coba ubah kata pencarian atau filter yang dipilih.</p></div> : <div className="transaction-list">{visibleTransactions.map((item) => <div className="transaction-row" key={item.id}><div className={`transaction-icon ${item.kind}`}>{item.kind === "income" ? "↙" : item.kind === "expense" ? "↗" : "⇄"}</div><div className="transaction-info"><strong>{item.note || item.category}</strong><span>{item.kind === "transfer" ? `${walletName(item.walletId)} → ${walletName(item.toWalletId ?? "")}` : `${item.category} · ${walletName(item.walletId)}`} · {new Date(item.date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span></div><div className={`transaction-amount ${item.kind}`}>{item.kind === "income" ? "+" : item.kind === "expense" ? "−" : "⇄"}{rupiah(item.amount)}</div><button className="delete-button" aria-label="Hapus transaksi" onClick={() => handleDelete(item.id)}>×</button></div>)}</div>}
          </section>}

          {activeNav === "transfer" && <section className="page-section transfer-page">
            <div className="transfer-intro panel-card"><div><div className="section-kicker">TRANSFER ANTAR-WALLET</div><h2>Atur perpindahan saldo</h2></div><button className="primary-button" onClick={() => { setKind("transfer"); setShowForm(true); }}>＋ Buat transfer</button></div>
            <div className="transfer-wallet-grid">{walletBalances.map((wallet) => <article className="wallet-card" key={wallet.id}><span className="wallet-caption">SALDO TERSEDIA</span><strong className="wallet-name">{wallet.name}</strong><div className="wallet-balance">{rupiah(wallet.balance)}</div></article>)}</div>
            <article className="panel-card"><div className="panel-heading"><div><div className="section-kicker">RIWAYAT TRANSFER</div><h2>Transfer terbaru</h2></div><span className="result-count">{transferTransactions.length} transfer</span></div>{transferTransactions.length === 0 ? <div className="empty-state"><strong>Belum ada transfer</strong><p>Transfer antar-wallet yang kamu buat akan muncul di sini.</p></div> : <div className="transaction-list">{transferTransactions.map((item) => <div className="transaction-row" key={item.id}><div className="transaction-icon transfer">⇄</div><div className="transaction-info"><strong>{item.note || "Transfer antar-wallet"}</strong><span>{walletName(item.walletId)} → {walletName(item.toWalletId ?? "")} · {new Date(item.date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span></div><div className="transaction-amount transfer">{rupiah(item.amount)}</div><button className="delete-button" aria-label="Hapus transfer" onClick={() => handleDelete(item.id)}>×</button></div>)}</div>}</article>
          </section>}

          {activeNav === "insights" && <section className="page-section analysis-page">
            <div className="stats-grid analysis-stats"><article className="stat-card"><div className="stat-top"><span>Jumlah transaksi</span></div><div className="stat-value">{periodTransactions.length}</div><div className="stat-foot">Pada periode yang dipilih</div></article><article className="stat-card"><div className="stat-top"><span>Rata-rata pengeluaran</span></div><div className="stat-value">{rupiah(expenseCount ? totals.expense / expenseCount : 0)}</div><div className="stat-foot">Per transaksi pengeluaran</div></article><article className="stat-card"><div className="stat-top"><span>Arus bersih</span></div><div className="stat-value">{rupiah(totals.income - totals.expense)}</div><div className="stat-foot">Pemasukan dikurangi pengeluaran</div></article></div>
            <div className="period-row"><span className="section-kicker">PERIODE ANALISIS</span><div className="period-tabs"><button className={period === "month" ? "selected" : ""} onClick={() => setPeriod("month")}>Bulan ini</button><button className={period === "year" ? "selected" : ""} onClick={() => setPeriod("year")}>Tahun ini</button><button className={period === "all" ? "selected" : ""} onClick={() => setPeriod("all")}>Semua</button></div></div>
            <article className="panel-card category-analysis"><div className="section-kicker">PENGELUARAN PER KATEGORI</div><h2>Ke mana uangmu pergi?</h2>{Object.keys(expenseByCategory).length === 0 ? <div className="empty-state"><strong>Belum ada data pengeluaran</strong><p>Data kategori akan muncul setelah kamu mencatat pengeluaran.</p></div> : Object.entries(expenseByCategory).sort((a,b) => b[1]-a[1]).map(([name,value]) => <div className="category-bar-row" key={name}><div className="category-bar-label"><strong>{name}</strong><span>{rupiah(value)}</span></div><div className="category-bar-track"><span style={{ width: `${Math.max(3, value / largestExpense * 100)}%` }} /></div></div>)}</article>
          </section>}
                  </div>
      </section>

      {showForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><div className="section-kicker">CATATAN BARU</div><h2 id="modal-title">Tambah transaksi</h2></div><button className="modal-close" onClick={() => setShowForm(false)} aria-label="Tutup">×</button></div>
        <form onSubmit={handleSubmit}><div className="kind-switch"><button type="button" className={kind === "expense" ? "active expense-choice" : ""} onClick={() => changeKind("expense")}>Pengeluaran</button><button type="button" className={kind === "income" ? "active income-choice" : ""} onClick={() => changeKind("income")}>Pemasukan</button><button type="button" className={kind === "transfer" ? "active transfer-choice" : ""} onClick={() => changeKind("transfer")}>Transfer</button></div>
          <label className="field-label" htmlFor="amount">Nominal (Rp)</label><div className="currency-input-wrap"><span>Rp</span><input id="amount" className="amount-input" inputMode="numeric" type="text" placeholder="0" value={amount} onChange={(event) => setAmount(formatRupiahInput(event.target.value))} required /></div>
          <div className="form-grid"><div>{kind !== "transfer" ? <><label className="field-label" htmlFor="category">Kategori</label><select id="category" value={category} onChange={(event) => setCategory(event.target.value)}>{categoryOptions[kind].map((item) => <option key={item} value={item}>{item}</option>)}<option value="Lainnya">Lainnya</option></select>
              {category === "Lainnya" ? <><label className="field-label" htmlFor="other-category">Nama kategori</label><input id="other-category" type="text" maxLength={32} placeholder="Contoh: Donasi, Perawatan, Langganan..." value={otherCategory} onChange={(event) => setOtherCategory(event.target.value)} required /></> : <button type="button" className="category-remove-button" onClick={removeSelectedCategory}>Hapus kategori ini</button>}</> : <><label className="field-label" htmlFor="source-wallet">Dari wallet</label><select id="source-wallet" value={walletId} onChange={(event) => { const nextSource = event.target.value; setWalletId(nextSource); if (toWalletId === nextSource) setToWalletId(wallets.find((wallet) => wallet.id !== nextSource)?.id ?? ""); }} required>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} — {rupiah(walletBalances.find((entry) => entry.id === wallet.id)?.balance ?? 0)}</option>)}</select></>}</div><div><label className="field-label" htmlFor="wallet">{kind === "transfer" ? "Ke wallet" : "Wallet"}</label><select id="wallet" value={kind === "transfer" ? toWalletId : walletId} onChange={(event) => kind === "transfer" ? setToWalletId(event.target.value) : setWalletId(event.target.value)} required>{wallets.filter((wallet) => kind !== "transfer" || wallet.id !== walletId).map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select></div></div>
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
