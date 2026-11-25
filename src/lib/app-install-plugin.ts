import { registerPlugin } from "@capacitor/core";

export interface ExpenseWidgetPayload {
  title: string;
  amount: string;
  periodLabel: string;
  transactionCount: number;
  overLimit: boolean;
  beforeImage?: string;
  afterImage?: string;
  enabled: boolean;
}

export interface AppInstallPlugin {
  canInstallUnknownApps(): Promise<{ granted: boolean }>;
  openInstallUnknownAppsSettings(): Promise<void>;
  verifyApkSha256(options: { filePath: string; expectedSha256: string }): Promise<{ valid: boolean; actualSha256: string }>;
  installApk(options: { filePath: string }): Promise<{ completed: boolean; message: string }>;
  syncExpenseWidget(options: ExpenseWidgetPayload): Promise<{ installed: boolean }>;
  getExpenseWidgetStatus(): Promise<{ installed: boolean }>;
  requestPinExpenseWidget(): Promise<{ requested: boolean; installed: boolean }>;
}

export const AppInstallPlugin = registerPlugin<AppInstallPlugin>("AppInstallPlugin");
