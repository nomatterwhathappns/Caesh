export type TransactionKind = "income" | "expense" | "transfer";
export type WalletCategory = "standard" | "notes";
export type DebtDirection = "lent" | "borrowed";
export type WishlistStatus = "pending" | "purchased";
export type WishlistItem = {
  id: string;
  name: string;
  status: WishlistStatus;
  createdAt: number;
  purchasedAt?: number;
  purchaseAmount?: number;
  walletId?: string;
  transactionId?: string;
};

export type Wallet = {
  id: string;
  name: string;
  initialBalance: number;
  createdAt: number;
  photo?: string;
  photoX?: number;
  photoY?: number;
  photoZoom?: number;
  note?: string;
  category?: WalletCategory;
  debtDirection?: DebtDirection;
};

export type Transaction = {
  id: string;
  kind: TransactionKind;
  amount: number;
  category: string;
  note: string;
  date: string;
  walletId: string;
  walletName?: string;
  toWalletId?: string;
  toWalletName?: string;
  createdAt: number;
};

const DB_NAME = "caesh-local";
const TRANSACTION_STORE = "transactions";
const WALLET_STORE = "wallets";
const WISHLIST_STORE = "wishlist";
// Increase this version only when adding a deliberate, backward-preserving migration.
// Never delete/recreate existing stores during an ordinary app update.
const DB_VERSION = 3;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("Browser ini tidak mendukung IndexedDB."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let settled = false;
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction;
      if (!db.objectStoreNames.contains(TRANSACTION_STORE)) {
        const store = db.createObjectStore(TRANSACTION_STORE, { keyPath: "id" });
        store.createIndex("date", "date", { unique: false });
      }
      if (!db.objectStoreNames.contains(WISHLIST_STORE)) {
        db.createObjectStore(WISHLIST_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(WALLET_STORE)) {
        const wallets = db.createObjectStore(WALLET_STORE, { keyPath: "id" });
        const defaultWallet: Wallet = {
          id: "wallet-default",
          name: "Wallet Utama",
          initialBalance: 0,
          createdAt: Date.now(),
        };
        wallets.put(defaultWallet);

        // Existing transactions are retained and assigned to the migrated default wallet.
        if (event.oldVersion < 2 && tx) {
          const transactionStore = tx.objectStore(TRANSACTION_STORE);
          const cursorRequest = transactionStore.openCursor();
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            const oldTransaction = cursor.value as Transaction & { walletId?: string };
            if (!oldTransaction.walletId) {
              oldTransaction.walletId = defaultWallet.id;
              cursor.update(oldTransaction);
            }
            cursor.continue();
          };
        }
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // A blocked request can still complete after the caller has been notified.
      if (settled) { db.close(); return; }
      settled = true;
      // Close stale connections before another tab/app version attempts a schema upgrade.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(new Error("Pembaruan struktur database tertahan. Tutup tab Caesh lain, lalu coba lagi."));
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(request.error ?? new Error("Gagal membuka database lokal. Data lama tidak dihapus."));
    };
  });
}

export async function getWallets(): Promise<Wallet[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(WALLET_STORE, "readonly").objectStore(WALLET_STORE).getAll();
    request.onsuccess = () => {
      db.close();
      resolve((request.result as Wallet[]).sort((a, b) => a.createdAt - b.createdAt));
    };
    request.onerror = () => {
      db.close();
      reject(request.error ?? new Error("Gagal membaca wallet."));
    };
  });
}

export async function saveWallet(wallet: Wallet): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(WALLET_STORE, "readwrite").objectStore(WALLET_STORE).put(wallet);
    request.onsuccess = () => { db.close(); resolve(); };
    request.onerror = () => {
      db.close();
      reject(request.error ?? new Error("Gagal menyimpan wallet."));
    };
  });
}

