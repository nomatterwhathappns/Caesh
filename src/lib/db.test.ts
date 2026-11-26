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
import { createBackup, createDebtNote, getTransactions, getWallets, getWishlist, recordDebtMovement, removeTransaction, settleDebtNote, restoreBackup, Transaction, Wallet, WishlistItem } from "./db";

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
  await assert.rejects(() => restoreBackup({ ...original, wallets: [] }), /minimal satu wallet biasa/);
  await assert.rejects(() => restoreBackup({ ...original, wallets: [{ ...wallet, initialBalance: 0, category: "notes" as const, debtDirection: "lent" as const }] }), /minimal satu wallet biasa/);
  await assert.rejects(() => restoreBackup({ format: "wrong" }), /tidak valid/);
  assert.deepEqual(await getTransactions(), original.transactions);
  assert.deepEqual(await getWallets(), original.wallets);
  assert.deepEqual(await getWishlist(), original.wishlist);
});


const cashWallet: Wallet = { id: "cash-main", name: "BCA", initialBalance: 1000000, createdAt: 1767225600000 };
function debtTransaction(
  id: string,
  amount: number,
  walletId: string,
  walletName: string,
  toWalletId: string,
  toWalletName: string,
  note: string,
): Transaction {
  return {
    id, kind: "transfer", amount, category: "Utang", note,
    date: "2026-01-02", walletId, walletName, toWalletId, toWalletName,
    createdAt: 1767312000000,
  };
}
async function seedDebtDatabase() {
  await deleteDatabase();
  await openSeedDatabase(3, (db) => {
    const transactions = db.createObjectStore("transactions", { keyPath: "id" });
    transactions.createIndex("date", "date", { unique: false });
    db.createObjectStore("wallets", { keyPath: "id" }).put(cashWallet);
    db.createObjectStore("wishlist", { keyPath: "id" });
  });
}

test("lent debt supports adding before settlement, partial payment, and auto-closes at zero", async () => {
  await seedDebtDatabase();
  const note: Wallet = { id: "notes-andi", name: "Andi", initialBalance: 0, createdAt: 1767312000000, category: "notes", debtDirection: "lent" };
  await createDebtNote(note, debtTransaction("debt-1", 500000, cashWallet.id, cashWallet.name, note.id, note.name, "Utang diberikan"));
  await recordDebtMovement(note.id, debtTransaction("debt-2", 100000, cashWallet.id, cashWallet.name, note.id, note.name, "Tambahan utang"), "add");
  await recordDebtMovement(note.id, debtTransaction("debt-3", 200000, note.id, note.name, cashWallet.id, cashWallet.name, "Pembayaran sebagian"), "payment");
  let wallets = await getWallets();
  let transactions = await getTransactions();
  assert.equal(wallets.find((item) => item.id === note.id)?.id, note.id);
  assert.equal(transactions.length, 3);
  const noteBalance = transactions.reduce((sum, item) => sum + (item.toWalletId === note.id ? item.amount : item.walletId === note.id ? -item.amount : 0), 0);
  assert.equal(noteBalance, 400000);
  const closed = await recordDebtMovement(note.id, debtTransaction("debt-4", 400000, note.id, note.name, cashWallet.id, cashWallet.name, "Pelunasan"), "payment");
  wallets = await getWallets();
  transactions = await getTransactions();
  assert.deepEqual(closed, { closed: true, remaining: 0 });
  assert.equal(wallets.some((item) => item.id === note.id), false);
  assert.equal(transactions.length, 5);
  const closure = transactions.find((item) => item.debtAction === "settled");
  assert.equal(closure?.note, "Utang lunas");
  assert.equal(closure?.debtInitialAmount, 600000);
  assert.equal(closure?.debtPaidAmount, 600000);
  assert.equal(closure?.debtRemainingAmount, 0);
  assert.equal(transactions.every((item) => item.category === "Utang"), true);
  assert.equal(transactions.every((item) => item.walletName === note.name || item.toWalletName === note.name), true);
  const nextNote: Wallet = { id: "notes-andi-new", name: "Andi", initialBalance: 0, createdAt: 1768003200000, category: "notes", debtDirection: "lent" };
  await createDebtNote(nextNote, debtTransaction("debt-5", 50000, cashWallet.id, cashWallet.name, nextNote.id, nextNote.name, "Utang baru setelah lunas"));
  wallets = await getWallets();
  transactions = await getTransactions();
  assert.equal(wallets.some((item) => item.id === nextNote.id), true);
  assert.equal(wallets.some((item) => item.id === note.id), false);
  assert.equal(transactions.length, 6);
});

