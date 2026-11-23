export type TransactionKind = "income" | "expense";

export type Transaction = {
  id: string;
  kind: TransactionKind;
  amount: number;
  category: string;
  note: string;
  date: string;
  createdAt: number;
};

const DB_NAME = "caesh-local";
const STORE_NAME = "transactions";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("Browser ini tidak mendukung IndexedDB."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("date", "date", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Gagal membuka database lokal."));
  });
}

export async function getTransactions(): Promise<Transaction[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
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
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(transaction);
    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error ?? new Error("Gagal menyimpan transaksi."));
    };
  });
}

export async function removeTransaction(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id);
    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error ?? new Error("Gagal menghapus transaksi."));
    };
  });
}
