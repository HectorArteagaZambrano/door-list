import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Encuentro Door List | Door List",
  description: "Fecha y lugar del próximo Encuentro Door List en Lima.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
