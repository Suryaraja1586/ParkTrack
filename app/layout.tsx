import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Inter } from "next/font/google";
import NotificationPermission from "@/components/NotificationPermission";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "ParkTrack",
  description: "Parkinson’s Disease Tracker App",
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        <link rel="icon" href="/icons/icon-192x192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ParkTrack" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={inter.className}>
        <NotificationPermission />
        {children}
        <Toaster />
      </body>
    </html>
  );
}