export async function removeWallet(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([WALLET_STORE, TRANSACTION_STORE], "readwrite");
    const walletStore = tx.objectStore(WALLET_STORE);
    const transactionStore = tx.objectStore(TRANSACTION_STORE);
    let failure: Error | null = null;
    const walletsRequest = walletStore.getAll();
    const transactionsRequest = transactionStore.getAll();

    walletsRequest.onsuccess = () => {
      const wallets = walletsRequest.result as Wallet[];
      if (wallets.filter((item) => item.category !== "notes").length <= 1) {
        failure = new Error("Caesh harus memiliki minimal satu wallet.");
        tx.abort();
        return;
      }
      const wallet = wallets.find((item) => item.id === id);
      if (!wallet) {
        failure = new Error("Wallet tidak ditemukan.");
        tx.abort();
        return;
      }
      if (wallet.category === "notes") {
        failure = new Error("Notes utang hanya dapat ditutup melalui pembayaran lunas.");
        tx.abort();
        return;
      }
      if (transactionsRequest.readyState !== "done") return;
      const transactions = transactionsRequest.result as Transaction[];
      transactions.forEach((item) => {
        let changed = false;
        if (item.walletId === id) {
          item.walletName = wallet.name;
          changed = true;
        }
        if (item.toWalletId === id) {
          item.toWalletName = wallet.name;
          changed = true;
        }
        if (changed) transactionStore.put(item);
      });
      walletStore.delete(id);
    };

    transactionsRequest.onsuccess = () => {
      if (walletsRequest.readyState !== "done") return;
      const wallets = walletsRequest.result as Wallet[];
      if (wallets.filter((item) => item.category !== "notes").length <= 1) {
        failure = new Error("Caesh harus memiliki minimal satu wallet.");
        tx.abort();
        return;
      }
      const wallet = wallets.find((item) => item.id === id);
      if (!wallet) {
        failure = new Error("Wallet tidak ditemukan.");
        tx.abort();
        return;
      }
      if (wallet.category === "notes") {
        failure = new Error("Notes utang hanya dapat ditutup melalui pembayaran lunas.");
        tx.abort();
        return;
      }
      const transactions = transactionsRequest.result as Transaction[];
      transactions.forEach((item) => {
        let changed = false;
        if (item.walletId === id) {
          item.walletName = wallet.name;
          changed = true;
        }
        if (item.toWalletId === id) {
          item.toWalletName = wallet.name;
          changed = true;
        }
        if (changed) transactionStore.put(item);
      });
      walletStore.delete(id);
    };

    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => {
      db.close();
      reject(failure ?? tx.error ?? new Error("Wallet gagal dihapus."));
    };
    tx.onerror = () => {
      failure = failure ?? tx.error ?? new Error("Wallet gagal dihapus.");
    };
  });
}


function calculateWalletBalance(wallet: Wallet, transactions: Transaction[]): number {
  const movement = transactions.reduce((sum, item) => {
    if (item.kind === "transfer") {
      if (item.walletId === wallet.id) return sum - item.amount;
      if (item.toWalletId === wallet.id) return sum + item.amount;
      return sum;
    }
    return item.walletId === wallet.id ? sum + (item.kind === "income" ? item.amount : -item.amount) : sum;
  }, 0);
  return wallet.initialBalance + movement;
}

function validateDebtTransfer(transaction: Transaction, noteWallet: Wallet, action: "add" | "payment"): string {
  if (transaction.kind !== "transfer" || transaction.category !== "Utang"
    || !Number.isSafeInteger(transaction.amount) || transaction.amount <= 0) {
    throw new Error("Data transaksi utang tidak valid.");
  }
  const direction = noteWallet.debtDirection;
  if (noteWallet.category !== "notes" || !direction) throw new Error("Wallet Notes tidak valid.");
  const noteIsSource = transaction.walletId === noteWallet.id;
  const noteIsDestination = transaction.toWalletId === noteWallet.id;
  if (noteIsSource === noteIsDestination) throw new Error("Arah transaksi utang tidak valid.");
  const expectedNoteSource = action === "add" ? direction === "borrowed" : direction === "lent";
  if (noteIsSource !== expectedNoteSource) throw new Error("Arah perpindahan uang tidak sesuai dengan jenis utang.");
  return noteIsSource ? (transaction.toWalletId ?? "") : transaction.walletId;
}

