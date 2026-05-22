'use client';

import React, { useState, useCallback } from 'react';
import MiniTextEditor from '@/components/mini-text-editor';
import Feed from '@/components/feed';
import type { Post, MediaItem, Comment } from '@/types/post';

// Sample seed data for demonstration
const SAMPLE_POSTS: Post[] = [
  {
    id: 'seed-1',
    author: 'Maria da Feira',
    avatarUrl: '',
    content: 'Olá pessoal! 🌶️ Hoje chegaram <b>pimentões fresquíssimos</b> direto do sítio! Também temos <i>manjericão</i> orgânico e <u>tomates cereja</u> maravilhosos. Venham conferir!',
    media: [
      { type: 'image', url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&q=80' },
      { type: 'image', url: 'https://images.unsplash.com/photo-1592838064575-70ed626d3a0e?w=800&q=80' },
    ],
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    likes: 12,
    liked: false,
    comments: [
      {
        id: 'c1',
        author: 'João Silva',
        avatarUrl: '',
        content: 'Adoro os pimentões da Maria! Sempre frescos! 😍',
        timestamp: new Date(Date.now() - 1000 * 60 * 15),
      },
    ],
  },
  {
    id: 'seed-2',
    author: 'Pedro Hortifruti',
    avatarUrl: '',
    content: 'A feira de sábado está <b>incrível</b> hoje! Frutas de temporada com preços ótimos. Mamão, abacaxi e manga estão imperdíveis! 🥭🍍',
    media: [
      { type: 'image', url: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800&q=80' },
    ],
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    likes: 24,
    liked: true,
    comments: [],
  },
  {
    id: 'seed-3',
    author: 'Ana Orgânicos',
    avatarUrl: '',
    content: 'Novidades na banca! Trouxemos <b>couve-flor roxa</b>, <i>rúcula selvagem</i> e aquele mel de laranjeira que todo mundo ama. Produtos 100% orgânicos certificados! 🌿🍯',
    media: [
      { type: 'image', url: 'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=800&q=80' },
      { type: 'image', url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&q=80' },
      { type: 'image', url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=800&q=80' },
    ],
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
    likes: 38,
    liked: false,
    comments: [
      {
        id: 'c2',
        author: 'Carlos Mendes',
        avatarUrl: '',
        content: 'Vou passar lá! O mel de laranjeira é espetacular 🍯',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
      },
      {
        id: 'c3',
        author: 'Lucia Ferreira',
        avatarUrl: '',
        content: 'Couve-flor roxa?! Nunca vi! Quero experimentar!',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      },
    ],
  },
];

let commentCounter = 100;

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>(SAMPLE_POSTS);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  const handlePublish = useCallback(
    (content: string, media: MediaItem[], editingPostId: string | null) => {
      if (editingPostId) {
        // Update existing post - THIS IS THE KEY: proper immutable state update
        setPosts(prev =>
          prev.map(post =>
            post.id === editingPostId
              ? { ...post, content, media, timestamp: new Date() }
              : post
          )
        );
        setEditingPost(null);
      } else {
        // Create new post
        const newPost: Post = {
          id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          author: 'Você',
          avatarUrl: '',
          content,
          media,
          timestamp: new Date(),
          likes: 0,
          liked: false,
          comments: [],
        };
        // Add to beginning of array
        setPosts(prev => [newPost, ...prev]);
      }
    },
    []
  );

  const handleLike = useCallback((postId: string) => {
    setPosts(prev =>
      prev.map(post =>
        post.id === postId
          ? {
              ...post,
              liked: !post.liked,
              likes: post.liked ? post.likes - 1 : post.likes + 1,
            }
          : post
      )
    );
  }, []);

  const handleEdit = useCallback((post: Post) => {
    setEditingPost(post);
    // Scroll to top to show the editor
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingPost(null);
  }, []);

  const handleComment = useCallback((postId: string, comment: string) => {
    const newComment: Comment = {
      id: `comment-${commentCounter++}`,
      author: 'Você',
      avatarUrl: '',
      content: comment,
      timestamp: new Date(),
    };
    setPosts(prev =>
      prev.map(post =>
        post.id === postId
          ? { ...post, comments: [...post.comments, newComment] }
          : post
      )
    );
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-green-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-orange-600 via-orange-500 to-green-600 shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="size-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center overflow-hidden">
            <span className="text-xl">🏪</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Gente da Feira
            </h1>
            <p className="text-[11px] text-white/70 font-medium">
              A comunidade da feira • Compartilhe, conecte, celebre
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Mini Text Editor */}
        <MiniTextEditor
          editingPost={editingPost}
          onPublish={handlePublish}
          onCancelEdit={handleCancelEdit}
        />

        {/* Feed Section Header */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-300 to-transparent" />
          <span className="text-sm font-semibold text-orange-700 tracking-wide uppercase">
            Publicações
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-300 to-transparent" />
        </div>

        {/* Feed */}
        <Feed
          posts={posts}
          onLike={handleLike}
          onEdit={handleEdit}
          onComment={handleComment}
        />

        {/* Footer */}
        <footer className="text-center py-8 text-gray-400 text-xs">
          <p>Gente da Feira © 2025 • Feito com 💚 para a comunidade</p>
        </footer>
      </main>
    </div>
  );
}
