"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { AuthForm } from "@/components/gdf/AuthForm";
import { FeedView } from "@/components/gdf/FeedView";
import { RoomsView } from "@/components/gdf/RoomsView";
import { DMsView } from "@/components/gdf/DMsView";
import { ProfileView } from "@/components/gdf/ProfileView";
import { DiscoverView } from "@/components/gdf/DiscoverView";
import { ThemeToggle } from "@/components/gdf/ThemeToggle";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Home, Users, MessageSquare, Compass, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "feed" as const, label: "Feed", icon: Home },
  { id: "rooms" as const, label: "Salas", icon: Users },
  { id: "dms" as const, label: "DMs", icon: MessageSquare },
  { id: "discover" as const, label: "Descobrir", icon: Compass },
  { id: "profile" as const, label: "Perfil", icon: User },
];

export function AppShell() {
  const {
    profile,
    tab,
    setTab,
    setSelectedRoom,
    setSelectedDM,
    setProfile,
    logout,
  } = useStore();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = createClient();

    const initAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (prof) setProfile(prof);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_OUT") {
        logout();
      }
    });

    return () => subscription.unsubscribe();
  }, [setProfile, logout]);

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground">
          G
        </div>
        <h1 className="text-2xl font-bold">GDF Chat</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          Configure as variáveis de ambiente do Supabase no arquivo{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
            .env.local
          </code>{" "}
          para conectar ao backend.
        </p>
        <div className="mt-6 rounded-xl border bg-muted/50 p-4 text-left text-xs font-mono max-w-md">
          <p className="text-muted-foreground mb-1"># .env.local</p>
          <p>NEXT_PUBLIC_SUPABASE_URL=https://...</p>
          <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=...</p>
        </div>
      </div>
    );
  }

  if (!profile) return <AuthForm />;

  const handleTabChange = (tabId: (typeof tabs)[number]["id"]) => {
    if (tabId === "rooms") setSelectedRoom(null);
    if (tabId === "dms") setSelectedDM(null);
    setTab(tabId);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Desktop Header */}
      <header className="sticky top-0 z-40 hidden md:flex items-center justify-between border-b px-6 py-3 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            G
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">GDF Chat</h1>
            <p className="text-[10px] text-muted-foreground leading-none">
              Feira de Santana
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="text-sm text-muted-foreground">
            {profile.display_name}
          </span>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 pb-20 md:pb-6">
        <div className="mx-auto max-w-lg px-4 py-4 md:py-6">
          {tab === "feed" && <FeedView />}
          {tab === "rooms" && <RoomsView />}
          {tab === "dms" && <DMsView />}
          {tab === "discover" && <DiscoverView />}
          {tab === "profile" && <ProfileView />}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t bg-background/95 backdrop-blur-md md:hidden pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-2.5 transition-colors",
              tab === t.id ? "text-primary" : "text-muted-foreground"
            )}
          >
            <t.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
