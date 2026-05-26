import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import "@/styles/cs.css";

export const metadata: Metadata = {
  title: "Atendy Dashboards",
  description: "Vendas CRM e Funil de Produção",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
