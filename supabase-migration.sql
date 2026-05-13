-- ============================================================
-- GDF Chat - Migration SQL para Supabase
-- Execute este SQL no SQL Editor do Supabase
-- ============================================================

-- ═══════ TABELA: profiles ═══════
-- (Criada automaticamente pelo Supabase Auth, mas adicionamos campos extras)

-- Adicionar campos de privacidade se não existirem
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hide_following BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hide_followers BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approve_followers BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'system';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ═══════ TABELA: posts ═══════
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT,
  image_urls JSONB DEFAULT '[]',
  video_url TEXT,
  audio_url TEXT,
  neighborhood TEXT,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'followers')),
  expires_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,
  shared_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  comment_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_neighborhood ON posts(neighborhood);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_expires_at ON posts(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_not_deleted ON posts(id) WHERE is_deleted = false;

-- RLS para posts
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read non-deleted posts" ON posts;
CREATE POLICY "Anyone can read non-deleted posts" ON posts
  FOR SELECT USING (is_deleted = false);

DROP POLICY IF EXISTS "Authenticated users can create posts" ON posts;
CREATE POLICY "Authenticated users can create posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors can update their posts" ON posts;
CREATE POLICY "Authors can update their posts" ON posts
  FOR UPDATE USING (auth.uid() = author_id);

-- ═══════ TABELA: comments ═══════
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read comments" ON comments;
CREATE POLICY "Anyone can read comments" ON comments
  FOR SELECT USING (is_deleted = false);

DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments;
CREATE POLICY "Authenticated users can create comments" ON comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors can update comments" ON comments;
CREATE POLICY "Authors can update comments" ON comments
  FOR UPDATE USING (auth.uid() = author_id);

-- ═══════ TABELA: reactions ═══════
CREATE TABLE IF NOT EXISTS reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'like' CHECK (type IN ('like', 'laugh', 'sad', 'wow', 'angry', 'love')),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT reaction_target CHECK (post_id IS NOT NULL OR comment_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reaction_unique_post ON reactions(user_id, post_id, type) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reaction_unique_comment ON reactions(user_id, comment_id, type) WHERE comment_id IS NOT NULL;

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read reactions" ON reactions;
CREATE POLICY "Anyone can read reactions" ON reactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create reactions" ON reactions;
CREATE POLICY "Authenticated users can create reactions" ON reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reactions" ON reactions;
CREATE POLICY "Users can delete own reactions" ON reactions
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════ TABELA: follows ═══════
CREATE TABLE IF NOT EXISTS follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_unique ON follows(follower_id, following_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read follows" ON follows;
CREATE POLICY "Users can read follows" ON follows
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create follows" ON follows;
CREATE POLICY "Authenticated users can create follows" ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can update follows" ON follows;
CREATE POLICY "Users can update follows" ON follows
  FOR UPDATE USING (auth.uid() = following_id OR auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can delete follows" ON follows;
CREATE POLICY "Users can delete follows" ON follows
  FOR DELETE USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- ═══════ TABELA: blocks ═══════
CREATE TABLE IF NOT EXISTS blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT no_self_block CHECK (blocker_id != blocked_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blocks_unique ON blocks(blocker_id, blocked_id);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read blocks" ON blocks;
CREATE POLICY "Users can read blocks" ON blocks
  FOR SELECT USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

DROP POLICY IF EXISTS "Authenticated users can create blocks" ON blocks;
CREATE POLICY "Authenticated users can create blocks" ON blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can delete own blocks" ON blocks;
CREATE POLICY "Users can delete own blocks" ON blocks
  FOR DELETE USING (auth.uid() = blocker_id);

-- ═══════ TABELA: notifications ═══════
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  from_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL DEFAULT 'follow',
  content TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
CREATE POLICY "Authenticated users can create notifications" ON notifications
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- ═══════ TABELA: rooms ═══════
CREATE TABLE IF NOT EXISTS rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT DEFAULT '💬',
  description TEXT,
  type TEXT DEFAULT 'community' CHECK (type IN ('official', 'community')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read rooms" ON rooms;
CREATE POLICY "Anyone can read rooms" ON rooms
  FOR SELECT USING (true);

-- ═══════ TABELA: room_members ═══════
CREATE TABLE IF NOT EXISTS room_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_room_member UNIQUE (room_id, user_id)
);

ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read room members" ON room_members;
CREATE POLICY "Anyone can read room members" ON room_members
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can join rooms" ON room_members;
CREATE POLICY "Authenticated users can join rooms" ON room_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave rooms" ON room_members;
CREATE POLICY "Users can leave rooms" ON room_members
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════ TABELA: direct_chats ═══════
CREATE TABLE IF NOT EXISTS direct_chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  initiator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_dm_pair UNIQUE (LEAST(initiator_id, receiver_id), GREATEST(initiator_id, receiver_id))
);

ALTER TABLE direct_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own DMs" ON direct_chats;
CREATE POLICY "Users can read own DMs" ON direct_chats
  FOR SELECT USING (auth.uid() = initiator_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Authenticated users can create DMs" ON direct_chats;
CREATE POLICY "Authenticated users can create DMs" ON direct_chats
  FOR INSERT WITH CHECK (auth.uid() = initiator_id);

-- ═══════ TABELA: messages ═══════
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('room', 'dm')),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  dm_id UUID REFERENCES direct_chats(id) ON DELETE CASCADE,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id) WHERE target_type = 'room';
CREATE INDEX IF NOT EXISTS idx_messages_dm ON messages(dm_id) WHERE target_type = 'dm';

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read messages in their rooms/dms" ON messages;
CREATE POLICY "Users can read messages in their rooms/dms" ON messages
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create messages" ON messages;
CREATE POLICY "Authenticated users can create messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ═══════ TABELA: profile_photos ═══════
CREATE TABLE IF NOT EXISTS profile_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  caption TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_photos_user ON profile_photos(user_id);

ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read profile photos" ON profile_photos;
CREATE POLICY "Anyone can read profile photos" ON profile_photos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create own profile photos" ON profile_photos;
CREATE POLICY "Users can create own profile photos" ON profile_photos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own profile photos" ON profile_photos;
CREATE POLICY "Users can delete own profile photos" ON profile_photos
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════ TABELA: profile_videos ═══════
CREATE TABLE IF NOT EXISTS profile_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  storage_path TEXT,
  thumbnail_url TEXT,
  duration REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profile_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read profile videos" ON profile_videos;
CREATE POLICY "Anyone can read profile videos" ON profile_videos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create own profile videos" ON profile_videos;
CREATE POLICY "Users can create own profile videos" ON profile_videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own profile videos" ON profile_videos;
CREATE POLICY "Users can delete own profile videos" ON profile_videos
  FOR DELETE USING (auth.uid() = user_id);

-- ═══════ TABELA: profile_photo_comments / reactions ═══════
CREATE TABLE IF NOT EXISTS profile_photo_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID REFERENCES profile_photos(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile_photo_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID REFERENCES profile_photos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT DEFAULT 'like',
  CONSTRAINT unique_photo_reaction UNIQUE (photo_id, user_id, type)
);

CREATE TABLE IF NOT EXISTS profile_video_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID REFERENCES profile_videos(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile_video_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID REFERENCES profile_videos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT DEFAULT 'like',
  CONSTRAINT unique_video_reaction UNIQUE (video_id, user_id, type)
);

-- ═══════ RPC FUNCTIONS ═══════

-- Increment comment count
CREATE OR REPLACE FUNCTION increment_comment_count(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE posts SET comment_count = comment_count + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement comment count
CREATE OR REPLACE FUNCTION decrement_comment_count(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════ STORAGE BUCKETS ═══════
-- Execute estes comandos para criar os buckets de storage:

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('post-photos', 'post-photos', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('post-videos', 'post-videos', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('post-audios', 'post-audios', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-videos', 'profile-videos', true) ON CONFLICT DO NOTHING;

-- Storage policies para avatars
DROP POLICY IF EXISTS "Anyone can read avatars" ON storage.objects;
CREATE POLICY "Anyone can read avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies para post-photos
DROP POLICY IF EXISTS "Anyone can read post-photos" ON storage.objects;
CREATE POLICY "Anyone can read post-photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-photos');

DROP POLICY IF EXISTS "Authenticated users can upload post-photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload post-photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'post-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies para post-videos
DROP POLICY IF EXISTS "Anyone can read post-videos" ON storage.objects;
CREATE POLICY "Anyone can read post-videos" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-videos');

DROP POLICY IF EXISTS "Authenticated users can upload post-videos" ON storage.objects;
CREATE POLICY "Authenticated users can upload post-videos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'post-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies para post-audios
DROP POLICY IF EXISTS "Anyone can read post-audios" ON storage.objects;
CREATE POLICY "Anyone can read post-audios" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-audios');

DROP POLICY IF EXISTS "Authenticated users can upload post-audios" ON storage.objects;
CREATE POLICY "Authenticated users can upload post-audios" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'post-audios' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies para profile-videos
DROP POLICY IF EXISTS "Anyone can read profile-videos" ON storage.objects;
CREATE POLICY "Anyone can read profile-videos" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-videos');

DROP POLICY IF EXISTS "Authenticated users can upload profile-videos" ON storage.objects;
CREATE POLICY "Authenticated users can upload profile-videos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'profile-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ═══════ SALA GERAL (criar sala padrão) ═══════
INSERT INTO rooms (name, slug, icon, description, type, is_active)
VALUES ('Geral Feira de Santana', 'geral-fsa', '🏙️', 'Sala geral para todos de Feira de Santana', 'official', true)
ON CONFLICT (slug) DO NOTHING;

-- ═══════ TRIGGER: auto-create profile on signup ═══════
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, username, bio)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', replace(split_part(NEW.email, '@', 1), '.', '_')),
    ''
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
