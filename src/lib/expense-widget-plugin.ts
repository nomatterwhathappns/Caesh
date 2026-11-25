import { registerPlugin } from "@capacitor/core";

export interface ExpenseWidgetBridge {
  syncExpenseWidget(options: {
    title: string;
    amount: string;
    periodLabel: string;
    transactionCount: number;
    overLimit: boolean;
    baseImage?: string;\n    beforeImage?: string;
    afterImage?: string;
    enabled: boolean;
  }): Promise<{ installed: boolean }>;
  getExpenseWidgetStatus(): Promise<{ installed: boolean }>;
  requestPinExpenseWidget(): Promise<{ requested: boolean; installed: boolean }>;
}

export const ExpenseWidgetPlugin = registerPlugin<ExpenseWidgetBridge>("ExpenseWidgetPlugin");
