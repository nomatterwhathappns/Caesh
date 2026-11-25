"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import { AppInstallPlugin } from "../lib/app-install-plugin";
import { calculateExpenseSummary, getExpenseDateRange, ExpenseWidgetPeriod, ExpenseWidgetSettings } from "@/lib/expense-widget";
import {
  createDebtNote, recordDebtMovement, getTransactions, getWallets, removeTransaction, removeWallet, saveTransaction, saveWallet,
  DebtDirection, Transaction, TransactionKind, Wallet, WishlistItem, getWishlist, saveWishlist, removeWishlist, purchaseWishlist,
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
type CaeshUpdate = { version: string; apkUrl: string; notes?: string };
const UPDATE_MANIFEST_URL = "https://raw.githubusercontent.com/nomatterwhathappns/Caesh/caesh/public/update.json";
function compareVersions(left: string, right: string) {
  const a = left.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const b = right.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}
const today = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function CaeshApp() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [showWishlistForm, setShowWishlistForm] = useState(false);
  const [newWishlistName, setNewWishlistName] = useState("");
  const [purchaseTarget, setPurchaseTarget] = useState<WishlistItem | null>(null);
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [purchaseWalletId, setPurchaseWalletId] = useState("");
  const [wishlistTab, setWishlistTab] = useState<"pending" | "purchased">("pending");
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
  const [newWalletCategory, setNewWalletCategory] = useState<"standard" | "notes">("standard");
  const [newDebtDirection, setNewDebtDirection] = useState<DebtDirection>("lent");
  const [newDebtAmount, setNewDebtAmount] = useState("");
  const [newDebtCashWalletId, setNewDebtCashWalletId] = useState("");
  const [debtAction, setDebtAction] = useState<"add" | "payment" | null>(null);
  const [debtTargetWalletId, setDebtTargetWalletId] = useState<string | null>(null);
  const [debtAmount, setDebtAmount] = useState("");
  const [debtCashWalletId, setDebtCashWalletId] = useState("");
  const [debtSaving, setDebtSaving] = useState(false);
  const [newWalletPhoto, setNewWalletPhoto] = useState("");
  const [newWalletPhotoX, setNewWalletPhotoX] = useState(50);
  const [newWalletPhotoY, setNewWalletPhotoY] = useState(50);
  const [newWalletPhotoZoom, setNewWalletPhotoZoom] = useState(1.15);
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const [photoTargetWalletId, setPhotoTargetWalletId] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState("");
  const [photoX, setPhotoX] = useState(50);
  const [photoY, setPhotoY] = useState(50);
  const [photoZoom, setPhotoZoom] = useState(1.15);
  const photoPickerRef = useRef<HTMLInputElement>(null);
  const [todayLabel, setTodayLabel] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showWalletForm, setShowWalletForm] = useState(false);
  const [detailWalletId, setDetailWalletId] = useState<string | null>(null);
  const [detailWalletNote, setDetailWalletNote] = useState("");
  const [detailWalletSaving, setDetailWalletSaving] = useState(false);
  const [period, setPeriod] = useState("month");
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [activeNav, setActiveNav] = useState<"overview" | "wallets" | "transactions" | "insights" | "wishlist">("overview");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionFilter, setTransactionFilter] = useState<"all" | TransactionKind | "debt">("all");
  const [availableUpdate, setAvailableUpdate] = useState<CaeshUpdate | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateDownloadProgress, setUpdateDownloadProgress] = useState<number | null>(null);
  const [downloadedUpdatePath, setDownloadedUpdatePath] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState("");
  const [expenseWidgetSettings, setExpenseWidgetSettings] = useState<ExpenseWidgetSettings>({ period: "monthly", walletIds: null, startDate: today(), endDate: today() });
  const [expenseWidgetSettingsLoaded, setExpenseWidgetSettingsLoaded] = useState(false);
  const [showExpenseWidgetSettings, setShowExpenseWidgetSettings] = useState(false);
  const [balanceFilterWalletIds, setBalanceFilterWalletIds] = useState<string[] | null>(null);
  const [balanceFilterLoaded, setBalanceFilterLoaded] = useState(false);
  const [showBalanceFilter, setShowBalanceFilter] = useState(false);

  useEffect(() => {
    try {
      const rawBalanceFilter = window.localStorage.getItem("caesh-balance-wallet-filter");
      if (rawBalanceFilter !== null) {
        const parsed: unknown = JSON.parse(rawBalanceFilter);
        if (parsed === null) setBalanceFilterWalletIds(null);
        else if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) setBalanceFilterWalletIds(parsed);
      }
    } catch { /* Keep the default of including all wallets if saved settings are unreadable. */ }
    setBalanceFilterLoaded(true);
  }, []);

  useEffect(() => {
    try {
      const rawWidgetSettings = window.localStorage.getItem("caesh-expense-widget");
      if (rawWidgetSettings) {
        const parsed = JSON.parse(rawWidgetSettings) as Partial<ExpenseWidgetSettings>;
        const periods: ExpenseWidgetPeriod[] = ["daily", "weekly", "monthly", "custom"];
        setExpenseWidgetSettings({
          period: periods.includes(parsed.period as ExpenseWidgetPeriod) ? parsed.period as ExpenseWidgetPeriod : "monthly",
          walletIds: parsed.walletIds === null || parsed.walletIds === undefined ? null : Array.isArray(parsed.walletIds) ? parsed.walletIds.filter((id): id is string => typeof id === "string") : null,
          startDate: typeof parsed.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.startDate) ? parsed.startDate : today(),
          endDate: typeof parsed.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.endDate) ? parsed.endDate : today(),
        });
      }
    } catch { /* Use safe defaults when saved widget preferences are unreadable. */ }
    setExpenseWidgetSettingsLoaded(true);
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
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    async function checkForUpdate() {
      try {
        const appInfo = await App.getInfo();
        const manifestUrl = `${UPDATE_MANIFEST_URL}?t=${Date.now()}`;
        let manifest: Partial<CaeshUpdate>;
        try {
          const nativeResponse = await CapacitorHttp.get({
            url: manifestUrl,
            headers: { Accept: "application/json", "Cache-Control": "no-cache" },
            connectTimeout: 10000,
            readTimeout: 10000,
          });
          if (nativeResponse.status < 200 || nativeResponse.status >= 300) {
            throw new Error(`GitHub manifest returned HTTP ${nativeResponse.status}`);
          }
          manifest = (typeof nativeResponse.data === "string"
            ? JSON.parse(nativeResponse.data)
            : nativeResponse.data) as Partial<CaeshUpdate>;
        } catch (nativeError) {
          console.warn("CAESH native update check failed; trying WebView fetch.", nativeError);
          const response = await fetch(manifestUrl, {
            cache: "no-store",
            headers: { Accept: "application/json", "Cache-Control": "no-cache" },
          });
          if (!response.ok) throw new Error(`Update manifest returned HTTP ${response.status}`);
          manifest = await response.json() as Partial<CaeshUpdate>;
        }
        if (cancelled || typeof manifest.version !== "string" || typeof manifest.apkUrl !== "string" || !/^https:\/\//i.test(manifest.apkUrl)) return;
        if (compareVersions(manifest.version, appInfo.version) > 0) {
          setAvailableUpdate({ version: manifest.version, apkUrl: manifest.apkUrl, notes: typeof manifest.notes === "string" ? manifest.notes : undefined });
        } else {
          setAvailableUpdate(null);
        }
      } catch { /* Offline: do not interrupt normal app usage. */ }
    }
    void checkForUpdate();
    const stateListener = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void checkForUpdate();
    });
    return () => {
      cancelled = true;
      void stateListener.then((listener) => listener.remove());
    };
  }, []);

  async function downloadAndInstallUpdate() {
    if (!availableUpdate) return;
    setUpdateLoading(true);
    setUpdateError("");
    try {
      let apkPath = downloadedUpdatePath;
      if (!apkPath) {
        setUpdateDownloadProgress(0);
        const target = await Filesystem.getUri({ directory: Directory.Cache, path: "caesh-update.apk" });
        const progressListener = await FileTransfer.addListener("progress", (event) => {
          if (event.type !== "download" || !event.lengthComputable || event.contentLength <= 0) return;
          setUpdateDownloadProgress(Math.min(100, Math.round((event.bytes / event.contentLength) * 100)));
        });
        try {
          await FileTransfer.downloadFile({ url: availableUpdate.apkUrl, path: target.uri, progress: true });
        } finally {
          await progressListener.remove();
        }
        apkPath = target.uri.startsWith("file://") ? decodeURIComponent(target.uri.slice(7)) : target.uri;
        setDownloadedUpdatePath(apkPath);
        setUpdateDownloadProgress(100);
      }

      const permission = await AppInstallPlugin.canInstallUnknownApps();
      if (!permission.granted) {
        await AppInstallPlugin.openInstallUnknownAppsSettings();
        setUpdateError("Aktifkan izin instalasi untuk CAESH, lalu kembali ke sini dan tekan Pasang update.");
        return;
      }

      if (!apkPath) throw new Error("File APK pembaruan tidak ditemukan.");
      const result = await AppInstallPlugin.installApk({ filePath: apkPath });
      if (!result.completed) throw new Error(result.message || "Installer Android tidak dapat dibuka.");
    } catch (reason) {
      setUpdateError(reason instanceof Error ? reason.message : "Pembaruan gagal diunduh atau dipasang. Coba lagi.");
    } finally {
      setUpdateLoading(false);
    }
  }

  useEffect(() => {
    if (!balanceFilterLoaded) return;
    window.localStorage.setItem("caesh-balance-wallet-filter", JSON.stringify(balanceFilterWalletIds));
  }, [balanceFilterWalletIds, balanceFilterLoaded]);

  useEffect(() => {
    if (!expenseWidgetSettingsLoaded) return;
    window.localStorage.setItem("caesh-expense-widget", JSON.stringify(expenseWidgetSettings));
  }, [expenseWidgetSettings, expenseWidgetSettingsLoaded]);

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
  const selectedBalanceWalletIds = balanceFilterWalletIds === null
    ? wallets.map((wallet) => wallet.id)
    : balanceFilterWalletIds.filter((id) => wallets.some((wallet) => wallet.id === id));
  const totalBalance = walletBalances.reduce(
    (sum, wallet) => sum + (selectedBalanceWalletIds.includes(wallet.id) ? wallet.balance : 0),
    0,
  );
  function toggleBalanceFilterWallet(walletId: string) {
    setBalanceFilterWalletIds((current) => {
      const selected = current === null ? wallets.map((wallet) => wallet.id) : current.filter((id) => wallets.some((wallet) => wallet.id === id));
      return selected.includes(walletId) ? selected.filter((id) => id !== walletId) : [...selected, walletId];
    });
  }
  function toggleAllBalanceFilterWallets() {
    setBalanceFilterWalletIds(selectedBalanceWalletIds.length === wallets.length ? [] : wallets.map((wallet) => wallet.id));
  }
  const expenseWidgetWalletIds = expenseWidgetSettings.walletIds ?? wallets.map((wallet) => wallet.id);
  const expenseWidgetRange = getExpenseDateRange(expenseWidgetSettings.period, new Date(), expenseWidgetSettings.startDate, expenseWidgetSettings.endDate);
  const expenseWidgetSummary = calculateExpenseSummary(transactions, expenseWidgetWalletIds, expenseWidgetRange);
  const expenseWidgetRangeLabel = expenseWidgetRange.start && expenseWidgetRange.end
    ? `${new Date(expenseWidgetRange.start + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} – ${new Date(expenseWidgetRange.end + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`
    : "Pilih rentang tanggal";
  function toggleExpenseWidgetWallet(walletId: string) {
    const current = expenseWidgetSettings.walletIds ?? wallets.map((wallet) => wallet.id);
    const next = current.includes(walletId) ? current.filter((id) => id !== walletId) : [...current, walletId];
    setExpenseWidgetSettings((settings) => ({ ...settings, walletIds: next }));
  }

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
  const regularWallets = wallets.filter((wallet) => wallet.category !== "notes");
  const walletName = (id: string) => wallets.find((wallet) => wallet.id === id)?.name
    ?? transactions.find((item) => item.walletId === id)?.walletName
    ?? transactions.find((item) => item.toWalletId === id)?.toWalletName
    ?? "Wallet tidak ditemukan";
  const detailWallet = wallets.find((wallet) => wallet.id === detailWalletId) ?? null;
  const detailWalletBalance = detailWallet ? walletBalances.find((wallet) => wallet.id === detailWallet.id)?.balance ?? detailWallet.initialBalance : 0;
  const detailWalletTransactions = detailWallet
    ? transactions.filter((item) => item.walletId === detailWallet.id || item.toWalletId === detailWallet.id)
    : [];
  const detailWalletIncome = detailWalletTransactions.filter((item) => item.kind === "income" && item.walletId === detailWallet?.id).reduce((sum, item) => sum + item.amount, 0);
  const detailWalletExpense = detailWalletTransactions.filter((item) => item.kind === "expense" && item.walletId === detailWallet?.id).reduce((sum, item) => sum + item.amount, 0);
  async function saveDetailWalletNote() {
    if (!detailWallet || detailWalletSaving) return;
    const updatedWallet = { ...detailWallet, note: detailWalletNote.trim() };
    setDetailWalletSaving(true);
    try {
      await saveWallet(updatedWallet);
      setWallets((current) => current.map((wallet) => wallet.id === updatedWallet.id ? updatedWallet : wallet));
      setError("");
    } catch {
      setError("Catatan wallet gagal disimpan. Coba lagi.");
    } finally {
      setDetailWalletSaving(false);
    }
  }
  const recent = transactions.slice(0, 6);
  const visibleTransactions = transactions.filter((item) => { const query = transactionSearch.trim().toLocaleLowerCase(); const matchesSearch = !query || [item.note, item.category, walletName(item.walletId), item.toWalletId ? walletName(item.toWalletId) : ""].join(" ").toLocaleLowerCase().includes(query); const matchesFilter = transactionFilter === "all" || (transactionFilter === "debt" ? item.category === "Utang" : item.kind === transactionFilter && item.category !== "Utang"); return matchesSearch && matchesFilter; });
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

  function buildDebtTransaction(noteWallet: Wallet, cashWallet: Wallet, value: number, action: "add" | "payment"): Transaction {
    const direction = noteWallet.debtDirection ?? "lent";
    const noteIsSource = action === "add" ? direction === "borrowed" : direction === "lent";
    const source = noteIsSource ? noteWallet : cashWallet;
    const destination = noteIsSource ? cashWallet : noteWallet;
    const description = action === "add"
      ? direction === "lent" ? "Utang diberikan" : "Utang diterima"
      : direction === "lent" ? "Pembayaran utang diterima" : "Pembayaran utang dilakukan";
    return {
      id: crypto.randomUUID(), kind: "transfer", amount: value, category: "Utang",
      note: description, date: today(), walletId: source.id, walletName: source.name,
      toWalletId: destination.id, toWalletName: destination.name, createdAt: Date.now(),
    };
  }

  async function handleDebtSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!debtAction || !debtTargetWalletId || debtSaving) return;
    const noteWallet = wallets.find((wallet) => wallet.id === debtTargetWalletId);
    const cashWallet = regularWallets.find((wallet) => wallet.id === debtCashWalletId);
    const value = parseRupiahInput(debtAmount);
    if (!noteWallet || noteWallet.category !== "notes" || !noteWallet.debtDirection) {
      setError("Notes ini sudah lunas atau tidak ditemukan.");
      setDebtAction(null);
      return;
    }
    if (!cashWallet) { setError("Pilih wallet biasa terlebih dahulu."); return; }
    if (!Number.isSafeInteger(value) || value <= 0) { setError("Masukkan nominal rupiah lebih dari nol."); return; }
    const currentBalance = walletBalances.find((wallet) => wallet.id === noteWallet.id)?.balance ?? 0;
    if (debtAction === "payment" && value > Math.abs(currentBalance)) {
      setError("Nominal pembayaran melebihi sisa utang.");
      return;
    }
    const cashBalance = walletBalances.find((wallet) => wallet.id === cashWallet.id)?.balance ?? 0;
    if (((debtAction === "add" && noteWallet.debtDirection === "lent")
      || (debtAction === "payment" && noteWallet.debtDirection === "borrowed")) && cashBalance < value) {
      setError(debtAction === "add" ? "Saldo wallet sumber tidak mencukupi." : "Saldo wallet tidak mencukupi untuk membayar utang.");
      return;
    }
    setDebtSaving(true);
    try {
      const transaction = buildDebtTransaction(noteWallet, cashWallet, value, debtAction);
      const result = await recordDebtMovement(noteWallet.id, transaction, debtAction);
      const [savedTransactions, savedWallets] = await Promise.all([getTransactions(), getWallets()]);
      setTransactions(savedTransactions);
      setWallets(savedWallets);
      setDebtAction(null);
      setDebtTargetWalletId(null);
      setDebtAmount("");
      setError("");
      if (result.closed) {
        setDetailWalletId(null);
        setDetailWalletNote("");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Catatan utang gagal disimpan.");
    } finally {
      setDebtSaving(false);
    }
  }

  function openDebtAction(wallet: Wallet, action: "add" | "payment") {
    const fallbackWallet = regularWallets[0];
    setDebtTargetWalletId(wallet.id);
    setDebtAction(action);
    setDebtAmount("");
    setDebtCashWalletId(fallbackWallet?.id ?? "");
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

  function openWalletPhotoEditor(walletId?: string) {
    setPhotoTargetWalletId(walletId ?? null);
    if (walletId) {
      const wallet = wallets.find((item) => item.id === walletId);
      if (!wallet) return;
      setPendingPhoto(wallet.photo ?? "");
      setPhotoX(wallet.photoX ?? 50);
      setPhotoY(wallet.photoY ?? 50);
      setPhotoZoom(wallet.photoZoom ?? 1.15);
    } else {
      setPendingPhoto(newWalletPhoto);
      setPhotoX(newWalletPhotoX);
      setPhotoY(newWalletPhotoY);
      setPhotoZoom(newWalletPhotoZoom);
    }
    setShowPhotoEditor(true);
  }

  async function handlePhotoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Pilih file gambar seperti JPG, PNG, atau WebP."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Ukuran foto maksimal 8 MB."); return; }
    try {
      const bitmap = await createImageBitmap(file);
      const maxDimension = 1400;
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) { bitmap.close(); throw new Error("Foto tidak dapat diproses oleh browser."); }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      setPendingPhoto(canvas.toDataURL("image/jpeg", 0.84));
      setPhotoX(50); setPhotoY(50); setPhotoZoom(1.15);
      setShowPhotoEditor(true); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Foto gagal dibuka."); }
  }

  async function handlePhotoSave() {
    if (photoTargetWalletId) {
      const wallet = wallets.find((item) => item.id === photoTargetWalletId);
      if (!wallet) return;
      const updatedWallet: Wallet = {
        ...wallet,
        ...(pendingPhoto ? { photo: pendingPhoto, photoX, photoY, photoZoom } : { photo: undefined, photoX: undefined, photoY: undefined, photoZoom: undefined }),
      };
      try {
        await saveWallet(updatedWallet);
        setWallets((current) => current.map((item) => item.id === updatedWallet.id ? updatedWallet : item));
        setShowPhotoEditor(false); setError("");
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Foto wallet gagal disimpan."); }
      return;
    }
    setNewWalletPhoto(pendingPhoto); setNewWalletPhotoX(photoX); setNewWalletPhotoY(photoY); setNewWalletPhotoZoom(photoZoom);
    setShowPhotoEditor(false);
  }

  async function handleWalletSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newWalletName.trim();
    const balance = parseRupiahInput(newWalletBalance);
    if (!name) { setError("Nama wallet wajib diisi."); return; }
    if (newWalletCategory === "standard" && (!Number.isSafeInteger(balance) || balance < 0)) { setError("Saldo awal harus berupa angka rupiah bulat, minimal nol."); return; }
    if (wallets.some((wallet) => wallet.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setError("Nama wallet tersebut sudah digunakan."); return;
    }
    if (newWalletCategory === "notes") {
      const debtValue = parseRupiahInput(newDebtAmount);
      const cashWallet = regularWallets.find((item) => item.id === newDebtCashWalletId);
      if (!Number.isSafeInteger(debtValue) || debtValue <= 0) { setError("Masukkan nominal utang lebih dari nol."); return; }
      if (!cashWallet) { setError("Pilih wallet biasa untuk menerima atau memberikan uang."); return; }
      if (wallets.some((item) => item.category === "notes" && item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
        setError("Notes untuk orang ini masih aktif. Tambahkan utangnya dari detail Notes yang sudah ada.");
        return;
      }
      const noteWallet: Wallet = {
        id: crypto.randomUUID(), name, initialBalance: 0, createdAt: Date.now(),
        category: "notes", debtDirection: newDebtDirection,
        ...(newWalletPhoto ? { photo: newWalletPhoto, photoX: newWalletPhotoX, photoY: newWalletPhotoY, photoZoom: newWalletPhotoZoom } : {}),
      };
      const transaction = buildDebtTransaction(noteWallet, cashWallet, debtValue, "add");
      try {
        await createDebtNote(noteWallet, transaction);
        setWallets((current) => [...current, noteWallet]);
        setTransactions((current) => [transaction, ...current].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt));
        setNewWalletName(""); setNewWalletBalance("0"); setNewDebtAmount(""); setNewWalletCategory("standard"); setNewDebtDirection("lent"); setNewDebtCashWalletId(""); setNewWalletPhoto(""); setNewWalletPhotoX(50); setNewWalletPhotoY(50); setNewWalletPhotoZoom(1.15); setShowWalletForm(false); setError("");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Notes utang gagal dibuat.");
      }
      return;
    }
    const wallet: Wallet = { id: crypto.randomUUID(), name, initialBalance: balance, createdAt: Date.now(), category: "standard", ...(newWalletPhoto ? { photo: newWalletPhoto, photoX: newWalletPhotoX, photoY: newWalletPhotoY, photoZoom: newWalletPhotoZoom } : {}) };
    try {
      await saveWallet(wallet);
      setWallets((current) => [...current, wallet]);
      setWalletId(wallet.id);
      setNewWalletName(""); setNewWalletBalance("0"); setNewDebtAmount(""); setNewWalletCategory("standard"); setNewDebtDirection("lent"); setNewDebtCashWalletId(""); setNewWalletPhoto(""); setNewWalletPhotoX(50); setNewWalletPhotoY(50); setNewWalletPhotoZoom(1.15); setShowWalletForm(false); setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Wallet gagal disimpan.");
    }
  }

  async function handleDelete(id: string) {
    const target = transactions.find((item) => item.id === id);
    if (target?.category === "Utang") { setError("Riwayat utang tidak bisa dihapus langsung agar saldo dan status pelunasan tetap akurat."); return; }
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
    if (wallet.category === "notes") { setError("Notes utang hanya akan hilang otomatis setelah lunas."); return; }
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
  async function handleWishlistCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newWishlistName.trim();
    if (!name) return;
    const item: WishlistItem = { id: crypto.randomUUID(), name, status: "pending", createdAt: Date.now() };
    try {
      await saveWishlist(item);
      setWishlist((current) => [item, ...current]);
      setNewWishlistName("");
      setShowWishlistForm(false);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Wishlist gagal disimpan.");
    }
  }

  async function handleWishlistDelete(item: WishlistItem) {
    if (!window.confirm(`Hapus "${item.name}" dari wishlist?`)) return;
    try {
      await removeWishlist(item.id);
      setWishlist((current) => current.filter((entry) => entry.id !== item.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Wishlist gagal dihapus.");
    }
  }

  async function handleWishlistPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!purchaseTarget) return;
    const value = parseRupiahInput(purchaseAmount);
    const selectedWallet = walletBalances.find((wallet) => wallet.id === purchaseWalletId);
    if (!Number.isSafeInteger(value) || value <= 0) { setError("Masukkan harga pembelian yang valid."); return; }
    if (!selectedWallet) { setError("Pilih wallet untuk pembelian."); return; }
    if (selectedWallet.balance < value) { setError("Saldo wallet tidak mencukupi untuk pembelian ini."); return; }
    const transaction: Transaction = {
      id: crypto.randomUUID(), kind: "expense", amount: value, category: "Wishlist",
      note: `Pembelian wishlist: ${purchaseTarget.name}`, date: today(), walletId: selectedWallet.id,
      createdAt: Date.now(),
    };
    const updatedItem: WishlistItem = {
      ...purchaseTarget, status: "purchased", purchasedAt: Date.now(),
      purchaseAmount: value, walletId: selectedWallet.id, transactionId: transaction.id,
    };
    try {
      await purchaseWishlist(updatedItem, transaction);
      setTransactions((current) => [transaction, ...current].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt));
      setWishlist((current) => current.map((entry) => entry.id === updatedItem.id ? updatedItem : entry));
      setPurchaseTarget(null); setPurchaseAmount(""); setError("");
      setWishlistTab("purchased");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pembelian wishlist gagal disimpan.");
    }
  }

  function changeKind(next: TransactionKind) { setKind(next); if (next !== "transfer") { setCategory(categoryOptions[next][0] ?? "Lainnya"); setOtherCategory(""); } }

  return (
    <main className="app-shell" data-theme={theme}>
      <aside className="sidebar">
        
        <nav className="side-nav desktop-icon-dock" aria-label="Navigasi utama">
          <button type="button" className={activeNav === "overview" ? "nav-link active" : "nav-link"} aria-current={activeNav === "overview" ? "page" : undefined} onClick={() => setActiveNav("overview")} aria-label="Ringkasan" title="Ringkasan"><span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/></svg></span><span className="nav-label">Ringkasan</span></button>
          <button type="button" className={activeNav === "transactions" ? "nav-link active" : "nav-link"} aria-current={activeNav === "transactions" ? "page" : undefined} onClick={() => setActiveNav("transactions")} aria-label="Transaksi" title="Transaksi"><span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M15 3v5h5M9 13h6M9 17h6"/></svg></span><span className="nav-label">Transaksi</span></button>
          <button type="button" className={activeNav === "insights" ? "nav-link active" : "nav-link"} aria-current={activeNav === "insights" ? "page" : undefined} onClick={() => setActiveNav("insights")} aria-label="Analisis" title="Analisis"><span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 6-7"/><path d="M16 6h4v4"/></svg></span><span className="nav-label">Analisis</span></button>
          <button type="button" className="nav-link" onClick={() => { setKind("expense"); setShowForm(true); }} aria-label="Tambah transaksi" title="Tambah transaksi"><span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span><span className="nav-label">Tambah</span></button>
          <button type="button" className={activeNav === "wishlist" ? "nav-link active" : "nav-link"} aria-current={activeNav === "wishlist" ? "page" : undefined} onClick={() => setActiveNav("wishlist")} aria-label="Wishlist" title="Wishlist"><span className="nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z"/></svg></span><span className="nav-label">Wishlist</span></button>
        </nav>
      </aside>

      <section className="main-panel" id="overview">
        <header className="topbar"><a className="brand topbar-brand" href="#" aria-label="Caesh beranda"><span className="topbar-brand-name">caesh<span className="brand-period">.</span></span></a><div className="topbar-right"><span className="top-date">{todayLabel}</span><button className="theme-toggle" onClick={() => setTheme((current) => current === "light" ? "dark" : "light")} aria-label={theme === "light" ? "Aktifkan tema gelap" : "Aktifkan tema terang"} title={theme === "light" ? "Tema gelap" : "Tema terang"}><span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span><span>{theme === "light" ? "Gelap" : "Terang"}</span></button></div></header>
        <div className={activeNav === "overview" ? "content overview-content" : "content"}>
          <div className="welcome-row"><div><div className="eyebrow">{({ overview: "PERSONAL FINANCE OVERVIEW", wallets: "MONEY STORAGE", transactions: "TRANSACTION HISTORY", insights: "FINANCIAL INSIGHTS", wishlist: "YOUR WISHLIST" })[activeNav]}</div><h1>{({ overview: <>Uangmu, lebih <em>terarah.</em></>, wallets: <>Kelola <em>wallet.</em></>, transactions: <>Semua <em>transaksi.</em></>, insights: <>Kenali pola <em>keuangan.</em></>, wishlist: <>Daftar <em>keinginan.</em></> })[activeNav]}</h1></div>{activeNav !== "wishlist" && <button className="primary-button" onClick={() => { setKind("expense"); setShowForm(true); }}><span>＋</span> Tambah transaksi</button>}</div>
          {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")}>Tutup</button></div>}

          {activeNav === "overview" && <>
          <div className="period-row"><span className="section-kicker">RINGKASAN KEUANGAN</span><div className="period-tabs" aria-label="Periode ringkasan"><button className={period === "month" ? "selected" : ""} onClick={() => setPeriod("month")}>Bulan ini</button><button className={period === "year" ? "selected" : ""} onClick={() => setPeriod("year")}>Tahun ini</button><button className={period === "all" ? "selected" : ""} onClick={() => setPeriod("all")}>Semua</button></div></div>
          <section className="stats-grid" aria-label="Ringkasan saldo">
            <article className="stat-card balance-card"><div className="stat-top"><span>Total saldo semua wallet</span><span className="stat-symbol">↗</span></div><div className="stat-value">{ready ? rupiah(totalBalance) : "Memuat..."}</div><div className="stat-foot"><span className="balance-dot" /> {selectedBalanceWalletIds.length === wallets.length ? "Gabungan saldo seluruh wallet" : `Menghitung ${selectedBalanceWalletIds.length} dari ${wallets.length} wallet`}</div>
              <button type="button" className="balance-filter-trigger" aria-expanded={showBalanceFilter} onClick={() => setShowBalanceFilter((visible) => !visible)}>{showBalanceFilter ? "Tutup filter wallet" : "Atur wallet yang dihitung"}</button>
              {showBalanceFilter && <div className="balance-filter-panel">
                <div className="balance-filter-heading"><strong>Pilih wallet untuk total saldo</strong><button type="button" className="balance-filter-select-all" onClick={toggleAllBalanceFilterWallets}>{selectedBalanceWalletIds.length === wallets.length ? "Kosongkan" : "Pilih semua"}</button></div>
                {wallets.length === 0 ? <p className="expense-widget-empty">Belum ada wallet yang bisa dipilih.</p> : wallets.map((wallet) => <label className="balance-filter-option" key={wallet.id}><input type="checkbox" checked={selectedBalanceWalletIds.includes(wallet.id)} onChange={() => toggleBalanceFilterWallet(wallet.id)} /><span>{wallet.name}</span></label>)}
              </div>}
              <div className="balance-decoration">CAESH</div></article>
            <article className="stat-card"><div className="stat-top"><span>Total pemasukan</span><span className="stat-icon income-icon">↙</span></div><div className="stat-value">{ready ? rupiah(totals.income) : "Memuat..."}</div><div className="stat-foot">Uang yang masuk pada periode ini</div></article>
            <article className="stat-card"><div className="stat-top"><span>Total pengeluaran</span><span className="stat-icon expense-icon">↗</span></div><div className="stat-value">{ready ? rupiah(totals.expense) : "Memuat..."}</div><div className="stat-foot">Uang yang digunakan pada periode ini</div></article>
          </section>
          <section className="panel-card expense-widget" aria-label="Widget hitung pengeluaran">
            <div className="panel-heading expense-widget-heading">
              <div><div className="section-kicker">WIDGET PENGELUARAN</div><h2>Total pengeluaran</h2><p className="expense-widget-range">{expenseWidgetRangeLabel}</p></div>
              <button type="button" className="text-button" aria-expanded={showExpenseWidgetSettings} onClick={() => setShowExpenseWidgetSettings((visible) => !visible)}>{showExpenseWidgetSettings ? "Tutup pengaturan" : "Atur widget"}</button>
            </div>
            <div className="expense-widget-total"><strong>{ready ? rupiah(expenseWidgetSummary.total) : "Memuat..."}</strong><span>{expenseWidgetSummary.count} transaksi pengeluaran</span></div>
            {showExpenseWidgetSettings && <div className="expense-widget-settings">
              <div className="expense-widget-setting-block"><label className="field-label" htmlFor="expense-widget-period">Periode pengeluaran</label><select id="expense-widget-period" value={expenseWidgetSettings.period} onChange={(event) => setExpenseWidgetSettings((settings) => ({ ...settings, period: event.target.value as ExpenseWidgetPeriod }))}><option value="daily">Harian</option><option value="weekly">Mingguan</option><option value="monthly">Bulanan</option><option value="custom">Rentang tanggal sendiri</option></select></div>
              {expenseWidgetSettings.period === "custom" && <div className="expense-widget-date-grid"><div><label className="field-label" htmlFor="expense-widget-start">Dari tanggal</label><input id="expense-widget-start" type="date" value={expenseWidgetSettings.startDate} max={expenseWidgetSettings.endDate || undefined} onChange={(event) => setExpenseWidgetSettings((settings) => ({ ...settings, startDate: event.target.value }))} /></div><div><label className="field-label" htmlFor="expense-widget-end">Sampai tanggal</label><input id="expense-widget-end" type="date" value={expenseWidgetSettings.endDate} min={expenseWidgetSettings.startDate || undefined} onChange={(event) => setExpenseWidgetSettings((settings) => ({ ...settings, endDate: event.target.value }))} /></div></div>}
              <div className="expense-widget-wallets"><span className="field-label">Hitung dari wallet</span>
                {wallets.length === 0 ? <p className="expense-widget-empty">Belum ada wallet yang bisa dipilih.</p> : wallets.map((wallet) => <label className="expense-widget-wallet-option" key={wallet.id}><input type="checkbox" checked={expenseWidgetWalletIds.includes(wallet.id)} onChange={() => toggleExpenseWidgetWallet(wallet.id)} /><span>{wallet.name}</span></label>)}
                <button type="button" className="text-button expense-widget-select-all" onClick={() => setExpenseWidgetSettings((settings) => ({ ...settings, walletIds: settings.walletIds === null || settings.walletIds.length === wallets.length ? [] : wallets.map((wallet) => wallet.id) }))}>{expenseWidgetWalletIds.length === wallets.length ? "Kosongkan pilihan" : "Pilih semua wallet"}</button>
              </div>
            </div>}
          </section>
          <section className="overview-wallet-panel" aria-label="Wallet">
            <div className="overview-wallet-heading"><div><span className="section-kicker">TEMPAT PENYIMPANAN UANG</span><strong>Wallet kamu</strong></div><button type="button" aria-label="Tambah wallet" onClick={() => setShowWalletForm(true)}>＋</button></div>
            <div className="overview-wallet-list">
              {walletBalances.map((wallet) => <article className={`overview-wallet-item${wallet.photo ? " has-photo" : ""}`} key={wallet.id} role="button" tabIndex={0} aria-label={`Lihat detail wallet ${wallet.name}`} onClick={() => { setDetailWalletId(wallet.id); setDetailWalletNote(wallet.note ?? ""); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setDetailWalletId(wallet.id); setDetailWalletNote(wallet.note ?? ""); } }}>{wallet.photo && <img className="wallet-card-photo" src={wallet.photo} alt="" style={{ objectPosition: `${wallet.photoX ?? 50}% ${wallet.photoY ?? 50}%`, transform: `scale(${wallet.photoZoom ?? 1.15})` }} />}<div className="overview-wallet-item-top"><strong className="wallet-name">{wallet.name}</strong><button type="button" className="wallet-delete-button" aria-label={`Hapus wallet ${wallet.name}`} title="Hapus wallet" onClick={(event) => { event.stopPropagation(); handleWalletDelete(wallet.id); }}>×</button></div><div className="overview-wallet-bottom"><div className="wallet-balance">{ready ? wallet.category === "notes" ? rupiah(Math.abs(wallet.balance)) : rupiah(wallet.balance) : "Memuat..."}</div><div className="wallet-start">{wallet.category === "notes" ? wallet.debtDirection === "lent" ? "Piutang · belum lunas" : "Utang · belum lunas" : `Saldo awal ${rupiah(wallet.initialBalance)}`}</div></div><button type="button" className="wallet-photo-button" aria-label={`Atur foto wallet ${wallet.name}`} title="Atur foto wallet" onClick={(event) => { event.stopPropagation(); openWalletPhotoEditor(wallet.id); }}><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/><path d="M19 16v6M16 19h6"/></svg></button></article>)}
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
            <div className="transaction-tools"><input aria-label="Cari transaksi" type="search" placeholder="Cari catatan, kategori, atau wallet..." value={transactionSearch} onChange={(event) => setTransactionSearch(event.target.value)} /><select aria-label="Filter jenis transaksi" value={transactionFilter} onChange={(event) => setTransactionFilter(event.target.value as "all" | TransactionKind | "debt")}><option value="all">Semua jenis</option><option value="income">Pemasukan</option><option value="expense">Pengeluaran</option><option value="transfer">Transfer</option><option value="debt">Utang</option></select></div>
            {!ready ? <div className="empty-state">Memuat data lokal...</div> : visibleTransactions.length === 0 ? <div className="empty-state"><strong>Tidak ada transaksi ditemukan</strong><p>Coba ubah kata pencarian atau filter yang dipilih.</p></div> : <div className="transaction-list">{visibleTransactions.map((item) => <div className="transaction-row" key={item.id}><div className={`transaction-icon ${item.kind}`}>{item.kind === "income" ? "↙" : item.kind === "expense" ? "↗" : "⇄"}</div><div className="transaction-info"><strong>{item.note || item.category}</strong><span>{item.kind === "transfer" ? `${walletName(item.walletId)} → ${walletName(item.toWalletId ?? "")}` : `${item.category} · ${walletName(item.walletId)}`} · {new Date(item.date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span></div><div className={`transaction-amount ${item.kind}`}>{item.kind === "income" ? "+" : item.kind === "expense" ? "−" : "⇄"}{rupiah(item.amount)}</div><button className="delete-button" aria-label="Hapus transaksi" onClick={() => handleDelete(item.id)}>×</button></div>)}</div>}
          </section>}

          {activeNav === "wishlist" && <section className="page-section wishlist-page">
            <div className="wishlist-toolbar panel-card">
              <div><div className="section-kicker">DAFTAR KEINGINAN</div><h2>Wishlist kamu</h2></div>
              <button className="primary-button" onClick={() => setShowWishlistForm(true)}>＋ Tambah wishlist</button>
            </div>
            <div className="kind-switch wishlist-tabs">
              <button type="button" className={wishlistTab === "pending" ? "active" : ""} onClick={() => setWishlistTab("pending")}>Belum dibeli ({wishlist.filter((item) => item.status === "pending").length})</button>
              <button type="button" className={wishlistTab === "purchased" ? "active" : ""} onClick={() => setWishlistTab("purchased")}>Sudah dibeli ({wishlist.filter((item) => item.status === "purchased").length})</button>
            </div>
            {wishlist.filter((item) => item.status === wishlistTab).length === 0
              ? <article className="panel-card empty-state"><div className="empty-art">♡</div><strong>{wishlistTab === "pending" ? "Belum ada wishlist" : "Belum ada barang yang dibeli"}</strong><p>{wishlistTab === "pending" ? "Tambahkan barang yang ingin kamu beli nanti." : "Barang yang sudah dibeli dari wishlist akan muncul di sini."}</p>{wishlistTab === "pending" && <button className="outline-button" onClick={() => setShowWishlistForm(true)}>Tambah wishlist pertama</button>}</article>
              : <div className="wishlist-grid">{wishlist.filter((item) => item.status === wishlistTab).map((item) => <article className="panel-card wishlist-item" key={item.id}>
                  <div className="wishlist-item-main"><strong>{item.name}</strong><span>{item.status === "purchased" ? `Dibeli · ${new Date(item.purchasedAt ?? item.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}` : `Ditambahkan · ${new Date(item.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`}</span></div>
                  {item.status === "purchased" ? <div className="wishlist-purchase-detail"><strong>{rupiah(item.purchaseAmount ?? 0)}</strong><span>{walletName(item.walletId ?? "")}</span></div> : <button className="primary-button" onClick={() => { setPurchaseTarget(item); setPurchaseWalletId(wallets[0]?.id ?? ""); setPurchaseAmount(""); }}>Beli</button>}
                  <button type="button" className="delete-button" aria-label={`Hapus ${item.name} dari wishlist`} onClick={() => handleWishlistDelete(item)}>×</button>
                </article>)}</div>}
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

      {debtAction && debtTargetWalletId && (() => {
        const target = wallets.find((wallet) => wallet.id === debtTargetWalletId);
        if (!target || target.category !== "notes") return null;
        const outstanding = Math.abs(walletBalances.find((wallet) => wallet.id === target.id)?.balance ?? 0);
        return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !debtSaving) setDebtAction(null); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="debt-action-title"><div className="modal-heading"><div><div className="section-kicker">{debtAction === "add" ? "TAMBAH CATATAN UTANG" : "CATAT PEMBAYARAN"}</div><h2 id="debt-action-title">{target.name}</h2></div><button className="modal-close" onClick={() => setDebtAction(null)} aria-label="Tutup" disabled={debtSaving}>×</button></div><p className="wallet-form-hint">Sisa utang saat ini: <strong>{rupiah(outstanding)}</strong></p><form onSubmit={handleDebtSubmit}><label className="field-label" htmlFor="debt-action-amount">Nominal (Rp)</label><div className="currency-input-wrap"><span>Rp</span><input id="debt-action-amount" className="amount-input" inputMode="numeric" type="text" placeholder="0" value={debtAmount} onChange={(event) => setDebtAmount(formatRupiahInput(event.target.value))} required /></div><label className="field-label" htmlFor="debt-action-wallet">{target.debtDirection === "lent" ? debtAction === "add" ? "Ambil uang dari wallet" : "Uang pembayaran masuk ke wallet" : debtAction === "add" ? "Masukkan uang ke wallet" : "Bayar menggunakan wallet"}</label><select id="debt-action-wallet" value={debtCashWalletId} onChange={(event) => setDebtCashWalletId(event.target.value)} required><option value="">Pilih wallet</option>{regularWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} — {rupiah(walletBalances.find((item) => item.id === wallet.id)?.balance ?? 0)}</option>)}</select><p className="wallet-form-hint">{debtAction === "payment" && debtAmount && parseRupiahInput(debtAmount) === outstanding ? "Pembayaran ini akan melunasi utang dan Notes akan otomatis hilang dari daftar wallet. Riwayat tetap tersimpan." : debtAction === "payment" ? "Pembayaran sebagian akan mengurangi sisa utang. Pembayaran penuh akan menutup Notes." : "Nominal akan ditambahkan ke catatan utang yang masih aktif."}</p><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setDebtAction(null)} disabled={debtSaving}>Batal</button><button type="submit" className="primary-button" disabled={debtSaving}>{debtSaving ? "Menyimpan..." : debtAction === "payment" ? "Simpan pembayaran" : "Tambah utang"}</button></div></form></section></div>;
      })()}
      {showWishlistForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowWishlistForm(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="wishlist-modal-title"><div className="modal-heading"><div><div className="section-kicker">WISHLIST BARU</div><h2 id="wishlist-modal-title">Tambah wishlist</h2></div><button className="modal-close" onClick={() => setShowWishlistForm(false)} aria-label="Tutup">×</button></div><form onSubmit={handleWishlistCreate}><label className="field-label" htmlFor="wishlist-name">Nama wishlist</label><input id="wishlist-name" type="text" maxLength={80} placeholder="Contoh: Headphone baru" value={newWishlistName} onChange={(event) => setNewWishlistName(event.target.value)} required /><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setShowWishlistForm(false)}>Batal</button><button type="submit" className="primary-button">Simpan wishlist</button></div></form></section></div>}

      {purchaseTarget && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPurchaseTarget(null); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="wishlist-purchase-title"><div className="modal-heading"><div><div className="section-kicker">KONFIRMASI PEMBELIAN</div><h2 id="wishlist-purchase-title">{purchaseTarget.name}</h2></div><button className="modal-close" onClick={() => setPurchaseTarget(null)} aria-label="Tutup">×</button></div><form onSubmit={handleWishlistPurchase}><label className="field-label" htmlFor="wishlist-price">Harga pembelian (Rp)</label><div className="currency-input-wrap"><span>Rp</span><input id="wishlist-price" className="amount-input" inputMode="numeric" type="text" placeholder="0" value={purchaseAmount} onChange={(event) => setPurchaseAmount(formatRupiahInput(event.target.value))} required /></div><label className="field-label" htmlFor="wishlist-wallet">Bayar menggunakan wallet</label><select id="wishlist-wallet" value={purchaseWalletId} onChange={(event) => setPurchaseWalletId(event.target.value)} required>{walletBalances.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} — {rupiah(wallet.balance)}</option>)}</select><p className="wallet-form-hint">Saldo wallet akan dipotong dan transaksi pengeluaran akan tercatat otomatis.</p><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setPurchaseTarget(null)}>Batal</button><button type="submit" className="primary-button">Konfirmasi pembelian</button></div></form></section></div>}

      <input ref={photoPickerRef} className="visually-hidden-file" type="file" accept="image/*" onChange={handlePhotoFileChange} />

      {showPhotoEditor && <div className="modal-backdrop photo-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPhotoEditor(false); }}><section className="modal-card photo-editor-card" role="dialog" aria-modal="true" aria-labelledby="photo-editor-title"><div className="modal-heading"><div><div className="section-kicker">ATUR FOTO WALLET</div><h2 id="photo-editor-title">Sesuaikan foto</h2></div><button className="modal-close" onClick={() => setShowPhotoEditor(false)} aria-label="Tutup">×</button></div>
        {pendingPhoto ? <div className="photo-crop-preview"><img src={pendingPhoto} alt="Pratinjau foto wallet" style={{ objectPosition: `${photoX}% ${photoY}%`, transform: `scale(${photoZoom})` }} /></div> : <div className="photo-empty-preview"><span>▧</span><strong>Belum ada foto</strong><p>Pilih foto dari galeri atau perangkatmu.</p></div>}
        <button type="button" className="outline-button photo-choose-button" onClick={() => photoPickerRef.current?.click()}>{pendingPhoto ? "Pilih foto lain" : "Pilih foto"}</button>
        {pendingPhoto && <div className="photo-adjustments"><label>Geser horizontal <input className="photo-range" type="range" min="0" max="100" value={photoX} onChange={(event) => setPhotoX(Number(event.target.value))} /></label><label>Geser vertikal <input className="photo-range" type="range" min="0" max="100" value={photoY} onChange={(event) => setPhotoY(Number(event.target.value))} /></label><label>Zoom <input className="photo-range" type="range" min="1" max="2.5" step="0.05" value={photoZoom} onChange={(event) => setPhotoZoom(Number(event.target.value))} /></label></div>}
        <div className="modal-actions">{pendingPhoto && <button type="button" className="cancel-button" onClick={() => setPendingPhoto("")}>Hapus foto</button>}<button type="button" className="cancel-button" onClick={() => setShowPhotoEditor(false)}>Batal</button><button type="button" className="primary-button" onClick={handlePhotoSave}>Simpan foto</button></div>
      </section></div>}
      {availableUpdate && <div className="modal-backdrop update-backdrop" role="presentation"><section className="modal-card update-modal" role="dialog" aria-modal="true" aria-labelledby="update-modal-title"><div className="update-mark" aria-hidden="true">↻</div><div className="section-kicker">PEMBARUAN CAESH</div><h2 id="update-modal-title">Update CAESH tersedia</h2><p>Versi baru <strong>{availableUpdate.version}</strong> sudah tersedia. Lu bisa update sekarang atau nanti.</p>{availableUpdate.notes && <div className="update-notes">{availableUpdate.notes}</div>}{updateDownloadProgress !== null && <div className="update-progress"><div className="update-progress-label"><span>{downloadedUpdatePath ? "APK berhasil diunduh" : "Mengunduh pembaruan..."}</span><strong>{updateDownloadProgress}%</strong></div><div className="update-progress-track"><span style={{ width: `${updateDownloadProgress}%` }} /></div></div>}{updateError && <div className="update-error">{updateError}</div>}<div className="modal-actions update-actions"><button type="button" className="cancel-button" onClick={() => setAvailableUpdate(null)} disabled={updateLoading}>Nanti saja</button><button type="button" className="primary-button" onClick={downloadAndInstallUpdate} disabled={updateLoading}>{updateLoading ? "Memproses..." : downloadedUpdatePath ? "Pasang update" : "Download & update"}</button></div><small>Data CAESH tetap tersimpan selama pembaruan dipasang sebagai update dengan tanda tangan yang sama.</small></section></div>}

      {detailWallet && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !detailWalletSaving) setDetailWalletId(null); }}><section className="modal-card wallet-detail-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-detail-title"><div className="modal-heading"><div><div className="section-kicker">INFORMASI WALLET</div><h2 id="wallet-detail-title">{detailWallet.name}</h2></div><button className="modal-close" onClick={() => setDetailWalletId(null)} aria-label="Tutup detail wallet" disabled={detailWalletSaving}>×</button></div>
        <div className="wallet-detail-balance"><span>{detailWallet.category === "notes" ? "Sisa utang" : "Saldo saat ini"}</span><strong>{rupiah(detailWallet.category === "notes" ? Math.abs(detailWalletBalance) : detailWalletBalance)}</strong></div>
        {detailWallet.category === "notes" ? <div className="debt-detail-actions"><p>{detailWallet.debtDirection === "lent" ? "Orang ini masih berutang ke lu." : "Lu masih punya utang ke orang ini."}</p><div className="modal-actions"><button type="button" className="outline-button" onClick={() => openDebtAction(detailWallet, "add")}>＋ Tambah utang</button><button type="button" className="primary-button" onClick={() => openDebtAction(detailWallet, "payment")}>Bayar</button></div></div> : <div className="wallet-detail-totals"><div><span>Total pemasukan</span><strong className="income">{rupiah(detailWalletIncome)}</strong></div><div><span>Total pengeluaran</span><strong className="expense">{rupiah(detailWalletExpense)}</strong></div></div>}
        <div className="wallet-detail-history"><div className="panel-heading"><h3>Riwayat wallet</h3><span className="result-count">{detailWalletTransactions.length} transaksi</span></div>
          {detailWalletTransactions.length === 0 ? <div className="empty-state">Belum ada riwayat transaksi untuk wallet ini.</div> : <div className="transaction-list">{detailWalletTransactions.map((item) => { const incomingTransfer = item.kind === "transfer" && item.toWalletId === detailWallet.id; const outgoingTransfer = item.kind === "transfer" && item.walletId === detailWallet.id; const title = item.note || item.category || (item.kind === "transfer" ? "Transfer" : "Transaksi"); const amountPrefix = item.kind === "income" || incomingTransfer ? "+" : item.kind === "expense" || outgoingTransfer ? "−" : ""; const relatedWallet = incomingTransfer ? item.walletName ?? walletName(item.walletId) : outgoingTransfer ? item.toWalletName ?? walletName(item.toWalletId ?? "") : ""; return <div className="transaction-row" key={item.id}><div className={`transaction-icon ${item.kind}`}>{item.kind === "income" ? "↙" : item.kind === "expense" ? "↗" : "⇄"}</div><div className="transaction-info"><strong>{title}</strong><span>{item.kind === "transfer" ? `${incomingTransfer ? "Dari" : "Ke"} ${relatedWallet}` : item.category} · {new Date(item.date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span></div><div className={`transaction-amount ${item.kind}`}>{amountPrefix}{rupiah(item.amount)}</div></div>; })}</div>}
        </div>
        {detailWallet.category !== "notes" && <div className="wallet-detail-note"><label className="field-label" htmlFor="wallet-detail-note-input">Catatan khusus wallet</label><textarea id="wallet-detail-note-input" rows={3} maxLength={500} placeholder="Tambahkan catatan tentang wallet ini..." value={detailWalletNote} onChange={(event) => setDetailWalletNote(event.target.value)} disabled={detailWalletSaving} /><div className="wallet-detail-note-footer"><span>{detailWalletNote.length}/500 karakter</span><button type="button" className="primary-button" onClick={saveDetailWalletNote} disabled={detailWalletSaving}>{detailWalletSaving ? "Menyimpan..." : "Simpan catatan"}</button></div></div>}
      </section></div>}
      {showWalletForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowWalletForm(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="wallet-modal-title"><div className="modal-heading"><div><div className="section-kicker">WALLET BARU</div><h2 id="wallet-modal-title">Tambah wallet</h2></div><button className="modal-close" onClick={() => setShowWalletForm(false)} aria-label="Tutup">×</button></div>
        <form onSubmit={handleWalletSubmit}><label className="field-label" htmlFor="wallet-name">Nama wallet / orang</label><input id="wallet-name" type="text" maxLength={32} placeholder="Contoh: BCA, Cash, DANA atau Andi" value={newWalletName} onChange={(event) => setNewWalletName(event.target.value)} required />
          <label className="field-label" htmlFor="wallet-category">Kategori wallet</label><select id="wallet-category" value={newWalletCategory} onChange={(event) => setNewWalletCategory(event.target.value as "standard" | "notes")}><option value="standard">Wallet biasa</option><option value="notes">Notes (utang)</option></select>
          {newWalletCategory === "notes" && <div className="debt-create-fields"><label className="field-label" htmlFor="new-debt-direction">Jenis utang</label><select id="new-debt-direction" value={newDebtDirection} onChange={(event) => setNewDebtDirection(event.target.value as DebtDirection)}><option value="lent">Gw memberikan utang</option><option value="borrowed">Gw menerima utang</option></select><label className="field-label" htmlFor="new-debt-amount">Nominal utang (Rp)</label><div className="currency-input-wrap"><span>Rp</span><input id="new-debt-amount" className="amount-input" inputMode="numeric" type="text" placeholder="0" value={newDebtAmount} onChange={(event) => setNewDebtAmount(formatRupiahInput(event.target.value))} required /></div><label className="field-label" htmlFor="new-debt-wallet">{newDebtDirection === "lent" ? "Ambil uang dari wallet" : "Masukkan uang ke wallet"}</label><select id="new-debt-wallet" value={newDebtCashWalletId} onChange={(event) => setNewDebtCashWalletId(event.target.value)} required><option value="">Pilih wallet</option>{regularWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} — {rupiah(walletBalances.find((item) => item.id === wallet.id)?.balance ?? 0)}</option>)}</select><p className="wallet-form-hint">{newDebtDirection === "lent" ? "Saldo wallet yang dipilih akan berkurang dan menjadi piutang di Notes." : "Saldo wallet yang dipilih akan bertambah dan utang akan tercatat di Notes."}</p></div>}
          <div className="wallet-photo-picker-row"><div><strong>Foto wallet</strong><span>{newWalletPhoto ? "Foto sudah dipilih" : "Opsional · JPG, PNG, atau WebP"}</span></div><button type="button" className="outline-button" onClick={() => { setPhotoTargetWalletId(null); photoPickerRef.current?.click(); }}>{newWalletPhoto ? "Ganti foto" : "Upload foto"}</button></div>
          {newWalletPhoto && <div className="wallet-photo-mini"><img src={newWalletPhoto} alt="Pratinjau foto wallet" style={{ objectPosition: `${newWalletPhotoX}% ${newWalletPhotoY}%`, transform: `scale(${newWalletPhotoZoom})` }} /><button type="button" className="text-button" onClick={() => openWalletPhotoEditor()}>Atur posisi foto</button><button type="button" className="text-button" onClick={() => setNewWalletPhoto("")}>Hapus foto</button></div>}
          {newWalletCategory === "standard" && <><label className="field-label" htmlFor="wallet-balance">Saldo pertama kali (Rp)</label><div className="currency-input-wrap"><span>Rp</span><input id="wallet-balance" className="amount-input" inputMode="numeric" type="text" placeholder="0" value={newWalletBalance} onChange={(event) => setNewWalletBalance(formatRupiahInput(event.target.value))} required /></div><p className="wallet-form-hint">Saldo ini menjadi saldo awal wallet. Transaksi berikutnya akan menambah atau menguranginya secara otomatis.</p></>}
          <div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setShowWalletForm(false)}>Batal</button><button type="submit" className="primary-button">Simpan wallet</button></div>
        </form></section></div>}
    </main>
  );
}
