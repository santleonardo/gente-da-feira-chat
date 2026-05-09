"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, getAvatarColor } from "@/lib/constants";

/**
 * Avatar que funciona em TODO o app:
 * - Se tiver avatar_url (storage), usa a foto
 * - Se tiver avatar (campo antigo), usa como fallback
 * - Senão, mostra as iniciais com cor
 */
export function UserAvatar({
  user,
  className,
}: {
  user: {
    id: string;
    display_name: string;
    avatar?: string | null;
    avatar_url?: string | null;
  };
  className?: string;
}) {
  const src = user.avatar_url || user.avatar || null;

  return (
    <Avatar className={className}>
      {src && <AvatarImage src={src} alt={user.display_name} />}
      <AvatarFallback className={`${getAvatarColor(user.id)} text-white`}>
        {getInitials(user.display_name)}
      </AvatarFallback>
    </Avatar>
  );
}
