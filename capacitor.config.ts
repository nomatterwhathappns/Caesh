import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.caesh.finance",
  appName: "Caesh",
  webDir: "out",
  android: {
    backgroundColor: "#FAF5EF",
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: "LIGHT",
    },
  },
};

export default config;
