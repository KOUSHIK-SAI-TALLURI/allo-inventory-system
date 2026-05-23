// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allo Inventory — Warehouse Control",
  description: "Real-time inventory reservation system for multi-warehouse operations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="scanline">
        {children}
      </body>
    </html>
  );
}
