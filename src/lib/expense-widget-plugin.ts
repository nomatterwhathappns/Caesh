import { registerPlugin } from "@capacitor/core";

export interface ExpenseWidgetBridge {
  syncExpenseWidget(options: {
    title: string;
    amount: string;
    periodLabel: string;
    period: "daily" | "weekly" | "monthly" | "yearly" | "custom";
    periodKey: string;
    transactionCount: number;
    overLimit: boolean;
    limitEnabled: boolean;
    baseImage?: string;
    beforeImage?: string;
    afterImage?: string;
    imagePositionX?: number;
    imagePositionY?: number;
    imageZoom?: number;
    enabled: boolean;
  }): Promise<{ installed: boolean }>;
  getExpenseWidgetStatus(): Promise<{ installed: boolean }>;
  requestPinExpenseWidget(): Promise<{ requested: boolean; installed: boolean }>;
}

export const ExpenseWidgetPlugin = registerPlugin<ExpenseWidgetBridge>("ExpenseWidgetPlugin");
