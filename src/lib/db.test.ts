import "fake-indexeddb/auto";
Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
const testStorage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => testStorage.get(key) ?? null,
    setItem: (key: string, value: string) => { testStorage.set(key, String(value)); },
    removeItem: (key: string) => { testStorage.delete(key); },
  },
});
import assert from "node:assert/strict";
import { test } from "node:test";
import { createBackup, getTransactions, getWallets, getWishlist, restoreBackup, Transaction, Wallet, WishlistItem } from "./db";

const DB_NAME = "caesh-local";
function openSeedDatabase(version: number, seed: (db: IDBDatabase) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, version);
    request.onupgradeneeded = () => seed(request.result);
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error);
  });
}
function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Test database deletion was blocked."));
  });
}
const oldTransaction = (overrides: Partial<Transaction> = {}) => ({
  id: "tx-old", kind: "expense" as const, amount: 25000, category: "Makanan",
  note: "Makan", date: "2026-01-01", createdAt: 1767225600000, ...overrides,
});
const wallet: Wallet = {
  id: "wallet-main", name: "Wallet Utama", initialBalance: 100000,
  createdAt: 1767225600000, photo: "data:image/jpeg;base64,dGVzdA==",
  photoX: 45, photoY: 55, photoZoom: 1.2,
};
const wishlistItem: WishlistItem = {
  id: "wish-1", name: "Headphone", status: "purchased", createdAt: 1767225600000,
  purchasedAt: 1767312000000, purchaseAmount: 50000, walletId: wallet.id, transactionId: "tx-wish",
};

test("upgrade from database v1 preserves transactions and assigns the default wallet", async () => {
  await deleteDatabase();
  await openSeedDatabase(1, (db) => {
    const store = db.createObjectStore("transactions", { keyPath: "id" });
    store.createIndex("date", "date", { unique: false });
    store.put(oldTransaction());
  });
  const wallets = await getWallets();
  const transactions = await getTransactions();
  assert.equal(wallets.length, 1);
  assert.equal(wallets[0].id, "wallet-default");
  assert.equal(transactions.length, 1);
  assert.equal(transactions[0].walletId, "wallet-default");
  assert.deepEqual(await getWishlist(), []);
});

test("upgrade from database v2 preserves populated wallets and transactions", async () => {
  await deleteDatabase();
  await openSeedDatabase(2, (db) => {
    const transactions = db.createObjectStore("transactions", { keyPath: "id" });
    transactions.createIndex("date", "date", { unique: false });
    transactions.put(oldTransaction({ walletId: wallet.id }));
    db.createObjectStore("wallets", { keyPath: "id" }).put(wallet);
  });
  assert.deepEqual(await getWallets(), [wallet]);
  assert.equal((await getTransactions())[0].id, "tx-old");
  assert.deepEqual(await getWishlist(), []);
});

test("opening an existing v3 database preserves wallet photos, transactions, and wishlist", async () => {
  await deleteDatabase();
  await openSeedDatabase(3, (db) => {
    const transactions = db.createObjectStore("transactions", { keyPath: "id" });
    transactions.createIndex("date", "date", { unique: false });
    transactions.put(oldTransaction({ walletId: wallet.id }));
    db.createObjectStore("wallets", { keyPath: "id" }).put(wallet);
    db.createObjectStore("wishlist", { keyPath: "id" }).put(wishlistItem);
  });
  assert.deepEqual(await getWallets(), [wallet]);
  assert.equal((await getTransactions())[0].walletId, wallet.id);
  assert.deepEqual(await getWishlist(), [wishlistItem]);
});

test("backup and restore round-trip all financial records and wallet photos", async () => {
  await deleteDatabase();
  const original = {
    format: "caesh-backup" as const, formatVersion: 1 as const, databaseVersion: 3,
    exportedAt: new Date().toISOString(),
    transactions: [oldTransaction({ walletId: wallet.id })],
    wallets: [wallet], wishlist: [wishlistItem],
    preferences: { theme: "dark", categories: JSON.stringify({ income: ["Gaji"], expense: ["Makanan"] }) },
  };
  await restoreBackup(original);
  const exported = await createBackup();
  assert.deepEqual(exported.transactions, original.transactions);
  assert.deepEqual(exported.wallets, original.wallets);
  assert.deepEqual(exported.wishlist, original.wishlist);
  assert.equal(exported.preferences.theme, "dark");
  const replacement = {
    ...original,
    transactions: [oldTransaction({ id: "tx-new", amount: 90000, walletId: wallet.id })],
    wishlist: [],
  };
  await restoreBackup(replacement);
  const restored = await createBackup();
  assert.deepEqual(restored.transactions, replacement.transactions);
  assert.deepEqual(restored.wallets, original.wallets);
  assert.deepEqual(restored.wishlist, []);
});

test("invalid or empty-wallet backups are rejected without changing existing records", async () => {
  await deleteDatabase();
  const original = {
    format: "caesh-backup" as const, formatVersion: 1 as const, databaseVersion: 3,
    exportedAt: new Date().toISOString(),
    transactions: [oldTransaction({ walletId: wallet.id })],
    wallets: [wallet], wishlist: [wishlistItem],
    preferences: { theme: "light", categories: null },
  };
  await restoreBackup(original);
  await assert.rejects(() => restoreBackup({ ...original, wallets: [] }), /tidak memiliki wallet/);
  await assert.rejects(() => restoreBackup({ format: "wrong" }), /tidak valid/);
  assert.deepEqual(await getTransactions(), original.transactions);
  assert.deepEqual(await getWallets(), original.wallets);
  assert.deepEqual(await getWishlist(), original.wishlist);
});
