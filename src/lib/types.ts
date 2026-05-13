// ─── TypeScript Interfaces para o GDF Chat ───

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
}

export type Tab = "feed" | "rooms" | "dms" | "discover" | "profile";

export interface Author {
  id: string;
  display_name: string;
  username: string;
  avatar?: string | null;
  neighborhood?: string | null;
}

export interface Reaction {
  user_id: string;
  type: string;
}

export interface Post {
  id: string;
  content: string;
  image_url?: string | null;
  neighborhood?: string | null;
  created_at: string;
  author_id: string;
  is_deleted: boolean;
  author: Author;
  reactions: Reaction[];
}

export interface Message {
  id: string;
  content: string;
  sender_id: string;
  target_type: "room" | "dm";
  room_id?: string | null;
  dm_id?: string | null;
  is_deleted: boolean;
  created_at: string;
  sender: Pick<Author, "id" | "display_name" | "username" | "avatar">;
}

export interface Room {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description?: string | null;
  type: "official" | "community";
  is_active: boolean;
  member_count?: number;
  _count?: { members: number; messages: number };
  created_at: string;
}

export interface Conversation {
  id: string;
  initiator_id: string;
  receiver_id: string;
  updated_at: string;
  initiator: Pick<Author, "id" | "display_name" | "username" | "avatar">;
  receiver: Pick<Author, "id" | "display_name" | "username" | "avatar">;
}

export interface UserSearchResult {
  id: string;
  display_name: string;
  username: string;
  avatar?: string | null;
  neighborhood?: string | null;
  bio?: string | null;
}