/** Create a Notes wallet and its first cash movement atomically. */
export async function createDebtNote(wallet: Wallet, transaction: Transaction): Promise<void> {
  if (wallet.category !== "notes" || !wallet.debtDirection || wallet.initialBalance !== 0 || !wallet.name.trim()) {
    throw new Error("Data Notes baru tidak valid.");
  }
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([WALLET_STORE, TRANSACTION_STORE], "readwrite");
    const walletStore = tx.objectStore(WALLET_STORE);
    const transactionStore = tx.objectStore(TRANSACTION_STORE);
    const walletsRequest = walletStore.getAll();
    const transactionsRequest = transactionStore.getAll();
    let failure: Error | null = null;
    let processed = false;
    const process = () => {
      if (processed || walletsRequest.readyState !== "done" || transactionsRequest.readyState !== "done") return;
      processed = true;
      try {
        const wallets = walletsRequest.result as Wallet[];
        const transactions = transactionsRequest.result as Transaction[];
        if (wallets.some((item) => item.category === "notes" && item.name.trim().toLocaleLowerCase() === wallet.name.trim().toLocaleLowerCase())) {
          throw new Error("Notes untuk orang ini masih aktif. Tambahkan utangnya dari Notes yang sudah ada.");
        }
        const cashWalletId = validateDebtTransfer(transaction, wallet, "add");
        const cashWallet = wallets.find((item) => item.id === cashWalletId && item.category !== "notes");
        if (!cashWallet) throw new Error("Pilih wallet biasa yang masih aktif.");
        if (wallets.some((item) => item.id === wallet.id) || transactions.some((item) => item.id === transaction.id)) {
          throw new Error("ID data utang sudah digunakan. Coba lagi.");
        }
        if (wallet.debtDirection === "lent" && calculateWalletBalance(cashWallet, transactions) < transaction.amount) {
          throw new Error("Saldo wallet sumber tidak mencukupi untuk memberikan utang.");
        }
        walletStore.add(wallet);
        transactionStore.add(transaction);
      } catch (reason) {
        failure = reason instanceof Error ? reason : new Error("Notes gagal dibuat.");
        try { tx.abort(); } catch { /* The transaction may already be aborting. */ }
      }
    };
    walletsRequest.onsuccess = process;
    transactionsRequest.onsuccess = process;
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(failure ?? tx.error ?? new Error("Notes gagal dibuat.")); };
    tx.onerror = () => { failure = failure ?? tx.error ?? new Error("Notes gagal dibuat."); };
  });
}

