"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { AuthForm } from "@/components/gdf/AuthForm";
import { FeedView } from "@/components/gdf/FeedView";
import { RoomsView } from "@/components/gdf/RoomsView";
import { DMsView } from "@/components/gdf/DMsView";
import { ProfileView } from "@/components/gdf/ProfileView";
import { DiscoverView } from "@/components/gdf/DiscoverView";
import { ThemeToggle } from "@/components/gdf/ThemeToggle";
import { UserProfileView } from "@/components/gdf/UserProfileView";
import { createClient } from "@/lib/supabase/client";
import { Home, Users, MessageSquare, Compass, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "feed" as const, label: "Feed", icon: Home },
  { id: "rooms" as const, label: "Salas", icon: Users },
  { id: "dms" as const, label: "DMs", icon: MessageSquare },
  { id: "discover" as const, label: "Descobrir", icon: Compass },
  { id: "profile" as const, label: "Perfil", icon: User },
];

export function AppShell() {
  const { profile, tab, setTab, selectedRoom, selectedDM, setSelectedRoom, setSelectedDM, setProfile, logout, viewingUserId, setViewingUser } = useStore();
  const [checkedAuth, setCheckedAuth] = useState(false);

  // Escutar evento customizado para abrir perfil de outro usuário
  useEffect(() => {
    const handler = (e: any) => {
      const userId = e.detail?.userId;
      if (userId) setViewingUser(userId);
    };
    window.addEventListener("openUserProfile", handler);
    return () => window.removeEventListener("openUserProfile", handler);
  }, [setViewingUser]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const supabase = createClient();

        // Timeout de segurança: se demorar mais de 5s, seguir sem profile
        const userResult = await Promise.race([
          supabase.auth.getUser(),
          new Promise<{ data: { user: null } }>((resolve) =>
            setTimeout(() => resolve({ data: { user: null } }), 5000)
          ),
        ]);

        const user = userResult.data.user;
        if (user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();
          if (prof && mounted) setProfile(prof);
        }
      } catch {
        // Se der erro (ex: Supabase offline), segue sem profile
      }
      if (mounted) setCheckedAuth(true);
    };

    initAuth();

    // Escutar mudanças de auth (separado para não bloquear initAuth)
    try {
      const supabase = createClient();
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
        if (event === "SIGNED_OUT") {
          try { await supabase.removeAllChannels(); } catch { /* silent */ }
          logout();
        }
      });
      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    } catch {
      return () => { mounted = false; };
    }
  }, [setProfile, logout]);

  if (!checkedAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary animate-pulse">
            <span className="text-2xl font-bold text-primary-foreground">G</span>
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return <AuthForm />;

  const handleTabClick = (tabId: typeof tab) => {
    if (tabId === "rooms") setSelectedRoom(null);
    if (tabId === "dms") setSelectedDM(null);
    setViewingUser(null);
    setTab(tabId);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Desktop Header */}
      <header className="sticky top-0 z-40 hidden md:flex items-center justify-between border-b px-6 py-3 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <span className="text-sm font-bold text-primary-foreground">G</span>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">GDF Chat</h1>
            <p className="text-[10px] text-muted-foreground leading-none">Feira de Santana</p>
          </div>
        </div>

        {/* Desktop Nav — estilo pílula */}
        <nav className="flex items-center gap-0.5 bg-muted/50 rounded-full p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTabClick(t.id)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                tab === t.id && !viewingUserId
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">{profile.display_name?.charAt(0)?.toUpperCase()}</span>
            </div>
            <span className="text-sm font-medium">{profile.display_name}</span>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 pb-20 md:pb-6">
        <div className="mx-auto max-w-lg px-4 py-4 md:py-6">
          {viewingUserId ? (
            <UserProfileView />
          ) : (
            <>
              {tab === "feed" && <FeedView />}
              {tab === "rooms" && <RoomsView />}
              {tab === "dms" && <DMsView />}
              {tab === "discover" && <DiscoverView />}
              {tab === "profile" && <ProfileView />}
            </>
          )}
        </div>
      </main>

      {/* Mobile Bottom Nav — barra estável com safe area */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t bg-background/95 backdrop-blur-md md:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTabClick(t.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-2.5 transition-colors",
              tab === t.id && !viewingUserId
                ? "text-primary"
                : "text-muted-foreground"
            )}
            style={{ paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
          >
            <t.icon className={cn("h-5 w-5", tab === t.id && !viewingUserId && "stroke-[2.5px]")} />
            <span className={cn("text-[10px] font-medium", tab === t.id && !viewingUserId && "font-semibold")}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
