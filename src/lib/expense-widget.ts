import type { Transaction } from "./db";

export type ExpenseWidgetPeriod = "daily" | "weekly" | "monthly" | "custom";
export type ExpenseWidgetSettings = {
  period: ExpenseWidgetPeriod;
  walletIds: string[] | null;
  startDate: string;
  endDate: string;
};
export type ExpenseDateRange = { start: string; end: string };

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

export function getExpenseDateRange(period: ExpenseWidgetPeriod, referenceDate: Date, customStart: string, customEnd: string): ExpenseDateRange {
  if (period === "custom") return { start: customStart, end: customEnd };
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const end = new Date(start);
  if (period === "weekly") {
    const daysSinceMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 6);
  } else if (period === "monthly") {
    start.setDate(1);
    end.setMonth(end.getMonth() + 1, 0);
  }
  return { start: toLocalDateString(start), end: toLocalDateString(end) };
}

export function calculateExpenseSummary(transactions: Transaction[], selectedWalletIds: string[], range: ExpenseDateRange): { total: number; count: number } {
  if (!range.start || !range.end || range.start > range.end || selectedWalletIds.length === 0) return { total: 0, count: 0 };
  const selected = new Set(selectedWalletIds);
  return transactions.reduce((summary, transaction) => {
    if (transaction.kind !== "expense" || !selected.has(transaction.walletId) || transaction.date < range.start || transaction.date > range.end) return summary;
    return { total: summary.total + transaction.amount, count: summary.count + 1 };
  }, { total: 0, count: 0 });
}