/** Add debt or record a payment, updating the Notes wallet and history in one transaction. */
export async function recordDebtMovement(
  noteWalletId: string,
  transaction: Transaction,
  action: "add" | "payment",
): Promise<{ closed: boolean; remaining: number }> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([WALLET_STORE, TRANSACTION_STORE], "readwrite");
    const walletStore = tx.objectStore(WALLET_STORE);
    const transactionStore = tx.objectStore(TRANSACTION_STORE);
    const walletsRequest = walletStore.getAll();
    const transactionsRequest = transactionStore.getAll();
    let failure: Error | null = null;
    let result: { closed: boolean; remaining: number } = { closed: false, remaining: 0 };
    let processed = false;
    const process = () => {
      if (processed || walletsRequest.readyState !== "done" || transactionsRequest.readyState !== "done") return;
      processed = true;
      try {
        const wallets = walletsRequest.result as Wallet[];
        const transactions = transactionsRequest.result as Transaction[];
        const noteWallet = wallets.find((item) => item.id === noteWalletId);
        if (!noteWallet || noteWallet.category !== "notes" || !noteWallet.debtDirection) {
          throw new Error("Notes ini sudah lunas atau tidak ditemukan.");
        }
        const cashWalletId = validateDebtTransfer(transaction, noteWallet, action);
        const cashWallet = wallets.find((item) => item.id === cashWalletId && item.category !== "notes");
        if (!cashWallet) throw new Error("Pilih wallet biasa yang masih aktif.");
        if (transactions.some((item) => item.id === transaction.id)) throw new Error("ID transaksi sudah digunakan. Coba lagi.");
        const current = calculateWalletBalance(noteWallet, transactions);
        const sign = noteWallet.debtDirection === "lent" ? 1 : -1;
        if ((noteWallet.debtDirection === "lent" && current <= 0) || (noteWallet.debtDirection === "borrowed" && current >= 0)) {
          throw new Error("Saldo Notes tidak sesuai. Periksa riwayat utangnya terlebih dahulu.");
        }
        const remainingBefore = Math.abs(current);
        if (action === "payment" && transaction.amount > remainingBefore) {
          throw new Error("Nominal pembayaran melebihi sisa utang.");
        }
        if ((action === "add" && noteWallet.debtDirection === "lent")
          || (action === "payment" && noteWallet.debtDirection === "borrowed")) {
          if (calculateWalletBalance(cashWallet, transactions) < transaction.amount) {
            throw new Error(action === "add" ? "Saldo wallet sumber tidak mencukupi untuk memberikan utang." : "Saldo wallet tidak mencukupi untuk membayar utang.");
          }
        }
        const signedChange = action === "add" ? sign * transaction.amount : -sign * transaction.amount;
        const nextBalance = current + signedChange;
        if (action === "add" && nextBalance * sign <= 0) throw new Error("Penambahan utang menghasilkan saldo yang tidak valid.");
        if (action === "payment" && nextBalance * sign < 0) throw new Error("Nominal pembayaran melebihi sisa utang.");
        transactionStore.add(transaction);
        const closed = action === "payment" && nextBalance === 0;
        if (closed) walletStore.delete(noteWalletId);
        result = { closed, remaining: Math.abs(nextBalance) };
      } catch (reason) {
        failure = reason instanceof Error ? reason : new Error("Transaksi utang gagal disimpan.");
        try { tx.abort(); } catch { /* The transaction may already be aborting. */ }
      }
    };
    walletsRequest.onsuccess = process;
    transactionsRequest.onsuccess = process;
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = () => { db.close(); reject(failure ?? tx.error ?? new Error("Transaksi utang gagal disimpan.")); };
    tx.onerror = () => { failure = failure ?? tx.error ?? new Error("Transaksi utang gagal disimpan."); };
  });
}

export async function getTransactions(): Promise<Transaction[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(TRANSACTION_STORE, "readonly").objectStore(TRANSACTION_STORE).getAll();
    request.onsuccess = () => {
      db.close();
      resolve((request.result as Transaction[]).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt));
    };
    request.onerror = () => {
      db.close();
      reject(request.error ?? new Error("Gagal membaca transaksi."));
    };
  });
}

export async function saveTransaction(transaction: Transaction): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(TRANSACTION_STORE, "readwrite").objectStore(TRANSACTION_STORE).put(transaction);
    request.onsuccess = () => { db.close(); resolve(); };
    request.onerror = () => {
      db.close();
      reject(request.error ?? new Error("Gagal menyimpan transaksi."));
    };
  });
}

export async function removeTransaction(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const store = db.transaction(TRANSACTION_STORE, "readwrite").objectStore(TRANSACTION_STORE);
    const lookup = store.get(id);
    lookup.onsuccess = () => {
      const target = lookup.result as Transaction | undefined;
      if (target?.category === "Utang") {
        db.close();
        reject(new Error("Riwayat utang tidak dapat dihapus langsung agar saldo dan pelunasan tetap akurat."));
        return;
      }
      const request = store.delete(id);
      request.onsuccess = () => { db.close(); resolve(); };
      request.onerror = () => {
        db.close();
        reject(request.error ?? new Error("Gagal menghapus transaksi."));
      };
    };
    lookup.onerror = () => {
      db.close();
      reject(lookup.error ?? new Error("Transaksi gagal diperiksa sebelum dihapus."));
    };
  });
}


