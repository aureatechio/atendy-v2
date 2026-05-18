import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atendy Dashboards",
  description: "Compras Pagas e Funil de Produção",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
