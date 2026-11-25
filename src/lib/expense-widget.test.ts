import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateExpenseSummary, getExpenseDateRange } from "./expense-widget";
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