export async function getWishlist(): Promise<WishlistItem[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(WISHLIST_STORE, "readonly").objectStore(WISHLIST_STORE).getAll();
    request.onsuccess = () => {
      db.close();
      resolve((request.result as WishlistItem[]).sort((a, b) => b.createdAt - a.createdAt));
    };
    request.onerror = () => {
      db.close();
      reject(request.error ?? new Error("Gagal membaca wishlist."));
    };
  });
}

export async function saveWishlist(item: WishlistItem): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(WISHLIST_STORE, "readwrite").objectStore(WISHLIST_STORE).put(item);
    request.onsuccess = () => { db.close(); resolve(); };
    request.onerror = () => {
      db.close();
      reject(request.error ?? new Error("Wishlist gagal disimpan."));
    };
  });
}

export async function removeWishlist(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(WISHLIST_STORE, "readwrite").objectStore(WISHLIST_STORE).delete(id);
    request.onsuccess = () => { db.close(); resolve(); };
    request.onerror = () => {
      db.close();
      reject(request.error ?? new Error("Wishlist gagal dihapus."));
    };
  });
}

export async function purchaseWishlist(item: WishlistItem, transaction: Transaction): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([WISHLIST_STORE, TRANSACTION_STORE], "readwrite");
    tx.objectStore(WISHLIST_STORE).put(item);
    tx.objectStore(TRANSACTION_STORE).put(transaction);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error("Pembelian wishlist gagal disimpan."));
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Pembelian wishlist gagal disimpan."));
    };
  });
}


export type CaeshBackup = {
  format: "caesh-backup";
  formatVersion: 1;
  databaseVersion: number;
  exportedAt: string;
  transactions: Transaction[];
  wallets: Wallet[];
  wishlist: WishlistItem[];
  preferences: {
    theme?: string | null;
    categories?: string | null;
  };
};

function readAll<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error ?? new Error("Data lokal gagal dibaca."));
  });
}

