import React from "react";

const URL_REGEX = /(https?:\/\/[^\s<>"')\]]+)/g;
const MENTION_REGEX = /@(\w[\w.-]{0,29})/g;

export function renderContentWithLinks(
  text: string,
  linkClassName?: string,
  onOpenUserProfile?: (userId: string) => void
): React.ReactNode[] {
  if (!text) return [text];

  const combinedRegex = /(https?:\/\/[^\s<>"')\]]+)|@(\w[\w.-]{0,29})/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`t${key++}`}>{text.slice(lastIndex, match.index)}</span>
      );
    }

    if (match[1]) {
      parts.push(
        <a
          key={`url${key++}`}
          href={match[1]}
          target="_blank"
          rel="noopener noreferrer"
          className={
            linkClassName ||
            "text-[#0A4D5C] underline decoration-[#0A4D5C]/40 underline-offset-2 hover:decoration-[#0A4D5C] transition-colors"
          }
          onClick={(e) => e.stopPropagation()}
        >
          {match[1]}
        </a>
      );
    } else if (match[2]) {
      const username = match[2];
      if (onOpenUserProfile) {
        parts.push(
          <a
            key={`mention${key++}`}
            href="#"
            className="font-bold underline underline-offset-2 decoration-current/50 hover:decoration-current transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openProfileFromMention(username, onOpenUserProfile);
            }}
          >
            @{username}
          </a>
        );
      } else {
        parts.push(
          <span key={`mention${key++}`} className="font-bold">
            @{username}
          </span>
        );
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`r${key++}`}>{text.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : [text];
}

// ═══════════════════════════════════════════════════════════
// @MENTION SUPPORT
// ═══════════════════════════════════════════════════════════

export const usernameCache = new Map<string, { id: string; avatar: string | null }>();

export async function resolveMentionUsernames(usernames: string[]): Promise<Record<string, { id: string; avatar: string | null }>> {
  const uncached = usernames.filter((u) => !usernameCache.has(u));
  if (uncached.length > 0) {
    try {
      const res = await fetch(`/api/users?usernames=${uncached.join(",")}`);
      if (res.ok) {
        const data = await res.json();
        for (const [username, info] of Object.entries(data.users || {})) {
          usernameCache.set(username, info as { id: string; avatar: string | null });
        }
      }
    } catch { /* silent */ }
  }
  const result: Record<string, { id: string; avatar: string | null }> = {};
  for (const u of usernames) { const cached = usernameCache.get(u); if (cached) result[u] = cached; }
  return result;
}

export function hasMentions(text: string): boolean {
  MENTION_REGEX.lastIndex = 0;
  return MENTION_REGEX.test(text);
}

export function extractMentions(text: string): string[] {
  MENTION_REGEX.lastIndex = 0;
  const set = new Set<string>();
  for (const m of text.matchAll(MENTION_REGEX)) set.add(m[1]);
  return Array.from(set);
}

export async function openProfileFromMention(
  username: string,
  openUserProfile: (userId: string) => void
) {
  const cached = usernameCache.get(username);
  if (cached?.id) {
    openUserProfile(cached.id);
    return;
  }
  try {
    const res = await fetch(`/api/users?usernames=${encodeURIComponent(username)}`);
    if (res.ok) {
      const data = await res.json();
      const info = data.users?.[username];
      if (info?.id) {
        usernameCache.set(username, info);
        openUserProfile(info.id);
        return;
      }
    }
  } catch { /* silent */ }
}

/**
 * Renders text with both URLs and @mentions as clickable elements.
 * Uses inherited text color + bold + underline for mentions so they are
 * always visible regardless of the bubble background (light or dark).
 */
export function renderContentWithMentions(
  text: string,
  openUserProfile?: (userId: string) => void,
  options?: { linkClassName?: string }
): React.ReactNode[] {
  if (!text) return [text];

  const combinedRegex = /(https?:\/\/[^\s<>"')\]]+)|@(\w[\w.-]{0,29})/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<React.Fragment key={`t${key++}`}>{text.slice(lastIndex, match.index)}</React.Fragment>);
    }

    if (match[1]) {
      // URL
      parts.push(
        <a
          key={`url${key++}`}
          href={match[1]}
          target="_blank"
          rel="noopener noreferrer"
          className={options?.linkClassName || "underline underline-offset-2 decoration-current/50 hover:decoration-current transition-colors"}
          onClick={(e) => e.stopPropagation()}
        >
          {match[1]}
        </a>
      );
    } else if (match[2]) {
      // @mention — uses inherited color + bold + underline so it's visible on ANY background
      const username = match[2];
      if (openUserProfile) {
        parts.push(
          <a
            key={`mention${key++}`}
            href="#"
            className="font-bold underline underline-offset-2 decoration-current/50 hover:decoration-current transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openProfileFromMention(username, openUserProfile);
            }}
          >
            @{username}
          </a>
        );
      } else {
        parts.push(
          <span key={`mention${key++}`} className="font-bold">
            @{username}
          </span>
        );
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<React.Fragment key={`r${key++}`}>{text.slice(lastIndex)}</React.Fragment>);
  }

  return parts.length > 0 ? parts : [text];
}
