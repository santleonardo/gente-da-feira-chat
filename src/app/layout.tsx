import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Toaster } from "sonner";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Gente da Feira — Bate-papo do bairro",
  description:
    "A rede social do seu bairro em Feira de Santana. Converse, publique e conecte-se com vizinhos.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GDF",
  },
  openGraph: {
    title: "Gente da Feira",
    description: "A rede social do seu bairro em Feira de Santana",
    type: "website",
    locale: "pt_BR",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F59E0B" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f11" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.png" />
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="GDF" />
      </head>
      <body className="antialiased">
        <NextThemesProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-center" richColors />
          {/* Registra o Service Worker e mostra prompt de instalação */}
          <PWARegisterProxy />
        </NextThemesProvider>
      </body>
    </html>
  );
}

// Client component proxy (layout é server component)
import { PWARegister } from "@/components/gdf/PWARegister";
function PWARegisterProxy() {
  return <PWARegister />;
}
