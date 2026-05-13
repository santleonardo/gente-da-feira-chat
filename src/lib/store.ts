import { create } from "zustand";

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
  neighborhood: string | null;
  theme: string;
  created_at: string;
  updated_at: string;
  is_private?: boolean;
  hide_following?: boolean;
  hide_followers?: boolean;
  approve_followers?: boolean;
}

type Tab = "feed" | "rooms" | "dms" | "discover" | "profile";

interface AppState {
  profile: Profile | null;
  isLoggedIn: boolean;
  tab: Tab;
  selectedRoom: any | null;
  selectedDM: any | null;
  selectedUser: any | null;
  unreadNotifications: number;
  setProfile: (profile: Profile | null) => void;
  logout: () => void;
  setTab: (tab: Tab) => void;
  setSelectedRoom: (room: any | null) => void;
  setSelectedDM: (dm: any | null) => void;
  setSelectedUser: (user: any | null) => void;
  updateProfile: (data: Partial<Profile>) => void;
  setUnreadNotifications: (count: number) => void;
}

export const useStore = create<AppState>((set) => ({
  profile: null,
  isLoggedIn: false,
  tab: "feed",
  selectedRoom: null,
  selectedDM: null,
  selectedUser: null,
  unreadNotifications: 0,

  setProfile: (profile) => set({ profile, isLoggedIn: !!profile }),
  logout: () => set({ profile: null, isLoggedIn: false, tab: "feed", selectedRoom: null, selectedDM: null, unreadNotifications: 0 }),
  setTab: (tab) => set({ tab }),
  setSelectedRoom: (room) => set({ selectedRoom: room, tab: "rooms" }),
  setSelectedDM: (dm) => set({ selectedDM: dm, tab: "dms" }),
  setSelectedUser: (user) => set({ selectedUser: user }),
  updateProfile: (data) => set((state) => ({ profile: state.profile ? { ...state.profile, ...data } : null })),
  setUnreadNotifications: (count) => set({ unreadNotifications: count }),
}));