export async function createBackup(): Promise<CaeshBackup> {
  const db = await openDatabase();
  try {
    const tx = db.transaction([TRANSACTION_STORE, WALLET_STORE, WISHLIST_STORE], "readonly");
    const [transactions, wallets, wishlist] = await Promise.all([
      readAll<Transaction>(tx.objectStore(TRANSACTION_STORE)),
      readAll<Wallet>(tx.objectStore(WALLET_STORE)),
      readAll<WishlistItem>(tx.objectStore(WISHLIST_STORE)),
    ]);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("Backup gagal dibaca."));
      tx.onerror = () => reject(tx.error ?? new Error("Backup gagal dibaca."));
    });
    return {
      format: "caesh-backup",
      formatVersion: 1,
      databaseVersion: DB_VERSION,
      exportedAt: new Date().toISOString(),
      transactions,
      wallets,
      wishlist,
      preferences: {
        theme: typeof localStorage !== "undefined" ? localStorage.getItem("caesh-theme") : null,
        categories: typeof localStorage !== "undefined" ? localStorage.getItem("caesh-categories") : null,
      },
    };
  } finally {
    db.close();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWallet(value: unknown): value is Wallet {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0
    && typeof value.name === "string"
    && Number.isSafeInteger(value.initialBalance) && Number(value.initialBalance) >= 0
    && Number.isFinite(value.createdAt)
    && (value.photo === undefined || typeof value.photo === "string")
    && (value.photoX === undefined || (typeof value.photoX === "number" && Number.isFinite(value.photoX)))
    && (value.photoY === undefined || (typeof value.photoY === "number" && Number.isFinite(value.photoY)))
    && (value.photoZoom === undefined || (typeof value.photoZoom === "number" && Number.isFinite(value.photoZoom)))
    && (value.category === undefined || value.category === "standard" || value.category === "notes")
    && (value.debtDirection === undefined || value.debtDirection === "lent" || value.debtDirection === "borrowed")
    && (value.category !== "notes" || (value.debtDirection === "lent" || value.debtDirection === "borrowed"));
}

function isTransaction(value: unknown): value is Transaction {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0
    && (value.kind === "income" || value.kind === "expense" || value.kind === "transfer")
    && Number.isSafeInteger(value.amount) && Number(value.amount) >= 0
    && typeof value.category === "string"
    && typeof value.note === "string"
    && typeof value.date === "string"
    && typeof value.walletId === "string"
    && Number.isFinite(value.createdAt)
    && (value.walletName === undefined || typeof value.walletName === "string")
    && (value.toWalletId === undefined || typeof value.toWalletId === "string")
    && (value.toWalletName === undefined || typeof value.toWalletName === "string");
}

function isWishlistItem(value: unknown): value is WishlistItem {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0
    && typeof value.name === "string"
    && (value.status === "pending" || value.status === "purchased")
    && Number.isFinite(value.createdAt)
    && (value.purchasedAt === undefined || Number.isFinite(value.purchasedAt))
    && (value.purchaseAmount === undefined || (typeof value.purchaseAmount === "number" && Number.isSafeInteger(value.purchaseAmount) && value.purchaseAmount >= 0))
    && (value.walletId === undefined || typeof value.walletId === "string")
    && (value.transactionId === undefined || typeof value.transactionId === "string");
}

function validateBackup(value: unknown): CaeshBackup {
  if (!isRecord(value) || value.format !== "caesh-backup" || value.formatVersion !== 1
    || !Array.isArray(value.transactions) || !Array.isArray(value.wallets) || !Array.isArray(value.wishlist)
    || !value.transactions.every(isTransaction) || !value.wallets.every(isWallet) || !value.wishlist.every(isWishlistItem)
    || !isRecord(value.preferences)
    || (value.preferences.theme !== undefined && value.preferences.theme !== null && value.preferences.theme !== "light" && value.preferences.theme !== "dark")
    || (value.preferences.categories !== undefined && value.preferences.categories !== null && typeof value.preferences.categories !== "string")) {
    throw new Error("File backup tidak valid atau formatnya tidak didukung. Data yang sekarang tetap aman.");
  }
  const walletIds = new Set(value.wallets.map((wallet) => (wallet as Wallet).id));
  const transactionIds = new Set(value.transactions.map((item) => (item as Transaction).id));
  const wishlistIds = new Set(value.wishlist.map((item) => (item as WishlistItem).id));
  if (walletIds.size !== value.wallets.length || transactionIds.size !== value.transactions.length
    || wishlistIds.size !== value.wishlist.length) {
    throw new Error("Backup memiliki ID data ganda. Data yang sekarang tetap aman.");
  }
  return value as unknown as CaeshBackup;
}

export async function restoreBackup(input: unknown): Promise<CaeshBackup> {
  const backup = validateBackup(input);
  if (!backup.wallets.some((wallet) => wallet.category !== "notes")) {
    throw new Error("Backup harus memiliki minimal satu wallet biasa. Pemulihan dibatalkan agar pembayaran utang tetap bisa dilakukan.");
  }
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([TRANSACTION_STORE, WALLET_STORE, WISHLIST_STORE], "readwrite");
      const transactionStore = tx.objectStore(TRANSACTION_STORE);
      const walletStore = tx.objectStore(WALLET_STORE);
      const wishlistStore = tx.objectStore(WISHLIST_STORE);
      transactionStore.clear();
      walletStore.clear();
      wishlistStore.clear();
      backup.transactions.forEach((item) => transactionStore.put(item));
      backup.wallets.forEach((item) => walletStore.put(item));
      backup.wishlist.forEach((item) => wishlistStore.put(item));
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("Pemulihan gagal. Data sebelumnya tetap dipertahankan."));
      tx.onerror = () => reject(tx.error ?? new Error("Pemulihan gagal. Data sebelumnya tetap dipertahankan."));
    });
    if (typeof localStorage !== "undefined") {
      try {
        if (backup.preferences.theme !== undefined && backup.preferences.theme !== null) {
          localStorage.setItem("caesh-theme", backup.preferences.theme);
        }
        if (backup.preferences.categories !== undefined && backup.preferences.categories !== null) {
          localStorage.setItem("caesh-categories", backup.preferences.categories);
        }
      } catch {
        // Financial records have already been restored atomically; preferences are optional.
      }
    }
    return backup;
  } finally {
    db.close();
  }
}