test("borrowed debt increases destination cash and repayment decreases it without double counting", async () => {
  await seedDebtDatabase();
  const note: Wallet = { id: "notes-budi", name: "Budi", initialBalance: 0, createdAt: 1767312000000, category: "notes", debtDirection: "borrowed" };
  await createDebtNote(note, debtTransaction("borrow-1", 300000, note.id, note.name, cashWallet.id, cashWallet.name, "Utang diterima"));
  let transactions = await getTransactions();
  let wallets = await getWallets();
  const cashAfterBorrow = cashWallet.initialBalance + transactions.reduce((sum, item) => sum + (item.toWalletId === cashWallet.id ? item.amount : item.walletId === cashWallet.id ? -item.amount : 0), 0);
  const debtBalance = transactions.reduce((sum, item) => sum + (item.toWalletId === note.id ? item.amount : item.walletId === note.id ? -item.amount : 0), 0);
  assert.equal(cashAfterBorrow, 1300000);
  assert.equal(debtBalance, -300000);
  await recordDebtMovement(note.id, debtTransaction("borrow-2", 100000, cashWallet.id, cashWallet.name, note.id, note.name, "Bayar sebagian"), "payment");
  transactions = await getTransactions();
  wallets = await getWallets();
  assert.equal(wallets.some((item) => item.id === note.id), true);
  const remaining = transactions.reduce((sum, item) => sum + (item.toWalletId === note.id ? item.amount : item.walletId === note.id ? -item.amount : 0), 0);
  assert.equal(remaining, -200000);
  await recordDebtMovement(note.id, debtTransaction("borrow-3", 200000, cashWallet.id, cashWallet.name, note.id, note.name, "Pelunasan"), "payment");
  wallets = await getWallets();
  transactions = await getTransactions();
  assert.equal(wallets.some((item) => item.id === note.id), false);
  assert.equal(transactions.length, 4);
  const closure = transactions.find((item) => item.debtAction === "settled");
  assert.equal(closure?.debtDirection, "borrowed");
  assert.equal(closure?.debtInitialAmount, 300000);
  assert.equal(closure?.debtPaidAmount, 300000);
  assert.equal(closure?.debtRemainingAmount, 0);
});

test("debt operations reject insufficient cash and overpayment without writing partial records", async () => {
  await seedDebtDatabase();
  const note: Wallet = { id: "notes-cici", name: "Cici", initialBalance: 0, createdAt: 1767312000000, category: "notes", debtDirection: "lent" };
  await assert.rejects(
    () => createDebtNote(note, debtTransaction("bad-lend", 2000000, cashWallet.id, cashWallet.name, note.id, note.name, "Utang diberikan")),
    /Saldo wallet sumber tidak mencukupi/,
  );
  assert.equal((await getWallets()).some((item) => item.id === note.id), false);
  assert.equal((await getTransactions()).length, 0);
  await createDebtNote(note, debtTransaction("good-lend", 100000, cashWallet.id, cashWallet.name, note.id, note.name, "Utang diberikan"));
  await assert.rejects(
    () => recordDebtMovement(note.id, debtTransaction("bad-pay", 100001, note.id, note.name, cashWallet.id, cashWallet.name, "Pembayaran"), "payment"),
    /melebihi sisa utang/,
  );
  assert.equal((await getTransactions()).length, 1);
  assert.equal((await getWallets()).some((item) => item.id === note.id), true);
  await removeTransaction("good-lend");
  assert.equal((await getTransactions()).length, 1);
  assert.equal((await getTransactions())[0].hiddenFromHistory, true);
  assert.equal((await getWallets()).find((item) => item.id === note.id)?.id, note.id);
});


