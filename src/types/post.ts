export interface MediaItem {
  type: 'image' | 'video';
  url: string;
}

export interface Post {
  id: string;
  author: string;
  avatarUrl: string;
  content: string; // rich text HTML from contentEditable
  media: MediaItem[];
  timestamp: Date;
  likes: number;
  liked: boolean;
  comments: Comment[];
}

export interface Comment {
  id: string;
  author: string;
  avatarUrl: string;
  content: string;
  timestamp: Date;
}
