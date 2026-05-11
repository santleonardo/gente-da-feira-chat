"use client";

import { useEffect, useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { AuthForm } from "@/components/gdf/AuthForm";
import { FeedView } from "@/components/gdf/FeedView";
import { RoomsView } from "@/components/gdf/RoomsView";
import { DMsView } from "@/components/gdf/DMsView";
import { ProfileView } from "@/components/gdf/ProfileView";
import { DiscoverView } from "@/components/gdf/DiscoverView";
import { ThemeToggle } from "@/components/gdf/ThemeToggle";
import { UserProfileDialog } from "@/components/gdf/UserProfileDialog";
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
  const { profile, tab, setTab, selectedRoom, selectedDM, setSelectedRoom, setSelectedDM, setProfile, logout } = useStore();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [profileDialogUserId, setProfileDialogUserId] = useState<string | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  // Escutar evento customizado para abrir perfil de outro usuario
  useEffect(() => {
    const handler = (e: any) => {
      const userId = e.detail?.userId;
      if (userId) {
        setProfileDialogUserId(userId);
        setProfileDialogOpen(true);
      }
    };
    window.addEventListener("openUserProfile", handler);
    return () => window.removeEventListener("openUserProfile", handler);
  }, []);

  const openUserProfile = useCallback((userId: string) => {
    setProfileDialogUserId(userId);
    setProfileDialogOpen(true);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const initAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (prof) setProfile(prof);
      }
      setCheckedAuth(true);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_OUT") {
        try {
          await supabase.removeAllChannels();
        } catch { /* silent */ }
        logout();
      }
    });

    return () => subscription.unsubscribe();
  }, [setProfile, logout]);

  if (!checkedAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary animate-pulse">
            <span className="text-xl font-bold text-primary-foreground">G</span>
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

  const inChat = (tab === "rooms" && selectedRoom) || (tab === "dms" && selectedDM);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Desktop Header */}
      <header className="sticky top-0 z-40 hidden md:flex items-center justify-between border-b px-6 py-2.5 bg-background/70 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
            <span className="text-sm font-bold text-primary-foreground">G</span>
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight tracking-tight">GDF Chat</h1>
            <p className="text-[10px] text-muted-foreground leading-none">Feira de Santana</p>
          </div>
        </div>

        <nav className="flex items-center gap-0.5 bg-muted/50 rounded-full p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                if (t.id === "rooms") setSelectedRoom(null);
                if (t.id === "dms") setSelectedDM(null);
                setTab(t.id);
              }}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                tab === t.id
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
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary">{profile.display_name?.charAt(0)?.toUpperCase()}</span>
            </div>
            <span className="text-sm font-medium">{profile.display_name}</span>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 pb-20 md:pb-6">
        <div className={cn(
          "mx-auto px-4 py-4 md:py-6",
          inChat ? "max-w-2xl" : "max-w-lg"
        )}>
          {tab === "feed" && <FeedView />}
          {tab === "rooms" && <RoomsView />}
          {tab === "dms" && <DMsView />}
          {tab === "discover" && <DiscoverView />}
          {tab === "profile" && <ProfileView openUserProfile={openUserProfile} />}
        </div>
      </main>

      {/* Perfil publico de outros usuarios */}
      <UserProfileDialog
        userId={profileDialogUserId}
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
      />

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
        <div className="mx-3 mb-3 flex items-center justify-around rounded-2xl border bg-background/90 backdrop-blur-xl shadow-lg px-1 py-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                if (t.id === "rooms") setSelectedRoom(null);
                if (t.id === "dms") setSelectedDM(null);
                setTab(t.id);
              }}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-3.5 py-2 transition-all duration-200",
                tab === t.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground active:scale-95"
              )}
            >
              <t.icon className={cn("h-5 w-5", tab === t.id && "stroke-[2.5px]")} />
              <span className={cn("text-[10px] font-medium", tab === t.id && "font-semibold")}>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
