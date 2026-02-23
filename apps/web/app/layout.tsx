import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alpha Radar",
  description: "Momentum radar dashboard"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

