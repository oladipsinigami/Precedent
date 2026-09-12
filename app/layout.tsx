import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Precedent — Quantitative Research Desk",
  description: "A multi-factor research workbench for tokenized US stocks on Bitget.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="relative min-h-screen bg-[#07090c] font-sans antialiased text-[#e7ebef]">
        <div className="grain" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
