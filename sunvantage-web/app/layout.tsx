import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "🌅 SunVantage — A quiet place to notice the morning",
  description: "A quiet place to notice the morning.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
