import { create } from "zustand";
import type { Profile, Tab, Room, Conversation } from "@/lib/types";

interface AppState {
  // Auth
  profile: Profile | null;
  isLoggedIn: boolean;

  // Navigation
  tab: Tab;
  selectedRoom: Room | null;
  selectedDM: Conversation | null;
  selectedUser: { id: string; display_name: string; username: string } | null;

  // Actions
  setProfile: (profile: Profile | null) => void;
  logout: () => void;
  setTab: (tab: Tab) => void;
  setSelectedRoom: (room: Room | null) => void;
  setSelectedDM: (dm: Conversation | null) => void;
  setSelectedUser: (user: { id: string; display_name: string; username: string } | null) => void;
  updateProfile: (data: Partial<Profile>) => void;
}

export const useStore = create<AppState>((set) => ({
  profile: null,
  isLoggedIn: false,
  tab: "feed",
  selectedRoom: null,
  selectedDM: null,
  selectedUser: null,

  setProfile: (profile) => {
    set({
      profile,
      isLoggedIn: !!profile,
    });
  },

  logout: () => {
    set({
      profile: null,
      isLoggedIn: false,
      tab: "feed",
      selectedRoom: null,
      selectedDM: null,
    });
  },

  setTab: (tab) => set({ tab }),
  setSelectedRoom: (room) => set({ selectedRoom: room, tab: "rooms" }),
  setSelectedDM: (dm) => set({ selectedDM: dm, tab: "dms" }),
  setSelectedUser: (user) => set({ selectedUser: user }),
  updateProfile: (data) =>
    set((state) => ({
      profile: state.profile ? { ...state.profile, ...data } : null,
    })),
}));
