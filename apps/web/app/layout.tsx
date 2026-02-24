import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "알파 레이더",
  description: "모멘텀 레이더 대시보드"
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
