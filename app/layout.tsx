import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Makanak | WhatsApp Delivery Location",
  description: "A simple WhatsApp-first delivery location page for restaurants in Yemen."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
