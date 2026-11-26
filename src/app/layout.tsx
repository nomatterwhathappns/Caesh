import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Caesh — Personal Finance",
  description: "Catatan keuangan pribadi yang sederhana dan privat.",
  applicationName: "Caesh",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#FAF5EF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
