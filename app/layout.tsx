import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Precedent — AI research desk",
  description: "A multi-factor research workbench for tokenized US stocks.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
