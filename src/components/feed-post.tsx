'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Heart,
  MessageCircle,
  Share2,
  Pencil,
  MoreHorizontal,
  ThumbsUp,
} from 'lucide-react';
import type { Post } from '@/types/post';

interface FeedPostProps {
  post: Post;
  onLike: (postId: string) => void;
  onEdit: (post: Post) => void;
  onComment: (postId: string, comment: string) => void;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'agora mesmo';
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffHour < 24) return `há ${diffHour}h`;
  if (diffDay < 7) return `há ${diffDay}d`;
  return date.toLocaleDateString('pt-BR');
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function FeedPost({ post, onLike, onEdit, onComment }: FeedPostProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showFullMenu, setShowFullMenu] = useState(false);

  const handleComment = () => {
    if (!commentText.trim()) return;
    onComment(post.id, commentText.trim());
    setCommentText('');
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleComment();
    }
  };

  return (
    <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow duration-300 bg-white">
      {/* Post Header */}
      <CardContent className="pb-0 pt-4 px-4">
        <div className="flex items-start gap-3">
          <Avatar className="size-11 ring-2 ring-orange-200 ring-offset-1">
            <AvatarImage src={post.avatarUrl} alt={post.author} />
            <AvatarFallback className="bg-gradient-to-br from-orange-400 to-green-500 text-white font-bold text-sm">
              {getInitials(post.author)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">{post.author}</h3>
                <p className="text-xs text-gray-400">{formatTimeAgo(post.timestamp)}</p>
              </div>
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  onClick={() => setShowFullMenu(!showFullMenu)}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
                {showFullMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowFullMenu(false)} />
                    <div className="absolute right-0 top-8 z-20 bg-white rounded-lg shadow-xl border py-1 min-w-[140px]">
                      <button
                        onClick={() => { onEdit(post); setShowFullMenu(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 w-full text-left transition-colors"
                      >
                        <Pencil className="size-3.5" />
                        Editar
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Post Content */}
      {post.content && (
        <CardContent className="py-3 px-4">
          <div
            className="text-gray-800 text-[15px] leading-relaxed break-words
              [&_b]:font-bold [&_strong]:font-bold
              [&_i]:italic [&_em]:italic
              [&_u]:underline"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </CardContent>
      )}

      {/* Media - LARGE DISPLAY */}
      {post.media.length > 0 && (
        <div className="px-0">
          {post.media.length === 1 ? (
            // Single media - full width, very large
            <div className="w-full">
              {post.media[0].type === 'image' ? (
                <img
                  src={post.media[0].url}
                  alt="Foto da publicação"
                  className="w-full max-h-[600px] object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '';
                    (e.target as HTMLImageElement).alt = 'Imagem não encontrada';
                    (e.target as HTMLImageElement).className = 'w-full h-48 bg-gray-100 flex items-center justify-center text-gray-400';
                  }}
                />
              ) : (
                <video
                  src={post.media[0].url}
                  className="w-full min-h-[400px] max-h-[600px] object-cover"
                  controls
                  preload="metadata"
                />
              )}
            </div>
          ) : (
            // Multiple media - grid layout, still large
            <div className={`grid gap-1 ${
              post.media.length === 2 ? 'grid-cols-2' :
              post.media.length === 3 ? 'grid-cols-2' :
              'grid-cols-2'
            }`}>
              {post.media.map((item, index) => (
                <div
                  key={index}
                  className={`relative overflow-hidden ${
                    post.media.length === 3 && index === 0 ? 'col-span-2' : ''
                  }`}
                >
                  {item.type === 'image' ? (
                    <img
                      src={item.url}
                      alt={`Foto ${index + 1}`}
                      className="w-full max-h-[500px] object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <video
                      src={item.url}
                      className="w-full min-h-[300px] max-h-[500px] object-cover"
                      controls
                      preload="metadata"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Like count bar */}
      {(post.likes > 0 || post.comments.length > 0) && (
        <>
          <div className="px-4 pt-2 pb-1">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-1">
                {post.likes > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="inline-flex items-center justify-center size-5 rounded-full bg-gradient-to-r from-orange-500 to-red-500">
                      <ThumbsUp className="size-3 text-white" />
                    </span>
                    {post.likes}
                  </span>
                )}
              </div>
              {post.comments.length > 0 && (
                <button
                  onClick={() => setShowComments(!showComments)}
                  className="hover:text-orange-600 transition-colors"
                >
                  {post.comments.length} comentário{post.comments.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
          <Separator className="mx-4" />
        </>
      )}

      {/* Action Buttons */}
      <CardFooter className="py-1 px-2 justify-around">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onLike(post.id)}
          className={`flex-1 gap-1.5 text-sm transition-all duration-200 ${
            post.liked
              ? 'text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-semibold'
              : 'text-gray-500 hover:text-orange-600 hover:bg-orange-50'
          }`}
        >
          <Heart className={`size-4 ${post.liked ? 'fill-orange-500' : ''}`} />
          Curtir
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowComments(!showComments)}
          className="flex-1 gap-1.5 text-sm text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors"
        >
          <MessageCircle className="size-4" />
          Comentar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 gap-1.5 text-sm text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors"
        >
          <Share2 className="size-4" />
          Compartilhar
        </Button>
      </CardFooter>

      {/* Comments Section */}
      {showComments && (
        <>
          <Separator className="mx-4" />
          <div className="px-4 py-3 space-y-3">
            {/* Existing comments */}
            {post.comments.length > 0 && (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {post.comments.map(comment => (
                  <div key={comment.id} className="flex gap-2">
                    <Avatar className="size-7 ring-1 ring-gray-100">
                      <AvatarImage src={comment.avatarUrl} alt={comment.author} />
                      <AvatarFallback className="bg-orange-100 text-orange-700 text-[10px] font-bold">
                        {getInitials(comment.author)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="bg-gray-50 rounded-xl px-3 py-2">
                        <span className="font-semibold text-xs text-gray-900">{comment.author}</span>
                        <p className="text-sm text-gray-700 break-words">{comment.content}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 ml-3">{formatTimeAgo(comment.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Comment input */}
            <div className="flex gap-2 items-center">
              <Avatar className="size-7 ring-1 ring-gray-100">
                <AvatarFallback className="bg-gradient-to-br from-orange-400 to-green-500 text-white text-[10px] font-bold">
                  EU
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={handleCommentKeyDown}
                  placeholder="Escreva um comentário..."
                  className="flex-1 bg-gray-50 rounded-full px-4 py-1.5 text-sm outline-none focus:ring-2 focus:ring-orange-200 transition-shadow"
                />
                <Button
                  size="sm"
                  onClick={handleComment}
                  disabled={!commentText.trim()}
                  className="rounded-full size-8 p-0 bg-green-600 hover:bg-green-700 text-white"
                >
                  <MessageCircle className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
