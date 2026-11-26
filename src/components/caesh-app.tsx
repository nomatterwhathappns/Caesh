"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { App } from "@capacitor/app";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import { AppInstallPlugin } from "../lib/app-install-plugin";
import { calculateExpenseSummary, getExpenseDateRange, getExpensePeriodKey, isExpenseLimitExceeded, normalizeExpenseWidgetSettings, DEFAULT_EXPENSE_WIDGET_SETTINGS, ExpenseWidgetPeriod, ExpenseWidgetSettings } from "@/lib/expense-widget";
import { ExpenseWidgetPlugin } from "@/lib/expense-widget-plugin";
import {
  createDebtNote, recordDebtMovement, cleanupClosedDebtNotes, getTransactions, getWallets, removeTransaction, removeWallet, settleDebtNote, saveTransaction, saveWallet,
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
type CaeshReleaseNote = { version: string; notes: string };
type CaeshUpdate = { version: string; apkUrl: string; sha256: string; notes?: string; releases: CaeshReleaseNote[] };
const UPDATE_MANIFEST_URL = "https://github.com/nomatterwhathappns/Caesh/releases/download/caesh-update/update.json";
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
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
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
  const [expenseWidgetSettings, setExpenseWidgetSettings] = useState<ExpenseWidgetSettings>({ ...DEFAULT_EXPENSE_WIDGET_SETTINGS });
  const [expenseWidgetInstalled, setExpenseWidgetInstalled] = useState(false);
  const [widgetImageTarget, setWidgetImageTarget] = useState<"baseImage" | "beforeImage" | "afterImage" | null>(null);
  const [widgetImagePositionTarget, setWidgetImagePositionTarget] = useState<"baseImage" | "beforeImage" | "afterImage" | null>(null);
  const widgetImagePickerRef = useRef<HTMLInputElement>(null);
  const [expenseWidgetSettingsLoaded, setExpenseWidgetSettingsLoaded] = useState(false);
  const [showExpenseWidgetSettings, setShowExpenseWidgetSettings] = useState(false);
  const [balanceFilterWalletIds, setBalanceFilterWalletIds] = useState<string[] | null>(null);
  const [balanceFilterLoaded, setBalanceFilterLoaded] = useState(false);
  const [showBalanceFilter, setShowBalanceFilter] = useState(false);
  const [summaryNominalsHidden, setSummaryNominalsHidden] = useState(false);
  const [summaryPrivacyLoaded, setSummaryPrivacyLoaded] = useState(false);
  const [hiddenWalletNominals, setHiddenWalletNominals] = useState<string[]>([]);
  const [walletPrivacyLoaded, setWalletPrivacyLoaded] = useState(false);
  const [walletSettingsOpenId, setWalletSettingsOpenId] = useState<string | null>(null);
  const [deleteTransactionTarget, setDeleteTransactionTarget] = useState<Transaction | null>(null);
  const [settleDebtTarget, setSettleDebtTarget] = useState<Wallet | null>(null);
  const [deleteWishlistTarget, setDeleteWishlistTarget] = useState<WishlistItem | null>(null);
  const [walletDeleteTarget, setWalletDeleteTarget] = useState<Wallet | null>(null);
  const [categoryDeleteConfirmOpen, setCategoryDeleteConfirmOpen] = useState(false);

  const hasOpenModal = Boolean(
    showForm || showWalletForm || showWishlistForm || purchaseTarget || showPhotoEditor || showExpenseWidgetSettings ||
    debtAction || detailWalletId || availableUpdate || settleDebtTarget || deleteWishlistTarget || walletDeleteTarget || categoryDeleteConfirmOpen
  );

  useEffect(() => {
    if (!hasOpenModal) return;
    document.documentElement.classList.add("caesh-modal-open");
    document.body.classList.add("caesh-modal-open");
    return () => {
      document.documentElement.classList.remove("caesh-modal-open");
      document.body.classList.remove("caesh-modal-open");
    };
  }, [hasOpenModal]);

  useEffect(() => {
    if (!walletSettingsOpenId) return;
    const closeIfOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".wallet-settings-trigger, .wallet-settings-menu")) return;
      setWalletSettingsOpenId(null);
    };
    const closeOnScroll = () => setWalletSettingsOpenId(null);
    document.addEventListener("pointerdown", closeIfOutside, true);
    document.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside, true);
      document.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [walletSettingsOpenId]);

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
      setSummaryNominalsHidden(window.localStorage.getItem("caesh-summary-nominals-hidden") === "true");
    } catch { /* Keep nominal visibility enabled if preferences cannot be read. */ }
    setSummaryPrivacyLoaded(true);
    try {
      const rawHiddenWallets = window.localStorage.getItem("caesh-hidden-wallet-nominals");
      if (rawHiddenWallets) {
        const parsed: unknown = JSON.parse(rawHiddenWallets);
        if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) setHiddenWalletNominals(parsed);
      }
    } catch { /* Keep all wallet amounts visible if preferences cannot be read. */ }
    setWalletPrivacyLoaded(true);
  }, []);

  useEffect(() => {
    try {
      const rawWidgetSettings = window.localStorage.getItem("caesh-expense-widget");
      if (rawWidgetSettings) setExpenseWidgetSettings(normalizeExpenseWidgetSettings(JSON.parse(rawWidgetSettings)));
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
    cleanupClosedDebtNotes()
      .then(() => Promise.all([getTransactions(), getWallets(), getWishlist()]))
      .then(([savedTransactions, savedWallets, savedWishlist]) => {
        setTransactions(savedTransactions);
        setWallets(savedWallets);
        setWishlist(savedWishlist);
        setWalletId(savedWallets.find((wallet) => wallet.category !== "notes")?.id ?? "");
        setToWalletId(savedWallets.filter((wallet) => wallet.category !== "notes")[1]?.id ?? "");
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
        if (cancelled || typeof manifest.version !== "string" || typeof manifest.apkUrl !== "string" || typeof manifest.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(manifest.sha256)) return;
        const latestVersion = manifest.version;
        const expectedApkUrl = `https://github.com/nomatterwhathappns/Caesh/releases/download/caesh-v${latestVersion}/Caesh.apk`;
        if (manifest.apkUrl !== expectedApkUrl) return;
        if (compareVersions(latestVersion, appInfo.version) > 0) {
          const releaseHistory = Array.isArray(manifest.releases)
            ? manifest.releases.filter((release): release is CaeshReleaseNote =>
                !!release &&
                typeof release.version === "string" &&
                /^\d+(?:\.\d+){1,2}$/.test(release.version) &&
                typeof release.notes === "string" &&
                release.notes.trim().length > 0 &&
                compareVersions(release.version, appInfo.version) > 0 &&
                compareVersions(release.version, latestVersion) <= 0
              )
            : [];
          const releases = releaseHistory.length > 0
            ? [...releaseHistory].sort((left, right) => compareVersions(left.version, right.version))
            : [{ version: latestVersion, notes: typeof manifest.notes === "string" ? manifest.notes : "Pembaruan CAESH tersedia." }];
          setAvailableUpdate({
            version: latestVersion,
            apkUrl: manifest.apkUrl,
            sha256: manifest.sha256.toLowerCase(),
            notes: typeof manifest.notes === "string" ? manifest.notes : undefined,
            releases,
          });
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

      if (!apkPath) throw new Error("File APK pembaruan tidak ditemukan.");

      let verification: { valid: boolean; actualSha256: string };
      try {
        verification = await AppInstallPlugin.verifyApkSha256({
          filePath: apkPath,
          expectedSha256: availableUpdate.sha256,
        });
      } catch {
        try {
          await Filesystem.deleteFile({ directory: Directory.Cache, path: "caesh-update.apk" });
        } catch { /* The cache file may already have been removed. */ }
        setDownloadedUpdatePath(null);
        setUpdateDownloadProgress(null);
        throw new Error("APK tidak dapat diverifikasi. File dihapus; silakan unduh ulang pembaruan.");
      }
      if (!verification.valid) {
        try {
          await Filesystem.deleteFile({ directory: Directory.Cache, path: "caesh-update.apk" });
        } catch { /* The cache file may already have been removed. */ }
        setDownloadedUpdatePath(null);
        setUpdateDownloadProgress(null);
        throw new Error("Verifikasi SHA-256 gagal. APK tidak akan dipasang. File dihapus; silakan unduh ulang pembaruan.");
      }

      const permission = await AppInstallPlugin.canInstallUnknownApps();
      if (!permission.granted) {
        await AppInstallPlugin.openInstallUnknownAppsSettings();
        setUpdateError("Aktifkan izin instalasi untuk CAESH, lalu kembali ke sini dan tekan Pasang update.");
        return;
      }

      const result = await AppInstallPlugin.installApk({ filePath: apkPath });
      if (!result.completed) throw new Error(result.message || "Installer Android tidak dapat dibuka.");
    } catch (reason) {
      setUpdateError(reason instanceof Error ? reason.message : "Pembaruan gagal diunduh atau dipasang. Coba lagi.");
    } finally {
      setUpdateLoading(false);
    }
  }

  useEffect(() => {
    if (!summaryPrivacyLoaded) return;
    window.localStorage.setItem("caesh-summary-nominals-hidden", String(summaryNominalsHidden));
  }, [summaryNominalsHidden, summaryPrivacyLoaded]);

  useEffect(() => {
    if (!walletPrivacyLoaded || !ready) return;
    const activeIds = hiddenWalletNominals.filter((id) => wallets.some((wallet) => wallet.id === id && wallet.category !== "notes"));
    if (activeIds.length !== hiddenWalletNominals.length) setHiddenWalletNominals(activeIds);
    window.localStorage.setItem("caesh-hidden-wallet-nominals", JSON.stringify(activeIds));
  }, [hiddenWalletNominals, walletPrivacyLoaded, wallets]);

  useEffect(() => {
    if (!balanceFilterLoaded) return;
    window.localStorage.setItem("caesh-balance-wallet-filter", JSON.stringify(balanceFilterWalletIds));
  }, [balanceFilterWalletIds, balanceFilterLoaded]);

  useEffect(() => {
    if (!expenseWidgetSettingsLoaded) return;
    window.localStorage.setItem("caesh-expense-widget", JSON.stringify(expenseWidgetSettings));
  }, [expenseWidgetSettings, expenseWidgetSettingsLoaded]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    ExpenseWidgetPlugin.getExpenseWidgetStatus()
      .then((status) => { if (active) setExpenseWidgetInstalled(status.installed); })
      .catch((reason: unknown) => console.warn("CAESH widget status unavailable.", reason));
    return () => { active = false; };
  }, []);


  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("caesh-theme", theme);
    const statusBarColor = theme === "dark" ? "#302226" : "#FAF5EF";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", statusBarColor);
    if (Capacitor.isNativePlatform()) {
      document.documentElement.classList.add("caesh-native");
      void Promise.all([
        StatusBar.setOverlaysWebView({ overlay: true }),
        // Capacitor: Style.Dark = light icons; Style.Light = dark icons.
        StatusBar.setStyle({ style: theme === "dark" ? Style.Dark : Style.Light }),
        StatusBar.getInfo().then(({ height }) => {
          if (Number.isFinite(height) && height > 0) {
            document.documentElement.style.setProperty("--caesh-statusbar-height", `${height}px`);
          }
        }),
      ]).catch((reason: unknown) => console.warn("CAESH status bar could not be synchronized.", reason));
    }
  }, [theme]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    let removeListener: (() => void) | undefined;

    void App.addListener("backButton", () => {
      if (updateLoading) return;

      if (showWalletForm) {
        setShowWalletForm(false);
      } else if (showPhotoEditor) {
        setShowPhotoEditor(false);
      } else if (purchaseTarget) {
        setPurchaseTarget(null);
      } else if (showWishlistForm) {
        setShowWishlistForm(false);
      } else if (debtAction) {
        setDebtAction(null);
        setDebtTargetWalletId(null);
      } else if (showForm) {
        closeTransactionForm();
      } else if (availableUpdate) {
        setAvailableUpdate(null);
      } else if (detailWalletId) {
        setDetailWalletId(null);
        setDetailWalletNote("");
      } else if (showExpenseWidgetSettings) {
        setShowExpenseWidgetSettings(false);
      } else if (showBalanceFilter) {
        setShowBalanceFilter(false);
      } else if (walletSettingsOpenId) {
        setWalletSettingsOpenId(null);
      } else if (activeNav !== "overview") {
        setActiveNav("overview");
      } else {
        App.exitApp();
      }
    }).then((listener) => {
      removeListener = () => { void listener.remove(); };
      if (cancelled) removeListener();
    });

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [
    activeNav,
    availableUpdate,
    debtAction,
    detailWalletId,
    purchaseTarget,
    showBalanceFilter,
    showExpenseWidgetSettings,
    showForm,
    showPhotoEditor,
    showWalletForm,
    showWishlistForm,
    updateLoading,
    walletSettingsOpenId,
  ]);

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
  const isWalletNominalHidden = (id: string) => hiddenWalletNominals.includes(id);
  const displayNominal = (value: number, hidden: boolean) => hidden ? "••••••" : rupiah(value);
  function toggleWalletNominal(wallet: Wallet) {
    if (wallet.category === "notes") return;
    setHiddenWalletNominals((current) => current.includes(wallet.id) ? current.filter((id) => id !== wallet.id) : [...current, wallet.id]);
    setWalletSettingsOpenId(null);
  }
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
  const regularWallets = wallets.filter((wallet) => wallet.category !== "notes");
  const expenseWidgetWalletIds = expenseWidgetSettings.walletIds === null ? regularWallets.map((wallet) => wallet.id) : expenseWidgetSettings.walletIds.filter((id) => regularWallets.some((wallet) => wallet.id === id));
  const expenseWidgetRange = getExpenseDateRange(expenseWidgetSettings.period, new Date(), expenseWidgetSettings.startDate, expenseWidgetSettings.endDate);
  const expenseWidgetSummary = calculateExpenseSummary(transactions, expenseWidgetWalletIds, expenseWidgetRange);
  const expenseWidgetOverLimit = isExpenseLimitExceeded(expenseWidgetSummary.total, expenseWidgetSettings);

  const expenseWidgetRangeLabel = expenseWidgetRange.start && expenseWidgetRange.end
    ? `${new Date(expenseWidgetRange.start + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} – ${new Date(expenseWidgetRange.end + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`
    : "Pilih rentang tanggal";

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !ready || !expenseWidgetSettingsLoaded) return;
    const overLimit = isExpenseLimitExceeded(expenseWidgetSummary.total, expenseWidgetSettings);
    ExpenseWidgetPlugin.syncExpenseWidget({
      title: expenseWidgetSettings.title,
      amount: rupiah(expenseWidgetSummary.total),
      periodLabel: expenseWidgetRangeLabel,
      period: expenseWidgetSettings.period,
      periodKey: getExpensePeriodKey(expenseWidgetSettings.period, new Date(), expenseWidgetSettings.startDate, expenseWidgetSettings.endDate),
      transactionCount: expenseWidgetSummary.count,
      overLimit,
      limitEnabled: expenseWidgetSettings.limitEnabled,
      baseImage: expenseWidgetSettings.baseImage,
      beforeImage: expenseWidgetSettings.beforeImage,
      afterImage: expenseWidgetSettings.afterImage,
      imagePositionX: expenseWidgetSettings[expenseWidgetSettings.limitEnabled && expenseWidgetOverLimit ? "afterImageX" : expenseWidgetSettings.limitEnabled ? "beforeImageX" : "baseImageX"],
      imagePositionY: expenseWidgetSettings[expenseWidgetSettings.limitEnabled && expenseWidgetOverLimit ? "afterImageY" : expenseWidgetSettings.limitEnabled ? "beforeImageY" : "baseImageY"],
      imageZoom: expenseWidgetSettings[expenseWidgetSettings.limitEnabled && expenseWidgetOverLimit ? "afterImageZoom" : expenseWidgetSettings.limitEnabled ? "beforeImageZoom" : "baseImageZoom"],
      baseImageX: expenseWidgetSettings.baseImageX,
      baseImageY: expenseWidgetSettings.baseImageY,
      baseImageZoom: expenseWidgetSettings.baseImageZoom,
      beforeImageX: expenseWidgetSettings.beforeImageX,
      beforeImageY: expenseWidgetSettings.beforeImageY,
      beforeImageZoom: expenseWidgetSettings.beforeImageZoom,
      afterImageX: expenseWidgetSettings.afterImageX,
      afterImageY: expenseWidgetSettings.afterImageY,
      afterImageZoom: expenseWidgetSettings.afterImageZoom,
      enabled: true,
    }).then((status) => setExpenseWidgetInstalled(status.installed))
      .catch((reason: unknown) => console.warn("CAESH widget could not refresh.", reason));
  }, [ready, expenseWidgetSettingsLoaded, expenseWidgetSettings, expenseWidgetSummary.total, expenseWidgetSummary.count, expenseWidgetRangeLabel]);
  async function handleWidgetImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !widgetImageTarget) return;
    if (!file.type.startsWith("image/")) { setError("File background harus berupa gambar."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Ukuran foto maksimal 10 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") { setError("Foto background tidak dapat dibaca."); setWidgetImageTarget(null); return; }
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 360 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) { setError("Foto background gagal diproses."); setWidgetImageTarget(null); return; }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const optimizedImage = canvas.toDataURL("image/jpeg", 0.78);
        setExpenseWidgetSettings((current) => ({ ...current, [widgetImageTarget]: optimizedImage }));
        setWidgetImageTarget(null);
      };
      image.onerror = () => { setError("Format foto background tidak didukung."); setWidgetImageTarget(null); };
      image.src = reader.result;
    };
    reader.onerror = () => { setError("Foto background gagal dibaca."); setWidgetImageTarget(null); };
    reader.readAsDataURL(file);
  }

  function renderWidgetImagePositionEditor(target: "baseImage" | "beforeImage" | "afterImage") {
    const xKey = `${target}X` as "baseImageX" | "beforeImageX" | "afterImageX";
    const yKey = `${target}Y` as "baseImageY" | "beforeImageY" | "afterImageY";
    const zoomKey = `${target}Zoom` as "baseImageZoom" | "beforeImageZoom" | "afterImageZoom";
    const image = expenseWidgetSettings[target];
    if (!image) return null;
    return <div className="expense-widget-position-editor">
      <div className="expense-widget-position-preview"><img src={image} alt="Pratinjau posisi background widget" style={{ objectPosition: `${expenseWidgetSettings[xKey]}% ${expenseWidgetSettings[yKey]}%`, transform: `scale(${expenseWidgetSettings[zoomKey]})` }} /></div>
      <label>Geser horizontal <input className="photo-range" type="range" min="0" max="100" value={expenseWidgetSettings[xKey]} onChange={(event) => setExpenseWidgetSettings((current) => ({ ...current, [xKey]: Number(event.target.value) }))} /></label>
      <label>Geser vertikal <input className="photo-range" type="range" min="0" max="100" value={expenseWidgetSettings[yKey]} onChange={(event) => setExpenseWidgetSettings((current) => ({ ...current, [yKey]: Number(event.target.value) }))} /></label>
      <label>Zoom <input className="photo-range" type="range" min="1" max="2.5" step="0.05" value={expenseWidgetSettings[zoomKey]} onChange={(event) => setExpenseWidgetSettings((current) => ({ ...current, [zoomKey]: Number(event.target.value) }))} /></label>
      <button type="button" className="text-button" onClick={() => setExpenseWidgetSettings((current) => ({ ...current, [xKey]: 50, [yKey]: 50, [zoomKey]: 1 }))}>Reset posisi</button>
    </div>;
  }

  async function addExpenseWidgetToHomeScreen() {
    if (!Capacitor.isNativePlatform()) {
      setError("Pemasangan widget home screen hanya tersedia di aplikasi Android CAESH.");
      return;
    }
    try {
      const result = await ExpenseWidgetPlugin.requestPinExpenseWidget();
      setExpenseWidgetInstalled(result.installed);
      if (result.requested) setError("Permintaan pemasangan dikirim. Konfirmasi penambahan widget pada layar home screen Android.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Widget belum dapat dipasang dari perangkat ini. Ikuti panduan pemasangan manual.");
    }
  }

  function toggleExpenseWidgetWallet(walletId: string) {
    const current = expenseWidgetSettings.walletIds === null ? regularWallets.map((wallet) => wallet.id) : expenseWidgetSettings.walletIds.filter((id) => regularWallets.some((wallet) => wallet.id === id));
    const next = current.includes(walletId) ? current.filter((id) => id !== walletId) : [...current, walletId];
    setExpenseWidgetSettings((settings) => ({ ...settings, walletIds: next }));
  }

  const periodTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter((item) => {
      if (item.hiddenFromHistory) return false;
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
  const detailWallet = wallets.find((wallet) => wallet.id === detailWalletId) ?? null;
  const detailWalletBalance = detailWallet ? walletBalances.find((wallet) => wallet.id === detailWallet.id)?.balance ?? detailWallet.initialBalance : 0;
  const detailWalletTransactions = detailWallet
    ? transactions.filter((item) => !item.hiddenFromHistory && (item.walletId === detailWallet.id || item.toWalletId === detailWallet.id))
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
  const recent = transactions.filter((item) => !item.hiddenFromHistory).slice(0, 6);
  const visibleTransactions = transactions.filter((item) => !item.hiddenFromHistory).filter((item) => { const query = transactionSearch.trim().toLocaleLowerCase(); const matchesSearch = !query || [item.note, item.category, item.walletName ?? "", item.toWalletName ?? "", walletName(item.walletId), item.toWalletId ? walletName(item.toWalletId) : ""].join(" ").toLocaleLowerCase().includes(query); const matchesFilter = transactionFilter === "all" || (transactionFilter === "debt" ? item.category === "Utang" : item.kind === transactionFilter && item.category !== "Utang"); return matchesSearch && matchesFilter; });
  const transferTransactions = transactions.filter((item) => !item.hiddenFromHistory && item.kind === "transfer");
  const expenseByCategory = periodTransactions.filter((item) => item.kind === "expense").reduce<Record<string, number>>((result, item) => { result[item.category] = (result[item.category] ?? 0) + item.amount; return result; }, {});
  const largestExpense = Math.max(1, ...Object.values(expenseByCategory));

  function persistCategoryOptions(next: CategoryOptions) {
    setCategoryOptions(next);
    window.localStorage.setItem("caesh-categories", JSON.stringify(next));
  }

  function removeSelectedCategory() {
    if (kind === "transfer" || category === "Lainnya") return;
    setCategoryDeleteConfirmOpen(true);
  }

  function confirmRemoveSelectedCategory() {
    if (kind !== "income" && kind !== "expense") {
      setCategoryDeleteConfirmOpen(false);
      return;
    }
    const next = { ...categoryOptions, [kind]: categoryOptions[kind].filter((item) => item !== category) };
    persistCategoryOptions(next);
    setCategory(next[kind][0] ?? "Lainnya");
    setCategoryDeleteConfirmOpen(false);
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
      setTransactions(await getTransactions());
      if (result.closed) setWallets((current) => current.filter((wallet) => wallet.id !== noteWallet.id));
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

  function openTransactionEditor(item: Transaction) {
    if (item.category === "Utang" || item.debtAction === "settled") {
      setError("Riwayat utang belum dapat diedit karena terhubung dengan saldo Notes dan riwayat pembayaran.");
      return;
    }
    setEditingTransaction(item);
    setKind(item.kind);
    setAmount(formatRupiahInput(String(item.amount)));
    setCategory(item.kind === "transfer" ? "Transfer" : item.category);
    setOtherCategory("");
    setNote(item.note ?? "");
    setDate(item.date);
    setWalletId(item.walletId);
    setToWalletId(item.toWalletId ?? regularWallets.find((wallet) => wallet.id !== item.walletId)?.id ?? "");
    setError("");
    setShowForm(true);
  }

  function closeTransactionForm() {
    setShowForm(false);
    setEditingTransaction(null);
    setAmount(""); setNote(""); setOtherCategory(""); setDate(today());
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
      const previousSourceEffect = !editingTransaction ? 0
        : editingTransaction.kind === "transfer"
          ? editingTransaction.walletId === walletId ? editingTransaction.amount
          : editingTransaction.toWalletId === walletId ? -editingTransaction.amount : 0
        : editingTransaction.walletId === walletId
          ? editingTransaction.kind === "expense" ? editingTransaction.amount : -editingTransaction.amount
          : 0;
      if (!source || source.balance + previousSourceEffect < value) {
        setError("Saldo wallet sumber tidak mencukupi untuk transfer ini.");
        return;
      }
    }
    const transaction: Transaction = {
      ...(editingTransaction ?? {}),
      id: editingTransaction?.id ?? crypto.randomUUID(), kind, amount: value,
      category: kind === "transfer" ? "Transfer" : finalCategory,
      note: note.trim(), date, walletId,
      ...(kind === "transfer" ? { toWalletId } : { toWalletId: undefined }),
      createdAt: editingTransaction?.createdAt ?? Date.now(),
    };
    try {
      await saveTransaction(transaction);
      if (kind !== "transfer" && category === "Lainnya" && !categoryOptions[kind].some((item) => item.toLocaleLowerCase() === finalCategory.toLocaleLowerCase())) {
        persistCategoryOptions({ ...categoryOptions, [kind]: [...categoryOptions[kind], finalCategory] });
      }
      setTransactions((current) => (editingTransaction
        ? current.map((item) => item.id === transaction.id ? transaction : item)
        : [transaction, ...current]).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt));
      closeTransactionForm(); setError("");
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
    const duplicateWallet = wallets.find((wallet) => wallet.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
    if (duplicateWallet) {
      setError(newWalletCategory === "notes" && duplicateWallet.category === "notes"
        ? "Notes untuk orang ini masih aktif. Tambahkan utangnya dari detail Notes yang sudah ada."
        : "Nama wallet tersebut sudah digunakan.");
      return;
    }
    if (newWalletCategory === "notes") {
      const debtValue = parseRupiahInput(newDebtAmount);
      const cashWallet = regularWallets.find((item) => item.id === newDebtCashWalletId);
      if (!Number.isSafeInteger(debtValue) || debtValue <= 0) { setError("Masukkan nominal utang lebih dari nol."); return; }
      if (!cashWallet) { setError("Pilih wallet biasa untuk menerima atau memberikan uang."); return; }
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
    const target = transactions.find((item) => item.id === id && !item.hiddenFromHistory);
    setDeleteTransactionTarget(target ?? null);
  }

  async function confirmDeleteTransaction() {
    if (!deleteTransactionTarget) return;
    try {
      await removeTransaction(deleteTransactionTarget.id, deleteTransactionTarget.category === "Utang");
      const [savedTransactions, savedWallets] = await Promise.all([getTransactions(), getWallets()]);
      setTransactions(savedTransactions);
      setWallets(savedWallets);
      setDeleteTransactionTarget(null);
      if (detailWalletId && !savedWallets.some((wallet) => wallet.id === detailWalletId)) {
        setDetailWalletId(null);
        setDetailWalletNote("");
      }
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Transaksi gagal dihapus.");
    }
  }

  async function handleSettleDebt() {
    if (!settleDebtTarget) return;
    const wallet = settleDebtTarget;
    try {
      await settleDebtNote(wallet.id);
      setTransactions(await getTransactions());
      setWallets((current) => current.filter((item) => item.id !== wallet.id));
      setSettleDebtTarget(null);
      setDetailWalletId(null);
      setDetailWalletNote("");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Utang gagal diselesaikan.");
    }
  }

  async function handleWalletDelete(id: string) {
    const wallet = wallets.find((item) => item.id === id);
    if (!wallet) return;
    if (wallet.category === "notes") { setError("Notes utang hanya akan hilang otomatis setelah lunas."); return; }
    if (regularWallets.length <= 1) {
      setError("Caesh harus memiliki minimal satu wallet biasa agar pembayaran dan pencatatan tetap bisa dilakukan.");
      return;
    }
    const related = transactions.filter((item) => item.walletId === id || item.toWalletId === id);
    const balance = walletBalances.find((item) => item.id === id)?.balance ?? wallet.initialBalance;
    setWalletDeleteTarget(wallet);
  }

  async function confirmWalletDelete() {
    if (!walletDeleteTarget) return;
    const id = walletDeleteTarget.id;
    try {
      await removeWallet(id);
      const nextWallets = wallets.filter((item) => item.id !== id);
      setWallets(nextWallets);
      if (walletId === id) setWalletId(nextWallets.find((item) => item.category !== "notes")?.id ?? "");
      if (toWalletId === id) setToWalletId(nextWallets.find((item) => item.category !== "notes" && item.id !== walletId)?.id ?? nextWallets.find((item) => item.category !== "notes")?.id ?? "");
      setWalletDeleteTarget(null);
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

  async function handleWishlistDelete() {
    if (!deleteWishlistTarget) return;
    const item = deleteWishlistTarget;
    try {
      await removeWishlist(item.id);
      setWishlist((current) => current.filter((entry) => entry.id !== item.id));
      setDeleteWishlistTarget(null);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Wishlist gagal dihapus.");
    }
  }

  async function handleWishlistPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!purchaseTarget) return;
    const value = parseRupiahInput(purchaseAmount);
    const selectedWallet = regularWallets.find((wallet) => wallet.id === purchaseWalletId);
    if (!Number.isSafeInteger(value) || value <= 0) { setError("Masukkan harga pembelian yang valid."); return; }
    if (!selectedWallet) { setError("Pilih wallet untuk pembelian."); return; }
    if ((walletBalances.find((wallet) => wallet.id === selectedWallet.id)?.balance ?? 0) < value) { setError("Saldo wallet tidak mencukupi untuk pembelian ini."); return; }
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
        <header className="topbar"><a className="brand topbar-brand" href="#" aria-label="Caesh beranda"><span className="topbar-brand-name">Caesh<span className="brand-period">.</span></span></a><div className="topbar-right"><span className="top-date">{todayLabel}</span><button className="theme-toggle" onClick={() => setShowExpenseWidgetSettings(true)} aria-label="Pengaturan widget CAESH" title="Widget CAESH"><span aria-hidden="true">▦</span><span>Widget</span></button><button className="theme-toggle" onClick={() => setTheme((current) => current === "light" ? "dark" : "light")} aria-label={theme === "light" ? "Aktifkan tema gelap" : "Aktifkan tema terang"} title={theme === "light" ? "Tema gelap" : "Tema terang"}><span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span><span>{theme === "light" ? "Gelap" : "Terang"}</span></button></div></header>
        <div className={activeNav === "overview" ? "content overview-content" : "content"}>
          <div className="welcome-row"><div><div className="eyebrow">{({ overview: "PERSONAL FINANCE OVERVIEW", wallets: "MONEY STORAGE", transactions: "TRANSACTION HISTORY", insights: "FINANCIAL INSIGHTS", wishlist: "YOUR WISHLIST" })[activeNav]}</div><h1>{({ overview: <>Uangmu, lebih <em>terarah.</em></>, wallets: <>Kelola <em>wallet.</em></>, transactions: <>Semua <em>transaksi.</em></>, insights: <>Kenali pola <em>keuangan.</em></>, wishlist: <>Daftar <em>keinginan.</em></> })[activeNav]}</h1></div>{activeNav !== "wishlist" && <button className="primary-button" onClick={() => { setKind("expense"); setShowForm(true); }}><span>＋</span> Tambah transaksi</button>}</div>
          {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError("")}>Tutup</button></div>}

          {activeNav === "overview" && <>
          <div className="period-row"><span className="section-kicker">RINGKASAN KEUANGAN</span><div className="period-tabs" aria-label="Periode ringkasan"><button className={period === "month" ? "selected" : ""} onClick={() => setPeriod("month")}>Bulan ini</button><button className={period === "year" ? "selected" : ""} onClick={() => setPeriod("year")}>Tahun ini</button><button className={period === "all" ? "selected" : ""} onClick={() => setPeriod("all")}>Semua</button></div></div>
          <section className="stats-grid" aria-label="Ringkasan saldo">
            <article className="stat-card balance-card"><div className="stat-top"><span>Total saldo semua wallet</span><button type="button" className="summary-privacy-toggle" aria-label={summaryNominalsHidden ? "Tampilkan semua nominal ringkasan" : "Sembunyikan semua nominal ringkasan"} aria-pressed={summaryNominalsHidden} onClick={() => setSummaryNominalsHidden((hidden) => !hidden)}>{summaryNominalsHidden ? "Tampilkan" : "Hide"}</button></div><div className="stat-value">{ready ? displayNominal(totalBalance, summaryNominalsHidden) : "Memuat..."}</div><div className="stat-foot"><span className="balance-dot" /> {selectedBalanceWalletIds.length === wallets.length ? "Gabungan saldo seluruh wallet" : `Menghitung ${selectedBalanceWalletIds.length} dari ${wallets.length} wallet`}</div>
              <button type="button" className="balance-filter-trigger" aria-expanded={showBalanceFilter} onClick={() => setShowBalanceFilter((visible) => !visible)}>{showBalanceFilter ? "Tutup filter wallet" : "Atur wallet yang dihitung"}</button>
              {showBalanceFilter && <div className="balance-filter-panel">
                <div className="balance-filter-heading"><strong>Pilih wallet untuk total saldo</strong><button type="button" className="balance-filter-select-all" onClick={toggleAllBalanceFilterWallets}>{selectedBalanceWalletIds.length === wallets.length ? "Kosongkan" : "Pilih semua"}</button></div>
                {wallets.length === 0 ? <p className="expense-widget-empty">Belum ada wallet yang bisa dipilih.</p> : wallets.map((wallet) => <label className="balance-filter-option" key={wallet.id}><input type="checkbox" checked={selectedBalanceWalletIds.includes(wallet.id)} onChange={() => toggleBalanceFilterWallet(wallet.id)} /><span>{wallet.name}</span></label>)}
              </div>}
              <div className="balance-decoration" aria-hidden="true" /></article>
            <article className="stat-card"><div className="stat-top"><span>Total pemasukan</span><span className="stat-icon income-icon">↙</span></div><div className="stat-value">{ready ? displayNominal(totals.income, summaryNominalsHidden) : "Memuat..."}</div><div className="stat-foot">Uang yang masuk pada periode ini</div></article>
            <article className="stat-card"><div className="stat-top"><span>Total pengeluaran</span><span className="stat-icon expense-icon">↗</span></div><div className="stat-value">{ready ? displayNominal(totals.expense, summaryNominalsHidden) : "Memuat..."}</div><div className="stat-foot">Uang yang digunakan pada periode ini</div></article>
          </section>

          <section className="overview-wallet-panel" aria-label="Wallet">
            <div className="overview-wallet-heading"><div><span className="section-kicker">TEMPAT PENYIMPANAN UANG</span><strong>Wallet kamu</strong></div><button type="button" className="wallet-add-button" aria-label="Tambah wallet" title="Tambah wallet" onClick={() => { setNewWalletCategory("standard"); setNewWalletName(""); setNewWalletBalance("0"); setNewDebtAmount(""); setNewDebtCashWalletId(regularWallets[0]?.id ?? ""); setShowWalletForm(true); }}>＋</button></div>
            <div className="overview-wallet-list" onScroll={() => setWalletSettingsOpenId(null)}>
              {walletBalances.map((wallet) => <article className={`overview-wallet-item${wallet.photo ? " has-photo" : ""}`} key={wallet.id} role="button" tabIndex={0} aria-label={`Lihat detail wallet ${wallet.name}`} onClick={() => { setDetailWalletId(wallet.id); setDetailWalletNote(wallet.note ?? ""); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setDetailWalletId(wallet.id); setDetailWalletNote(wallet.note ?? ""); } }}>{wallet.photo && <img className="wallet-card-photo" src={wallet.photo} alt="" style={{ objectPosition: `${wallet.photoX ?? 50}% ${wallet.photoY ?? 50}%`, transform: `scale(${wallet.photoZoom ?? 1.15})` }} />}<div className="overview-wallet-item-top"><strong className="wallet-name">{wallet.name}</strong>{wallet.category !== "notes" && <button type="button" className="wallet-settings-trigger" aria-label={`Pengaturan wallet ${wallet.name}`} aria-expanded={walletSettingsOpenId === wallet.id} title="Pengaturan wallet" onClick={(event) => { event.stopPropagation(); setWalletSettingsOpenId((current) => current === wallet.id ? null : wallet.id); }}>•••</button>}</div><div className="overview-wallet-bottom"><div className="wallet-balance">{ready ? displayNominal(wallet.category === "notes" ? Math.abs(wallet.balance) : wallet.balance, summaryNominalsHidden || (wallet.category !== "notes" && isWalletNominalHidden(wallet.id))) : "Memuat..."}</div><div className="wallet-start">{wallet.category === "notes" ? wallet.debtDirection === "lent" ? "Piutang · belum lunas" : "Utang · belum lunas" : (summaryNominalsHidden || isWalletNominalHidden(wallet.id)) ? "Saldo awal ••••••" : `Saldo awal ${rupiah(wallet.initialBalance)}`}</div></div>{wallet.category !== "notes" && walletSettingsOpenId === wallet.id && <div className="wallet-settings-menu" onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => toggleWalletNominal(wallet)}>{isWalletNominalHidden(wallet.id) ? "Tampilkan" : "Hide"}</button><button type="button" onClick={() => { setWalletSettingsOpenId(null); openWalletPhotoEditor(wallet.id); }}>▧ Atur background</button><button type="button" className="wallet-settings-danger" onClick={() => { setWalletSettingsOpenId(null); void handleWalletDelete(wallet.id); }}>× Hapus wallet</button></div>}</article>)}
              {wallets.length === 0 && ready && <div className="wallet-empty">Belum ada wallet. Tambahkan wallet pertamamu.</div>}
            </div>
          </section>

          </>}

          {activeNav === "overview" && <section className="lower-grid" id="transactions">
            <article className="panel-card transactions-card"><div className="panel-heading"><div><div className="section-kicker">CATATAN TERBARU</div><h2>Aktivitas transaksi</h2></div><button className="text-button" onClick={() => setShowForm(true)}>＋ Catat baru</button></div>
              {!ready ? <div className="empty-state">Memuat data lokal...</div> : recent.length === 0 ? <div className="empty-state"><div className="empty-art">↗</div><strong>Belum ada transaksi</strong><p>Mulai catat pemasukan atau pengeluaran pertamamu.</p><button className="outline-button" onClick={() => setShowForm(true)}>Tambah transaksi pertama</button></div> :
              <div className="transaction-list">{recent.map((item) => <div className="transaction-row" key={item.id}><div className={`transaction-icon ${item.kind}`}>{item.kind === "income" ? "↙" : item.kind === "expense" ? "↗" : "⇄"}</div><div className="transaction-info"><strong>{item.note || item.category}</strong><span>{item.kind === "transfer" ? `${walletName(item.walletId)} → ${walletName(item.toWalletId ?? "")}` : `${item.category} · ${walletName(item.walletId)}`} · {new Date(item.date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span></div><div className={`transaction-amount ${item.kind}`}>{summaryNominalsHidden ? "••••••" : `${item.kind === "income" ? "+" : item.kind === "expense" ? "−" : "⇄"}${rupiah(item.amount)}`}</div>{!item.hiddenFromHistory && <button className="delete-button" aria-label="Hapus transaksi" onClick={(event) => { event.stopPropagation(); void handleDelete(item.id); }}>×</button>}</div>)}</div>}
            </article>
            <article className="panel-card insight-card" id="insights"><div className="section-kicker">KEBIASAAN FINANSIAL</div><h2>Ringkasan aktivitas</h2><div className="insight-metric"><span>Jumlah transaksi</span><strong>{periodTransactions.length}</strong></div><div className="insight-metric"><span>Rata-rata pengeluaran</span><strong>{displayNominal(expenseCount ? totals.expense / expenseCount : 0, summaryNominalsHidden)}</strong></div><div className="insight-note"><span>✳</span><p>Catat transaksi secara rutin agar ringkasan keuanganmu semakin akurat.</p></div></article>
          </section>}

          {activeNav === "transactions" && <section className="panel-card page-section" id="transactions">
            <div className="panel-heading"><div><div className="section-kicker">RIWAYAT LENGKAP</div><h2>Semua transaksi</h2></div><span className="result-count">{visibleTransactions.length} catatan</span></div>
            <div className="transaction-tools"><input aria-label="Cari transaksi" type="search" placeholder="Cari catatan, kategori, atau wallet..." value={transactionSearch} onChange={(event) => setTransactionSearch(event.target.value)} /><select aria-label="Filter jenis transaksi" value={transactionFilter} onChange={(event) => setTransactionFilter(event.target.value as "all" | TransactionKind | "debt")}><option value="all">Semua jenis</option><option value="income">Pemasukan</option><option value="expense">Pengeluaran</option><option value="transfer">Transfer</option><option value="debt">Utang</option></select></div>
            {!ready ? <div className="empty-state">Memuat data lokal...</div> : visibleTransactions.length === 0 ? <div className="empty-state"><strong>Tidak ada transaksi ditemukan</strong><p>Coba ubah kata pencarian atau filter yang dipilih.</p></div> : <div className="transaction-list">{visibleTransactions.map((item) => <div className="transaction-row transaction-row-editable" key={item.id} role="button" tabIndex={0} aria-label={`Edit transaksi ${item.note || item.category}`} onClick={() => openTransactionEditor(item)} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !(event.target instanceof Element && event.target.closest("button"))) { event.preventDefault(); openTransactionEditor(item); } }}><div className={`transaction-icon ${item.kind}`}>{item.kind === "income" ? "↙" : item.kind === "expense" ? "↗" : "⇄"}</div><div className="transaction-info"><strong>{item.debtAction === "settled" ? `${item.note} · ${item.walletName ?? "Utang"}` : item.note || item.category}</strong><span>{item.debtAction === "settled" ? `${item.debtDirection === "borrowed" ? "Utang" : "Piutang"} · Total ${rupiah(item.debtInitialAmount ?? 0)} · Dibayar ${rupiah(item.debtPaidAmount ?? 0)} · ${(item.debtRemainingAmount ?? 0) > 0 ? `Sisa dihapus ${rupiah(item.debtRemainingAmount ?? 0)}` : "Lunas dibayar penuh"}` : item.kind === "transfer" ? `${walletName(item.walletId)} → ${walletName(item.toWalletId ?? "")}` : `${item.category} · ${walletName(item.walletId)}`} · {new Date(item.date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span></div><div className={`transaction-amount ${item.kind}`}>{item.debtAction === "settled" ? ((item.debtRemainingAmount ?? 0) > 0 ? "SELESAI" : "LUNAS") : <>{item.kind === "income" ? "+" : item.kind === "expense" ? "−" : "⇄"}{rupiah(item.amount)}</>}</div>{!item.hiddenFromHistory && <button className="delete-button" aria-label="Hapus transaksi" onClick={() => handleDelete(item.id)}>×</button>}</div>)}</div>}
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
                  {item.status === "purchased" ? <div className="wishlist-purchase-detail"><strong>{rupiah(item.purchaseAmount ?? 0)}</strong><span>{walletName(item.walletId ?? "")}</span></div> : <button className="primary-button" onClick={() => { setPurchaseTarget(item); setPurchaseWalletId(regularWallets[0]?.id ?? ""); setPurchaseAmount(""); }}>Beli</button>}
                  <button type="button" className="delete-button" aria-label={`Hapus ${item.name} dari wishlist`} onClick={() => setDeleteWishlistTarget(item)}>×</button>
                </article>)}</div>}
          </section>}

          {activeNav === "insights" && <section className="page-section analysis-page">
            <div className="stats-grid analysis-stats"><article className="stat-card"><div className="stat-top"><span>Jumlah transaksi</span></div><div className="stat-value">{periodTransactions.length}</div><div className="stat-foot">Pada periode yang dipilih</div></article><article className="stat-card"><div className="stat-top"><span>Rata-rata pengeluaran</span></div><div className="stat-value">{rupiah(expenseCount ? totals.expense / expenseCount : 0)}</div><div className="stat-foot">Per transaksi pengeluaran</div></article><article className="stat-card"><div className="stat-top"><span>Arus bersih</span></div><div className="stat-value">{rupiah(totals.income - totals.expense)}</div><div className="stat-foot">Pemasukan dikurangi pengeluaran</div></article></div>
            <div className="period-row"><span className="section-kicker">PERIODE ANALISIS</span><div className="period-tabs"><button className={period === "month" ? "selected" : ""} onClick={() => setPeriod("month")}>Bulan ini</button><button className={period === "year" ? "selected" : ""} onClick={() => setPeriod("year")}>Tahun ini</button><button className={period === "all" ? "selected" : ""} onClick={() => setPeriod("all")}>Semua</button></div></div>
            <article className="panel-card category-analysis"><div className="section-kicker">PENGELUARAN PER KATEGORI</div><h2>Ke mana uangmu pergi?</h2>{Object.keys(expenseByCategory).length === 0 ? <div className="empty-state"><strong>Belum ada data pengeluaran</strong><p>Data kategori akan muncul setelah kamu mencatat pengeluaran.</p></div> : Object.entries(expenseByCategory).sort((a,b) => b[1]-a[1]).map(([name,value]) => <div className="category-bar-row" key={name}><div className="category-bar-label"><strong>{name}</strong><span>{rupiah(value)}</span></div><div className="category-bar-track"><span style={{ width: `${Math.max(3, value / largestExpense * 100)}%` }} /></div></div>)}</article>
          </section>}
                  </div>
      </section>

      {showExpenseWidgetSettings && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowExpenseWidgetSettings(false); }}><section className="modal-card expense-widget-modal" role="dialog" aria-modal="true" aria-labelledby="expense-widget-title"><div className="modal-heading"><div><div className="section-kicker">WIDGET HOME SCREEN</div><h2 id="expense-widget-title">Pengaturan widget</h2></div><button className="modal-close" onClick={() => setShowExpenseWidgetSettings(false)} aria-label="Tutup">×</button></div>
        <p className="wallet-form-hint">Atur kartu pengeluaran yang akan tampil di home screen. Pengaturan tetap tersimpan meskipun widget belum dipasang.</p>
        <label className="field-label" htmlFor="expense-widget-custom-title">Judul widget</label><input id="expense-widget-custom-title" type="text" maxLength={40} value={expenseWidgetSettings.title} onChange={(event) => setExpenseWidgetSettings((current) => ({ ...current, title: event.target.value }))} />
        <label className="field-label" htmlFor="expense-widget-period">Periode pengeluaran</label><select id="expense-widget-period" value={expenseWidgetSettings.period} onChange={(event) => setExpenseWidgetSettings((current) => ({ ...current, period: event.target.value as ExpenseWidgetPeriod }))}><option value="daily">Harian</option><option value="weekly">Mingguan</option><option value="monthly">Bulanan</option><option value="yearly">Tahunan</option><option value="custom">Rentang tanggal sendiri</option></select>
        {expenseWidgetSettings.period === "custom" && <div className="expense-widget-date-grid"><div><label className="field-label" htmlFor="expense-widget-start">Dari tanggal</label><input id="expense-widget-start" type="date" value={expenseWidgetSettings.startDate} max={expenseWidgetSettings.endDate || undefined} onChange={(event) => setExpenseWidgetSettings((current) => ({ ...current, startDate: event.target.value }))} /></div><div><label className="field-label" htmlFor="expense-widget-end">Sampai tanggal</label><input id="expense-widget-end" type="date" value={expenseWidgetSettings.endDate} min={expenseWidgetSettings.startDate || undefined} onChange={(event) => setExpenseWidgetSettings((current) => ({ ...current, endDate: event.target.value }))} /></div></div>}
        <div className="expense-widget-wallets"><span className="field-label">Hitung pengeluaran dari wallet</span>{regularWallets.length === 0 ? <p className="expense-widget-empty">Belum ada wallet biasa yang bisa dipilih.</p> : regularWallets.map((wallet) => <label className="expense-widget-wallet-option" key={wallet.id}><input type="checkbox" checked={expenseWidgetWalletIds.includes(wallet.id)} onChange={() => toggleExpenseWidgetWallet(wallet.id)} /><span>{wallet.name}</span></label>)}<button type="button" className="text-button expense-widget-select-all" onClick={() => setExpenseWidgetSettings((current) => ({ ...current, walletIds: expenseWidgetWalletIds.length === regularWallets.length ? [] : regularWallets.map((wallet) => wallet.id) }))}>{expenseWidgetWalletIds.length === regularWallets.length ? "Kosongkan pilihan" : "Pilih semua wallet"}</button></div>
        {!expenseWidgetSettings.limitEnabled && <div className="expense-widget-photo-row"><div><strong>Background widget</strong><span>{expenseWidgetSettings.baseImage ? "Foto sudah dipilih" : "Gunakan background bawaan atau upload foto"}</span></div><button type="button" className="outline-button" onClick={() => { setWidgetImageTarget("baseImage"); widgetImagePickerRef.current?.click(); }}>Pilih foto</button>{expenseWidgetSettings.baseImage && <><button type="button" className="text-button" onClick={() => setWidgetImagePositionTarget((current) => current === "baseImage" ? null : "baseImage")}>{widgetImagePositionTarget === "baseImage" ? "Tutup posisi" : "Atur posisi"}</button><button type="button" className="text-button" onClick={() => { setExpenseWidgetSettings((current) => ({ ...current, baseImage: "" })); setWidgetImagePositionTarget(null); }}>Hapus</button></>}</div>}
        <div className="expense-widget-limit"><label className="expense-widget-wallet-option"><input type="checkbox" checked={expenseWidgetSettings.limitEnabled} onChange={(event) => setExpenseWidgetSettings((current) => ({ ...current, limitEnabled: event.target.checked }))} /><strong>Aktifkan perubahan background saat pengeluaran melewati batas</strong></label>
          {expenseWidgetSettings.limitEnabled && <><label className="field-label" htmlFor="expense-widget-limit">Batas pengeluaran (Rp)</label><input id="expense-widget-limit" type="text" inputMode="numeric" value={expenseWidgetSettings.monthlyLimit ? formatRupiahInput(String(expenseWidgetSettings.monthlyLimit)) : ""} placeholder="Contoh: 2.000.000" onChange={(event) => setExpenseWidgetSettings((current) => ({ ...current, monthlyLimit: parseRupiahInput(event.target.value) || 0 }))} />
            <div className="expense-widget-photo-row"><div><strong>Background sebelum melewati batas</strong><span>{expenseWidgetSettings.beforeImage ? "Foto sudah dipilih" : "Belum ada foto"}</span></div><button type="button" className="outline-button" onClick={() => { setWidgetImageTarget("beforeImage"); widgetImagePickerRef.current?.click(); }}>Pilih foto</button>{expenseWidgetSettings.beforeImage && <><button type="button" className="text-button" onClick={() => setWidgetImagePositionTarget((current) => current === "beforeImage" ? null : "beforeImage")}>{widgetImagePositionTarget === "beforeImage" ? "Tutup posisi" : "Atur posisi"}</button><button type="button" className="text-button" onClick={() => { setExpenseWidgetSettings((current) => ({ ...current, beforeImage: "" })); setWidgetImagePositionTarget(null); }}>Hapus</button></>}</div>
            <div className="expense-widget-photo-row"><div><strong>Background setelah melewati batas</strong><span>{expenseWidgetSettings.afterImage ? "Foto sudah dipilih" : "Belum ada foto"}</span></div><button type="button" className="outline-button" onClick={() => { setWidgetImageTarget("afterImage"); widgetImagePickerRef.current?.click(); }}>Pilih foto</button>{expenseWidgetSettings.afterImage && <><button type="button" className="text-button" onClick={() => setWidgetImagePositionTarget((current) => current === "afterImage" ? null : "afterImage")}>{widgetImagePositionTarget === "afterImage" ? "Tutup posisi" : "Atur posisi"}</button><button type="button" className="text-button" onClick={() => { setExpenseWidgetSettings((current) => ({ ...current, afterImage: "" })); setWidgetImagePositionTarget(null); }}>Hapus</button></>}</div>
            {(!expenseWidgetSettings.beforeImage || !expenseWidgetSettings.afterImage || expenseWidgetSettings.monthlyLimit <= 0) && <p className="wallet-form-hint">Isi nominal batas dan pilih kedua foto agar perubahan background aktif sepenuhnya.</p>}
            <p className="wallet-form-hint">Status akan kembali ke foto pertama saat periode yang dipilih dimulai lagi.</p>
          </>}
        </div>
        {widgetImagePositionTarget && renderWidgetImagePositionEditor(widgetImagePositionTarget)}
        <div className="expense-widget-preview"><span className="section-kicker">PRATINJAU SAAT INI</span><strong>{rupiah(expenseWidgetSummary.total)}</strong><span>{expenseWidgetRangeLabel} · {expenseWidgetSummary.count} transaksi</span>{expenseWidgetOverLimit && <em>Batas pengeluaran terlampaui</em>}</div>
        <div className="expense-widget-install"><strong>{expenseWidgetInstalled ? "Widget sudah terpasang" : "Widget belum terpasang di home screen"}</strong><p>{expenseWidgetInstalled ? "Widget akan mengikuti pengaturan dan transaksi terbaru." : "Pengaturan tetap tersimpan. Pasang widget agar kartu pengeluaran terlihat di home screen."}</p><ol><li>Tekan tombol Pasang widget di bawah.</li><li>Konfirmasi penambahan pada layar home screen Android.</li><li>Jika permintaan tidak tersedia, tekan lama area kosong home screen, pilih Widget, lalu cari CAESH.</li></ol><button type="button" className="outline-button" onClick={addExpenseWidgetToHomeScreen}>{expenseWidgetInstalled ? "Periksa status widget" : "Pasang widget ke home screen"}</button></div>
        <input ref={widgetImagePickerRef} className="visually-hidden-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleWidgetImageFileChange} />
        <div className="modal-actions"><button type="button" className="primary-button" onClick={() => setShowExpenseWidgetSettings(false)}>Selesai</button></div>
      </section></div>}
      {deleteWishlistTarget && <div className="modal-backdrop delete-wishlist-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteWishlistTarget(null); }}><section className="modal-card delete-wishlist-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-wishlist-title" aria-describedby="delete-wishlist-description"><div className="delete-wishlist-icon" aria-hidden="true">×</div><div className="section-kicker">KONFIRMASI WISHLIST</div><h2 id="delete-wishlist-title">Hapus wishlist?</h2><p id="delete-wishlist-description">Item <strong>{deleteWishlistTarget.name}</strong> akan dihapus dari wishlist. Tindakan ini tidak bisa dibatalkan.</p><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setDeleteWishlistTarget(null)}>Batal</button><button type="button" className="delete-wishlist-confirm-button" onClick={handleWishlistDelete}>Ya, hapus</button></div></section></div>}
      {settleDebtTarget && <div className="modal-backdrop settle-debt-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettleDebtTarget(null); }}><section className="modal-card settle-debt-modal" role="alertdialog" aria-modal="true" aria-labelledby="settle-debt-title" aria-describedby="settle-debt-description"><div className="settle-debt-icon" aria-hidden="true">✓</div><div className="section-kicker">KONFIRMASI UTANG</div><h2 id="settle-debt-title">Selesaikan utang?</h2><p id="settle-debt-description">Tandai utang dengan <strong>{settleDebtTarget.name}</strong> sebagai lunas dengan sisa <strong>{rupiah(Math.abs(walletBalances.find((item) => item.id === settleDebtTarget.id)?.balance ?? 0))}</strong>. Tidak ada pembayaran tambahan dan saldo wallet tidak akan berubah.</p><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setSettleDebtTarget(null)}>Batal</button><button type="button" className="settle-debt-confirm-button" onClick={handleSettleDebt}>Ya, selesaikan</button></div></section></div>}
      {categoryDeleteConfirmOpen && <div className="modal-backdrop delete-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCategoryDeleteConfirmOpen(false); }}><section className="modal-card delete-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="category-delete-title" aria-describedby="category-delete-description"><div className="delete-confirm-icon" aria-hidden="true">!</div><div className="section-kicker">KONFIRMASI KATEGORI</div><h2 id="category-delete-title">Hapus kategori?</h2><p id="category-delete-description">Kategori <strong>{category}</strong> akan dihapus dari daftar pilihan. Riwayat transaksi lama dengan kategori ini tetap tersimpan.</p><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setCategoryDeleteConfirmOpen(false)}>Batal</button><button type="button" className="delete-confirm-button" onClick={confirmRemoveSelectedCategory}>Ya, hapus</button></div></section></div>}
      {walletDeleteTarget && <div className="modal-backdrop delete-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setWalletDeleteTarget(null); }}><section className="modal-card delete-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="wallet-delete-title" aria-describedby="wallet-delete-description"><div className="delete-confirm-icon" aria-hidden="true">!</div><div className="section-kicker">KONFIRMASI WALLET</div><h2 id="wallet-delete-title">Hapus wallet?</h2><p id="wallet-delete-description">Wallet <strong>{walletDeleteTarget.name}</strong> dengan saldo <strong>{rupiah(walletBalances.find((item) => item.id === walletDeleteTarget.id)?.balance ?? walletDeleteTarget.initialBalance)}</strong> akan dihapus dari daftar. Saldo ini akan dikeluarkan dari total saldo CAESH.{transactions.some((item) => item.walletId === walletDeleteTarget.id || item.toWalletId === walletDeleteTarget.id) ? <> Riwayat transaksi terkait tetap tersimpan dengan nama wallet ini.</> : null} Jika masih ada uang, transfer dulu ke wallet lain. Tindakan ini tidak bisa dibatalkan.</p><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setWalletDeleteTarget(null)}>Batal</button><button type="button" className="delete-confirm-button" onClick={confirmWalletDelete}>Ya, hapus wallet</button></div></section></div>}
      {deleteTransactionTarget && <div className="modal-backdrop delete-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTransactionTarget(null); }}><section className="modal-card delete-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-description"><div className="delete-confirm-icon" aria-hidden="true">!</div><div className="section-kicker">KONFIRMASI HAPUS</div><h2 id="delete-confirm-title">Hapus transaksi ini?</h2><p id="delete-confirm-description">Transaksi <strong>{deleteTransactionTarget.note || deleteTransactionTarget.category}</strong> sebesar <strong>{rupiah(deleteTransactionTarget.amount)}</strong> akan dihapus dari riwayat. Tindakan ini tidak bisa dibatalkan.</p><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setDeleteTransactionTarget(null)}>Batal</button><button type="button" className="delete-confirm-button" onClick={confirmDeleteTransaction}>Ya, hapus</button></div></section></div>}

      {showForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeTransactionForm(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><div className="section-kicker">{editingTransaction ? "EDIT RIWAYAT TRANSAKSI" : "CATATAN BARU"}</div><h2 id="modal-title">{editingTransaction ? "Edit transaksi" : "Tambah transaksi"}</h2></div><button className="modal-close" onClick={closeTransactionForm} aria-label="Tutup">×</button></div>
        <form onSubmit={handleSubmit}><div className="kind-switch"><button type="button" className={kind === "expense" ? "active expense-choice" : ""} onClick={() => changeKind("expense")}>Pengeluaran</button><button type="button" className={kind === "income" ? "active income-choice" : ""} onClick={() => changeKind("income")}>Pemasukan</button><button type="button" className={kind === "transfer" ? "active transfer-choice" : ""} onClick={() => changeKind("transfer")}>Transfer</button></div>
          <label className="field-label" htmlFor="amount">Nominal (Rp)</label><div className="currency-input-wrap"><span>Rp</span><input id="amount" className="amount-input" inputMode="numeric" type="text" placeholder="0" value={amount} onChange={(event) => setAmount(formatRupiahInput(event.target.value))} required /></div>
          <div className="form-grid"><div>{kind !== "transfer" ? <><label className="field-label" htmlFor="category">Kategori</label><select id="category" value={category} onChange={(event) => setCategory(event.target.value)}>{categoryOptions[kind].map((item) => <option key={item} value={item}>{item}</option>)}<option value="Lainnya">Lainnya</option></select>
              {category === "Lainnya" ? <><label className="field-label" htmlFor="other-category">Nama kategori</label><input id="other-category" type="text" maxLength={32} placeholder="Contoh: Donasi, Perawatan, Langganan..." value={otherCategory} onChange={(event) => setOtherCategory(event.target.value)} required /></> : <button type="button" className="category-remove-button" onClick={removeSelectedCategory}>Hapus kategori ini</button>}</> : <><label className="field-label" htmlFor="source-wallet">Dari wallet</label><select id="source-wallet" value={walletId} onChange={(event) => { const nextSource = event.target.value; setWalletId(nextSource); if (toWalletId === nextSource) setToWalletId(regularWallets.find((wallet) => wallet.id !== nextSource)?.id ?? ""); }} required>{regularWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} — {rupiah(walletBalances.find((entry) => entry.id === wallet.id)?.balance ?? 0)}</option>)}</select></>}</div><div><label className="field-label" htmlFor="wallet">{kind === "transfer" ? "Ke wallet" : "Wallet"}</label><select id="wallet" value={kind === "transfer" ? toWalletId : walletId} onChange={(event) => kind === "transfer" ? setToWalletId(event.target.value) : setWalletId(event.target.value)} required>{regularWallets.filter((wallet) => kind !== "transfer" || wallet.id !== walletId).map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select></div></div>
          <label className="field-label" htmlFor="date">Tanggal</label><input id="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          <label className="field-label" htmlFor="note">Catatan <span>(opsional)</span></label><input id="note" type="text" maxLength={80} placeholder="Contoh: makan siang" value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="modal-actions"><button type="button" className="cancel-button" onClick={closeTransactionForm}>Batal</button><button type="submit" className="primary-button">{editingTransaction ? "Simpan perubahan" : "Simpan transaksi"}</button></div>
        </form></section></div>}

      {debtAction && debtTargetWalletId && (() => {
        const target = wallets.find((wallet) => wallet.id === debtTargetWalletId);
        if (!target || target.category !== "notes") return null;
        const outstanding = Math.abs(walletBalances.find((wallet) => wallet.id === target.id)?.balance ?? 0);
        return <div className="modal-backdrop debt-action-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !debtSaving) setDebtAction(null); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="debt-action-title"><div className="modal-heading"><div><div className="section-kicker">{debtAction === "add" ? "TAMBAH CATATAN UTANG" : "CATAT PEMBAYARAN"}</div><h2 id="debt-action-title">{target.name}</h2></div><button className="modal-close" onClick={() => setDebtAction(null)} aria-label="Tutup" disabled={debtSaving}>×</button></div><p className="wallet-form-hint">Sisa utang saat ini: <strong>{rupiah(outstanding)}</strong></p><form onSubmit={handleDebtSubmit}><label className="field-label" htmlFor="debt-action-amount">Nominal (Rp)</label><div className="currency-input-wrap"><span>Rp</span><input id="debt-action-amount" className="amount-input" inputMode="numeric" type="text" placeholder="0" value={debtAmount} onChange={(event) => setDebtAmount(formatRupiahInput(event.target.value))} required /></div><label className="field-label" htmlFor="debt-action-wallet">{target.debtDirection === "lent" ? debtAction === "add" ? "Ambil uang dari wallet" : "Uang pembayaran masuk ke wallet" : debtAction === "add" ? "Masukkan uang ke wallet" : "Bayar menggunakan wallet"}</label><select id="debt-action-wallet" value={debtCashWalletId} onChange={(event) => setDebtCashWalletId(event.target.value)} required><option value="">Pilih wallet</option>{regularWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} — {rupiah(walletBalances.find((item) => item.id === wallet.id)?.balance ?? 0)}</option>)}</select><p className="wallet-form-hint">{debtAction === "payment" && debtAmount && parseRupiahInput(debtAmount) === outstanding ? "Pembayaran ini akan melunasi utang dan Notes akan otomatis hilang dari daftar wallet. Riwayat tetap tersimpan." : debtAction === "payment" ? "Pembayaran sebagian akan mengurangi sisa utang. Pembayaran penuh akan menutup Notes." : "Nominal akan ditambahkan ke catatan utang yang masih aktif."}</p><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setDebtAction(null)} disabled={debtSaving}>Batal</button><button type="submit" className="primary-button" disabled={debtSaving}>{debtSaving ? "Menyimpan..." : debtAction === "payment" ? "Simpan pembayaran" : "Tambah utang"}</button></div></form></section></div>;
      })()}
      {showWishlistForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowWishlistForm(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="wishlist-modal-title"><div className="modal-heading"><div><div className="section-kicker">WISHLIST BARU</div><h2 id="wishlist-modal-title">Tambah wishlist</h2></div><button className="modal-close" onClick={() => setShowWishlistForm(false)} aria-label="Tutup">×</button></div><form onSubmit={handleWishlistCreate}><label className="field-label" htmlFor="wishlist-name">Nama wishlist</label><input id="wishlist-name" type="text" maxLength={80} placeholder="Contoh: Headphone baru" value={newWishlistName} onChange={(event) => setNewWishlistName(event.target.value)} required /><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setShowWishlistForm(false)}>Batal</button><button type="submit" className="primary-button">Simpan wishlist</button></div></form></section></div>}

      {purchaseTarget && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPurchaseTarget(null); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="wishlist-purchase-title"><div className="modal-heading"><div><div className="section-kicker">KONFIRMASI PEMBELIAN</div><h2 id="wishlist-purchase-title">{purchaseTarget.name}</h2></div><button className="modal-close" onClick={() => setPurchaseTarget(null)} aria-label="Tutup">×</button></div><form onSubmit={handleWishlistPurchase}><label className="field-label" htmlFor="wishlist-price">Harga pembelian (Rp)</label><div className="currency-input-wrap"><span>Rp</span><input id="wishlist-price" className="amount-input" inputMode="numeric" type="text" placeholder="0" value={purchaseAmount} onChange={(event) => setPurchaseAmount(formatRupiahInput(event.target.value))} required /></div><label className="field-label" htmlFor="wishlist-wallet">Bayar menggunakan wallet</label><select id="wishlist-wallet" value={purchaseWalletId} onChange={(event) => setPurchaseWalletId(event.target.value)} required>{regularWallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} — {rupiah(walletBalances.find((entry) => entry.id === wallet.id)?.balance ?? 0)}</option>)}</select><p className="wallet-form-hint">Saldo wallet akan dipotong dan transaksi pengeluaran akan tercatat otomatis.</p><div className="modal-actions"><button type="button" className="cancel-button" onClick={() => setPurchaseTarget(null)}>Batal</button><button type="submit" className="primary-button">Konfirmasi pembelian</button></div></form></section></div>}

      <input ref={photoPickerRef} className="visually-hidden-file" type="file" accept="image/*" onChange={handlePhotoFileChange} />

      {showPhotoEditor && <div className="modal-backdrop photo-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPhotoEditor(false); }}><section className="modal-card photo-editor-card" role="dialog" aria-modal="true" aria-labelledby="photo-editor-title"><div className="modal-heading"><div><div className="section-kicker">ATUR FOTO WALLET</div><h2 id="photo-editor-title">Sesuaikan foto</h2></div><button className="modal-close" onClick={() => setShowPhotoEditor(false)} aria-label="Tutup">×</button></div>
        {pendingPhoto ? <div className="photo-crop-preview"><img src={pendingPhoto} alt="Pratinjau foto wallet" style={{ objectPosition: `${photoX}% ${photoY}%`, transform: `scale(${photoZoom})` }} /></div> : <div className="photo-empty-preview"><span>▧</span><strong>Belum ada foto</strong><p>Pilih foto dari galeri atau perangkatmu.</p></div>}
        <button type="button" className="outline-button photo-choose-button" onClick={() => photoPickerRef.current?.click()}>{pendingPhoto ? "Pilih foto lain" : "Pilih foto"}</button>
        {pendingPhoto && <div className="photo-adjustments"><label>Geser horizontal <input className="photo-range" type="range" min="0" max="100" value={photoX} onChange={(event) => setPhotoX(Number(event.target.value))} /></label><label>Geser vertikal <input className="photo-range" type="range" min="0" max="100" value={photoY} onChange={(event) => setPhotoY(Number(event.target.value))} /></label><label>Zoom <input className="photo-range" type="range" min="1" max="2.5" step="0.05" value={photoZoom} onChange={(event) => setPhotoZoom(Number(event.target.value))} /></label></div>}
        <div className="modal-actions">{pendingPhoto && <button type="button" className="cancel-button" onClick={() => setPendingPhoto("")}>Hapus foto</button>}<button type="button" className="cancel-button" onClick={() => setShowPhotoEditor(false)}>Batal</button><button type="button" className="primary-button" onClick={handlePhotoSave}>Simpan foto</button></div>
      </section></div>}
      {availableUpdate && <div className="modal-backdrop update-backdrop" role="presentation"><section className="modal-card update-modal" role="dialog" aria-modal="true" aria-labelledby="update-modal-title"><div className="update-mark" aria-hidden="true">↻</div><div className="section-kicker">PEMBARUAN CAESH</div><h2 id="update-modal-title">Update CAESH tersedia</h2><p>Versi baru <strong>{availableUpdate.version}</strong> sudah tersedia. Lu bisa update sekarang atau nanti.</p><div className="update-notes"><strong>{availableUpdate.releases.length} pembaruan sejak versi yang terpasang</strong><div className="update-release-list">{availableUpdate.releases.map((release) => <div className="update-release-item" key={release.version}><strong>v{release.version}</strong><span>{release.notes}</span></div>)}</div></div>{updateDownloadProgress !== null && <div className="update-progress"><div className="update-progress-label"><span>{downloadedUpdatePath ? "APK berhasil diunduh" : "Mengunduh pembaruan..."}</span><strong>{updateDownloadProgress}%</strong></div><div className="update-progress-track"><span style={{ width: `${updateDownloadProgress}%` }} /></div></div>}{updateError && <div className="update-error">{updateError}</div>}<div className="modal-actions update-actions"><button type="button" className="cancel-button" onClick={() => setAvailableUpdate(null)} disabled={updateLoading}>Nanti saja</button><button type="button" className="primary-button" onClick={downloadAndInstallUpdate} disabled={updateLoading}>{updateLoading ? "Memproses..." : downloadedUpdatePath ? "Pasang update" : "Download & update"}</button></div><small>Data CAESH tetap tersimpan selama pembaruan dipasang sebagai update dengan tanda tangan yang sama.</small></section></div>}

      {detailWallet && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !detailWalletSaving) setDetailWalletId(null); }}><section className="modal-card wallet-detail-modal" role="dialog" aria-modal="true" aria-labelledby="wallet-detail-title"><div className="modal-heading"><div><div className="section-kicker">INFORMASI WALLET</div><h2 id="wallet-detail-title">{detailWallet.name}</h2></div><button className="modal-close" onClick={() => setDetailWalletId(null)} aria-label="Tutup detail wallet" disabled={detailWalletSaving}>×</button></div>
        <div className="wallet-detail-balance"><span>{detailWallet.category === "notes" ? "Sisa utang" : "Saldo saat ini"}</span><strong>{displayNominal(detailWallet.category === "notes" ? Math.abs(detailWalletBalance) : detailWalletBalance, detailWallet.category !== "notes" && isWalletNominalHidden(detailWallet.id))}</strong></div>
        {detailWallet.category === "notes" ? <div className="debt-detail-actions"><p>{detailWallet.debtDirection === "lent" ? "Orang ini masih berutang ke lu." : "Lu masih punya utang ke orang ini."}</p><div className="modal-actions"><button type="button" className="outline-button" onClick={() => openDebtAction(detailWallet, "payment")}>Bayar</button><button type="button" className="outline-button" onClick={() => openDebtAction(detailWallet, "add")}>＋ Tambah utang</button><button type="button" className="primary-button" onClick={() => setSettleDebtTarget(detailWallet)}>Selesaikan utang</button></div></div> : <div className="wallet-detail-totals"><div><span>Total pemasukan</span><strong className="income">{displayNominal(detailWalletIncome, isWalletNominalHidden(detailWallet.id))}</strong></div><div><span>Total pengeluaran</span><strong className="expense">{displayNominal(detailWalletExpense, isWalletNominalHidden(detailWallet.id))}</strong></div></div>}
        <div className="wallet-detail-history"><div className="panel-heading"><h3>Riwayat wallet</h3><span className="result-count">{detailWalletTransactions.length} transaksi</span></div>
          {detailWalletTransactions.length === 0 ? <div className="empty-state">Belum ada riwayat transaksi untuk wallet ini.</div> : <div className="transaction-list">{detailWalletTransactions.map((item) => { const incomingTransfer = item.kind === "transfer" && item.toWalletId === detailWallet.id; const outgoingTransfer = item.kind === "transfer" && item.walletId === detailWallet.id; const title = item.note || item.category || (item.kind === "transfer" ? "Transfer" : "Transaksi"); const amountPrefix = item.kind === "income" || incomingTransfer ? "+" : item.kind === "expense" || outgoingTransfer ? "−" : ""; const relatedWallet = incomingTransfer ? item.walletName ?? walletName(item.walletId) : outgoingTransfer ? item.toWalletName ?? walletName(item.toWalletId ?? "") : ""; return <div className="transaction-row" key={item.id}><div className={`transaction-icon ${item.kind}`}>{item.kind === "income" ? "↙" : item.kind === "expense" ? "↗" : "⇄"}</div><div className="transaction-info"><strong>{title}</strong><span>{item.kind === "transfer" ? `${incomingTransfer ? "Dari" : "Ke"} ${relatedWallet}` : item.category} · {new Date(item.date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span></div><div className={`transaction-amount ${item.kind}`}>{isWalletNominalHidden(detailWallet.id) ? "••••••" : `${amountPrefix}${rupiah(item.amount)}`}</div></div>; })}</div>}
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