test("deleting one debt payment reverses only that payment; deleting original debt removes its linked ledger", async () => {
  await seedDebtDatabase();
  const note: Wallet = { id: "notes-delete", name: "Dina", initialBalance: 0, createdAt: 1767312000000, category: "notes", debtDirection: "lent" };
  await createDebtNote(note, debtTransaction("delete-1", 300000, cashWallet.id, cashWallet.name, note.id, note.name, "Utang awal"));
  await recordDebtMovement(note.id, debtTransaction("delete-2", 100000, note.id, note.name, cashWallet.id, cashWallet.name, "Pembayaran sebagian"), "payment");
  await recordDebtMovement(note.id, debtTransaction("delete-3", 50000, note.id, note.name, cashWallet.id, cashWallet.name, "Pembayaran kedua"), "payment");

  await removeTransaction("delete-2", true);
  let transactions = await getTransactions();
  assert.equal(transactions.some((item) => item.id === "delete-2"), false);
  assert.equal(transactions.some((item) => item.id === "delete-1"), true);
  assert.equal(transactions.some((item) => item.id === "delete-3"), true);
  assert.equal((await getWallets()).some((item) => item.id === note.id), true);
  let cash = cashWallet.initialBalance + transactions.reduce((sum, item) => sum + (item.toWalletId === cashWallet.id ? item.amount : item.walletId === cashWallet.id ? -item.amount : 0), 0);
  assert.equal(cash, 750000);

  await removeTransaction("delete-1", true);
  transactions = await getTransactions();
  assert.equal(transactions.length, 0);
  assert.equal((await getWallets()).some((item) => item.id === note.id), false);
  cash = cashWallet.initialBalance + transactions.reduce((sum, item) => sum + (item.toWalletId === cashWallet.id ? item.amount : item.walletId === cashWallet.id ? -item.amount : 0), 0);
  assert.equal(cash, cashWallet.initialBalance);
});

test("unchecked debt deletion hides only the selected history row and preserves its ledger effect", async () => {
  await seedDebtDatabase();
  const note: Wallet = { id: "notes-hide", name: "Rani", initialBalance: 0, createdAt: 1767312000000, category: "notes", debtDirection: "lent" };
  await createDebtNote(note, debtTransaction("hide-1", 200000, cashWallet.id, cashWallet.name, note.id, note.name, "Utang awal"));
  await recordDebtMovement(note.id, debtTransaction("hide-2", 50000, note.id, note.name, cashWallet.id, cashWallet.name, "Pembayaran"), "payment");
  await removeTransaction("hide-2");
  const transactions = await getTransactions();
  assert.equal(transactions.find((item) => item.id === "hide-2")?.hiddenFromHistory, true);
  assert.equal(transactions.find((item) => item.id === "hide-1")?.hiddenFromHistory, undefined);
  assert.equal((await getWallets()).some((item) => item.id === note.id), true);
});

test("manual debt settlement closes Notes without changing cash balance or deleting history", async () => {
  await seedDebtDatabase();
  const note: Wallet = { id: "notes-settle", name: "Eka", initialBalance: 0, createdAt: 1767312000000, category: "notes", debtDirection: "lent" };
  await createDebtNote(note, debtTransaction("settle-1", 250000, cashWallet.id, cashWallet.name, note.id, note.name, "Utang awal"));
  await recordDebtMovement(note.id, debtTransaction("settle-2", 50000, note.id, note.name, cashWallet.id, cashWallet.name, "Pembayaran sebagian"), "payment");
  const before = await getTransactions();
  const cashBefore = cashWallet.initialBalance + before.reduce((sum, item) => sum + (item.toWalletId === cashWallet.id ? item.amount : item.walletId === cashWallet.id ? -item.amount : 0), 0);
  await settleDebtNote(note.id);
  const after = await getTransactions();
  const cashAfter = cashWallet.initialBalance + after.reduce((sum, item) => sum + (item.toWalletId === cashWallet.id ? item.amount : item.walletId === cashWallet.id ? -item.amount : 0), 0);
  assert.equal(after.length, 3);
  const closure = after.find((item) => item.debtAction === "settled");
  assert.equal(closure?.note, "Utang diselesaikan");
  assert.equal(closure?.debtInitialAmount, 250000);
  assert.equal(closure?.debtPaidAmount, 50000);
  assert.equal(closure?.debtRemainingAmount, 200000);
  assert.equal(cashAfter, cashBefore);
  assert.equal((await getWallets()).some((item) => item.id === note.id), false);
});
