'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Bold,
  Italic,
  Underline,
  Image as ImageIcon,
  Video,
  Send,
  X,
  Type,
} from 'lucide-react';
import type { Post, MediaItem } from '@/types/post';

const MAX_CHARS = 2000;

interface MiniTextEditorProps {
  editingPost: Post | null;
  onPublish: (content: string, media: MediaItem[], editingPostId: string | null) => void;
  onCancelEdit: () => void;
}

export default function MiniTextEditor({ editingPost, onPublish, onCancelEdit }: MiniTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [charCount, setCharCount] = useState(0);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditorEmpty, setIsEditorEmpty] = useState(true);
  const isComposingRef = useRef(false);
  const prevEditingPostIdRef = useRef<string | null>(null);

  // Sync state when editingPost changes (React pattern: setState during render for derived state)
  const currentEditingId = editingPost?.id ?? null;
  if (currentEditingId !== prevEditingPostIdRef.current) {
    prevEditingPostIdRef.current = currentEditingId;
    if (editingPost) {
      setMedia([...editingPost.media]);
    } else {
      setMedia([]);
    }
    setCharCount(0);
    setIsEditorEmpty(!editingPost);
  }

  // DOM updates must happen in useEffect (not during render)
  useEffect(() => {
    if (editorRef.current) {
      if (editingPost) {
        editorRef.current.innerHTML = editingPost.content;
        editorRef.current.focus();
      } else {
        editorRef.current.innerHTML = '';
      }
    }
  }, [editingPost]);

  const updateCharCount = useCallback(() => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || '';
      setCharCount(text.trim().length);
    }
  }, []);

  const updateEmptyState = useCallback(() => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || '';
      setIsEditorEmpty(text.trim().length === 0 && editorRef.current.innerHTML === '');
    }
  }, []);

  const handleInput = useCallback(() => {
    updateCharCount();
    updateEmptyState();
  }, [updateCharCount, updateEmptyState]);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    updateCharCount();
    updateEmptyState();
  }, [updateCharCount, updateEmptyState]);

  const handleAddMedia = useCallback(() => {
    if (!mediaUrl.trim()) return;

    const newMedia: MediaItem = {
      type: mediaType,
      url: mediaUrl.trim(),
    };
    setMedia(prev => [...prev, newMedia]);
    setMediaUrl('');
    setDialogOpen(false);
  }, [mediaUrl, mediaType]);

  const removeMedia = useCallback((index: number) => {
    setMedia(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handlePublish = useCallback(() => {
    if (!editorRef.current) return;

    const content = editorRef.current.innerHTML;
    const text = editorRef.current.innerText || '';

    if (text.trim().length === 0 && media.length === 0) return;

    onPublish(content, media, editingPost?.id ?? null);

    // Clear editor after publishing
    editorRef.current.innerHTML = '';
    setMedia([]);
    setCharCount(0);
    setIsEditorEmpty(true);
  }, [media, editingPost, onPublish]);

  const handleCancelEdit = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    setMedia([]);
    setCharCount(0);
    setIsEditorEmpty(true);
    onCancelEdit();
  }, [onCancelEdit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handlePublish();
    }
  }, [handlePublish]);

  return (
    <div className="rounded-xl border-2 border-orange-200 bg-white shadow-md overflow-hidden">
      {/* Editor Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-50 to-green-50 border-b border-orange-100">
        <Type className="size-5 text-orange-600" />
        <span className="font-semibold text-orange-800 text-sm">
          {editingPost ? 'Editar publicação' : 'Criar publicação'}
        </span>
        {editingPost && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancelEdit}
            className="ml-auto text-orange-600 hover:text-orange-800 hover:bg-orange-100"
          >
            <X className="size-4 mr-1" />
            Cancelar
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-gray-100">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 hover:bg-orange-100"
          onClick={() => execCommand('bold')}
          title="Negrito (Ctrl+B)"
        >
          <Bold className="size-4 text-gray-700" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 hover:bg-orange-100"
          onClick={() => execCommand('italic')}
          title="Itálico (Ctrl+I)"
        >
          <Italic className="size-4 text-gray-700" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 hover:bg-orange-100"
          onClick={() => execCommand('underline')}
          title="Sublinhado (Ctrl+U)"
        >
          <Underline className="size-4 text-gray-700" />
        </Button>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Add Image Dialog */}
        <Dialog open={dialogOpen && mediaType === 'image'} onOpenChange={(open) => { setDialogOpen(open); if (open) setMediaType('image'); }}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 hover:bg-green-100"
              title="Adicionar foto"
            >
              <ImageIcon className="size-4 text-green-700" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Foto</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Cole a URL da imagem..."
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddMedia(); }}
              />
              {mediaUrl && (
                <div className="rounded-lg overflow-hidden border bg-gray-50">
                  <img
                    src={mediaUrl}
                    alt="Pré-visualização"
                    className="w-full max-h-48 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button onClick={handleAddMedia} disabled={!mediaUrl.trim()} className="bg-green-600 hover:bg-green-700 text-white">
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Video Dialog */}
        <Dialog open={dialogOpen && mediaType === 'video'} onOpenChange={(open) => { setDialogOpen(open); if (open) setMediaType('video'); }}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 hover:bg-green-100"
              title="Adicionar vídeo"
            >
              <Video className="size-4 text-green-700" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Vídeo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Cole a URL do vídeo..."
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddMedia(); }}
              />
              {mediaUrl && (
                <div className="rounded-lg overflow-hidden border bg-gray-50">
                  <video
                    src={mediaUrl}
                    className="w-full max-h-48 object-cover"
                    controls
                    muted
                    onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button onClick={handleAddMedia} disabled={!mediaUrl.trim()} className="bg-green-600 hover:bg-green-700 text-white">
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ContentEditable Editor */}
      <div className="px-4 py-3">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={() => { isComposingRef.current = false; handleInput(); }}
          data-placeholder="O que está acontecendo na feira hoje? 🌶️🥬"
          className="min-h-[100px] max-h-[300px] overflow-y-auto outline-none text-gray-800 text-base leading-relaxed
            [&:empty]:before:content-[attr(data-placeholder)]
            [&:empty]:before:text-gray-400
            [&:empty]:before:pointer-events-none
            [&_b]:font-bold
            [&_i]:italic
            [&_u]:underline"
        />
      </div>

      {/* Media Preview */}
      {media.length > 0 && (
        <div className="px-4 pb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {media.map((item, index) => (
              <div key={index} className="relative group rounded-lg overflow-hidden border bg-gray-50">
                {item.type === 'image' ? (
                  <img
                    src={item.url}
                    alt={`Mídia ${index + 1}`}
                    className="w-full h-40 object-cover"
                  />
                ) : (
                  <video
                    src={item.url}
                    className="w-full h-40 object-cover"
                    controls
                    muted
                  />
                )}
                <button
                  onClick={() => removeMedia(index)}
                  className="absolute top-1 right-1 size-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-50/50 to-green-50/50 border-t border-orange-100">
        <span className={`text-xs ${charCount > MAX_CHARS ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
          {charCount}/{MAX_CHARS}
        </span>
        <Button
          onClick={handlePublish}
          disabled={(isEditorEmpty && media.length === 0) || charCount > MAX_CHARS}
          className="bg-gradient-to-r from-orange-500 to-green-600 hover:from-orange-600 hover:to-green-700 text-white shadow-md transition-all duration-200 hover:shadow-lg px-6"
        >
          <Send className="size-4 mr-2" />
          {editingPost ? 'Atualizar' : 'Publicar'}
        </Button>
      </div>
    </div>
  );
}
