import { registerPlugin } from "@capacitor/core";

export interface AppInstallPlugin {
  canInstallUnknownApps(): Promise<{ granted: boolean }>;
  openInstallUnknownAppsSettings(): Promise<void>;
  installApk(options: { filePath: string }): Promise<{ completed: boolean; message: string }>;
}

export const AppInstallPlugin = registerPlugin<AppInstallPlugin>("AppInstallPlugin");
