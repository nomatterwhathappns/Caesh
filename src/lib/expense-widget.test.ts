import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateExpenseSummary, getExpenseDateRange, getExpensePeriodKey, isExpenseLimitExceeded, normalizeExpenseWidgetSettings } from "./expense-widget";
import type { Transaction } from "./db";

const tx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "tx", kind: "expense", amount: 100, category: "Makanan", note: "", date: "2026-11-25", walletId: "wallet-a", createdAt: 1, ...overrides,
});

test("daily period uses the reference local date", () => assert.deepEqual(getExpenseDateRange("daily", new Date(2026,10,25), "", ""), {start:"2026-11-25",end:"2026-11-25"}));
test("weekly period is Monday through Sunday", () => assert.deepEqual(getExpenseDateRange("weekly", new Date(2026,10,25), "", ""), {start:"2026-11-23",end:"2026-11-29"}));
test("monthly period supports normal and leap-year February", () => {
  assert.deepEqual(getExpenseDateRange("monthly", new Date(2026,1,12), "", ""), {start:"2026-02-01",end:"2026-02-28"});
  assert.deepEqual(getExpenseDateRange("monthly", new Date(2024,1,12), "", ""), {start:"2024-02-01",end:"2024-02-29"});
});
test("custom dates are retained", () => assert.deepEqual(getExpenseDateRange("custom", new Date(2026,10,25), "2026-11-01", "2026-11-15"), {start:"2026-11-01",end:"2026-11-15"}));
test("summary filters wallet, expense kind, and inclusive date bounds", () => {
  assert.deepEqual(calculateExpenseSummary([
    tx({id:"first",date:"2026-11-01",amount:100}), tx({id:"middle",date:"2026-11-10",amount:250,walletId:"wallet-b"}),
    tx({id:"last",date:"2026-11-30",amount:300}), tx({id:"before",date:"2026-10-31",amount:999}),
    tx({id:"after",date:"2026-12-01",amount:999}), tx({id:"income",kind:"income",amount:999}), tx({id:"transfer",kind:"transfer",amount:999}),
  ], ["wallet-a","wallet-b"], {start:"2026-11-01",end:"2026-11-30"}), {total:650,count:3});
});
test("empty selection and reversed dates safely return zero", () => {
  assert.deepEqual(calculateExpenseSummary([tx()], [], {start:"2026-11-01",end:"2026-11-30"}), {total:0,count:0});
  assert.deepEqual(calculateExpenseSummary([tx()], ["wallet-a"], {start:"2026-11-30",end:"2026-11-01"}), {total:0,count:0});
});

test("yearly period covers January through December of the reference year", () => {
  assert.deepEqual(getExpenseDateRange("yearly", new Date(2026, 10, 25), "", ""), { start: "2026-01-01", end: "2026-12-31" });
});
test("limit warning is optional and triggers only above the configured amount", () => {
  const settings = { limitEnabled: true, monthlyLimit: 500 };
  assert.equal(isExpenseLimitExceeded(500, settings), false);
  assert.equal(isExpenseLimitExceeded(501, settings), true);
  assert.equal(isExpenseLimitExceeded(900, { ...settings, limitEnabled: false }), false);
});
test("settings normalization keeps safe supported values and defaults invalid fields", () => {
  const settings = normalizeExpenseWidgetSettings({ title: "  Belanja  ", period: "yearly", walletIds: ["a", 2], limitEnabled: true, monthlyLimit: 1000, beforeImage: "data:image/png;base64,abc", afterImage: "https://invalid" });
  assert.equal(settings.title, "Belanja");
  assert.equal(settings.period, "yearly");
  assert.deepEqual(settings.walletIds, ["a"]);
  assert.equal(settings.monthlyLimit, 1000);
  assert.equal(settings.beforeImage, "data:image/png;base64,abc");
  assert.equal(settings.afterImage, "");
});

test("period keys change at the correct daily, weekly, monthly, and yearly boundaries", () => {
  assert.equal(getExpensePeriodKey("daily", new Date(2026, 10, 25), "", ""), "2026-11-25");
  assert.equal(getExpensePeriodKey("weekly", new Date(2026, 10, 25), "", ""), "2026-11-23");
  assert.equal(getExpensePeriodKey("monthly", new Date(2026, 10, 25), "", ""), "2026-11");
  assert.equal(getExpensePeriodKey("yearly", new Date(2026, 10, 25), "", ""), "2026");
  assert.equal(getExpensePeriodKey("custom", new Date(2026, 10, 25), "2026-11-01", "2026-11-30"), "2026-11-01|2026-11-30");
});
