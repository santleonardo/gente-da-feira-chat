'use client';

import React from 'react';
import FeedPost from './feed-post';
import type { Post } from '@/types/post';

interface FeedProps {
  posts: Post[];
  onLike: (postId: string) => void;
  onEdit: (post: Post) => void;
  onComment: (postId: string, comment: string) => void;
}

export default function Feed({ posts, onLike, onEdit, onComment }: FeedProps) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="size-24 rounded-full bg-gradient-to-br from-orange-100 to-green-100 flex items-center justify-center mb-4">
          <span className="text-4xl">🥬</span>
        </div>
        <h3 className="text-lg font-bold text-gray-700 mb-2">Nenhuma publicação ainda</h3>
        <p className="text-gray-400 text-sm text-center max-w-sm">
          Seja o primeiro a compartilhar algo sobre a feira! Use o editor acima para criar sua primeira publicação.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map(post => (
        <FeedPost
          key={post.id}
          post={post}
          onLike={onLike}
          onEdit={onEdit}
          onComment={onComment}
        />
      ))}
    </div>
  );
}
