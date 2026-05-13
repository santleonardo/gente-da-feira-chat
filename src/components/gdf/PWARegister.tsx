"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Smartphone } from "lucide-react";
import { toast } from "sonner";

// Tipos para o BeforeInstallPromptEvent (não é nativo do TS)
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWARegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // Registrar Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("SW registrado:", reg.scope);

          // Verificar atualizações periodicamente
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "activated") {
                  toast.success("App atualizado! Recarregue a página.", {
                    duration: 5000,
                  });
                }
              });
            }
          });
        })
        .catch((err) => console.log("SW falhou:", err));
    }

    // Capturar evento de instalação
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Mostrar banner após 3 segundos (não incomodar logo de cara)
      setTimeout(() => setShowInstallBanner(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Se já está instalado, não mostrar
    window.addEventListener("appinstalled", () => {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
      toast.success("GDF instalado no seu dispositivo!");
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      toast.success("Instalando GDF...");
    }
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const dismissBanner = () => {
    setShowInstallBanner(false);
    // Não mostrar novamente por 24h
    try {
      localStorage.setItem("gdf_install_dismissed", Date.now().toString());
    } catch {
      // silent
    }
  };

  // Verificar se foi dispensado recentemente
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem("gdf_install_dismissed");
      if (dismissed) {
        const elapsed = Date.now() - parseInt(dismissed);
        if (elapsed < 24 * 60 * 60 * 1000) {
          setShowInstallBanner(false);
        }
      }
    } catch {
      // silent
    }
  }, []);

  if (!showInstallBanner || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-24 left-3 right-3 z-50 md:bottom-6 md:left-auto md:right-6 md:w-80">
      <div className="rounded-2xl border bg-card p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold">Instalar GDF</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Adicione ao celular para acesso rápido e notificações
            </p>
          </div>
          <button
            onClick={dismissBanner}
            className="shrink-0 rounded-full p-1 hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            onClick={handleInstall}
            size="sm"
            className="flex-1 gap-1.5 rounded-full"
          >
            <Download className="h-3.5 w-3.5" />
            Instalar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={dismissBanner}
            className="rounded-full"
          >
            Agora não
          </Button>
        </div>
      </div>
    </div>
  );
}
