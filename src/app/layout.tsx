import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { PWARegister } from "@/components/gdf/PWARegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gente da Feira",
  description: "A rede social do seu bairro em Feira de Santana. Converse, publique e conecte-se com vizinhos.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "Gente da Feira",
    description: "A rede social do seu bairro em Feira de Santana",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Gente da Feira",
    description: "A rede social do seu bairro em Feira de Santana",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0A4D5C",
  viewportFit: "auto",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.png" />
        <link rel="apple-touch-icon" href="/icon.png" />
      </head>
      <body className="antialiased">
        {children}
        <Toaster position="top-center" richColors />
        <PWARegister />
      </body>
    </html>
  );
}
