export type TransactionKind = "income" | "expense" | "transfer";

export type Wallet = {
  id: string;
  name: string;
  initialBalance: number;
  createdAt: number;
  photo?: string;
  photoX?: number;
  photoY?: number;
  photoZoom?: number;
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
const DB_VERSION = 2;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("Browser ini tidak mendukung IndexedDB."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction;
      if (!db.objectStoreNames.contains(TRANSACTION_STORE)) {
        const store = db.createObjectStore(TRANSACTION_STORE, { keyPath: "id" });
        store.createIndex("date", "date", { unique: false });
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
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Gagal membuka database lokal."));
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
      if (wallets.length <= 1) {
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
      if (wallets.length <= 1) {
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
    const request = db.transaction(TRANSACTION_STORE, "readwrite").objectStore(TRANSACTION_STORE).delete(id);
    request.onsuccess = () => { db.close(); resolve(); };
    request.onerror = () => {
      db.close();
      reject(request.error ?? new Error("Gagal menghapus transaksi."));
    };
  });
}
