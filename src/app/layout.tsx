import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JARVIS // Mwango Brain",
  description: "Sistema de Automacao de Redes Sociais",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <body style={{ background: "#000", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
