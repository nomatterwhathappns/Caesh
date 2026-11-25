import { registerPlugin } from "@capacitor/core";

export interface AppInstallPlugin {
  canInstallUnknownApps(): Promise<{ granted: boolean }>;
  openInstallUnknownAppsSettings(): Promise<void>;
  verifyApkSha256(options: { filePath: string; expectedSha256: string }): Promise<{ valid: boolean; actualSha256: string }>;
  installApk(options: { filePath: string }): Promise<{ completed: boolean; message: string }>;
}

export const AppInstallPlugin = registerPlugin<AppInstallPlugin>("AppInstallPlugin");
