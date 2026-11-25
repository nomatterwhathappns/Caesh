import type { Transaction } from "./db";

export type ExpenseWidgetPeriod = "daily" | "weekly" | "monthly" | "yearly" | "custom";
export type ExpenseWidgetSettings = {
  title: string;
  period: ExpenseWidgetPeriod;
  walletIds: string[] | null;
  startDate: string;
  endDate: string;
  limitEnabled: boolean;
  monthlyLimit: number;
  beforeImage: string;
  afterImage: string;
};
export type ExpenseDateRange = { start: string; end: string };

export const DEFAULT_EXPENSE_WIDGET_SETTINGS: ExpenseWidgetSettings = {
  title: "Pengeluaran Bulanan",
  period: "monthly",
  walletIds: null,
  startDate: "",
  endDate: "",
  limitEnabled: false,
  monthlyLimit: 0,
  beforeImage: "",
  afterImage: "",
};

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
  } else if (period === "yearly") {
    start.setMonth(0, 1);
    end.setMonth(11, 31);
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

export function isExpenseLimitExceeded(total: number, settings: Pick<ExpenseWidgetSettings, "limitEnabled" | "monthlyLimit">): boolean {
  return settings.limitEnabled && settings.monthlyLimit > 0 && total > settings.monthlyLimit;
}

export function normalizeExpenseWidgetSettings(value: unknown): ExpenseWidgetSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_EXPENSE_WIDGET_SETTINGS };
  const raw = value as Partial<ExpenseWidgetSettings>;
  const validPeriods: ExpenseWidgetPeriod[] = ["daily", "weekly", "monthly", "yearly", "custom"];
  const validDate = (date: unknown) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
  return {
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 40) : DEFAULT_EXPENSE_WIDGET_SETTINGS.title,
    period: validPeriods.includes(raw.period as ExpenseWidgetPeriod) ? raw.period as ExpenseWidgetPeriod : "monthly",
    walletIds: raw.walletIds === null || raw.walletIds === undefined ? null : Array.isArray(raw.walletIds) ? raw.walletIds.filter((id): id is string => typeof id === "string") : null,
    startDate: validDate(raw.startDate),
    endDate: validDate(raw.endDate),
    limitEnabled: raw.limitEnabled === true,
    monthlyLimit: Number.isSafeInteger(raw.monthlyLimit) && Number(raw.monthlyLimit) > 0 ? Number(raw.monthlyLimit) : 0,
    baseImage: typeof raw.baseImage === "string" && raw.baseImage.startsWith("data:image/") ? raw.baseImage : "",\n    beforeImage: typeof raw.beforeImage === "string" && raw.beforeImage.startsWith("data:image/") ? raw.beforeImage : "",
    afterImage: typeof raw.afterImage === "string" && raw.afterImage.startsWith("data:image/") ? raw.afterImage : "",
  };
}
