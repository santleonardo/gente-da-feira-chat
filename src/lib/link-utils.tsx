import React from "react";

const URL_REGEX = /(https?:\/\/[^\s<>"')\]]+)/g;

/**
 * Renders text content with URLs converted to clickable links.
 * Returns an array of React elements (text spans and anchor tags).
 */
export function renderContentWithLinks(text: string, linkClassName?: string): React.ReactNode[] {
  if (!text) return [text];

  const parts = text.split(URL_REGEX);
  if (parts.length <= 1) return [text];

  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      // Reset regex lastIndex since we're re-testing
      URL_REGEX.lastIndex = 0;
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName || "text-[#0A4D5C] underline decoration-[#0A4D5C]/40 underline-offset-2 hover:decoration-[#0A4D5C] transition-colors"}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    // Reset regex lastIndex
    URL_REGEX.lastIndex = 0;
    return part;
  });
}

// ═══════════════════════════════════════════════════════════
// @MENTION SUPPORT
// ═══════════════════════════════════════════════════════════

const MENTION_REGEX = /@(\w[\w.-]{0,29})/g;

/** Cache: username -> { id, avatar } */
const usernameCache = new Map<string, { id: string; avatar: string | null }>();

/** Resolve usernames to user IDs in bulk. Returns the cache map. */
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
  for (const u of usernames) {
    const cached = usernameCache.get(u);
    if (cached) result[u] = cached;
  }
  return result;
}

/** Check if text contains @mentions */
export function hasMentions(text: string): boolean {
  MENTION_REGEX.lastIndex = 0;
  return MENTION_REGEX.test(text);
}

/** Extract unique usernames from @mentions in text */
export function extractMentions(text: string): string[] {
  MENTION_REGEX.lastIndex = 0;
  const matches = text.matchAll(MENTION_REGEX);
  const set = new Set<string>();
  for (const m of matches) {
    set.add(m[1]);
  }
  return Array.from(set);
}

/**
 * Renders text content with @mentions as clickable links AND URLs as clickable links.
 * This replaces renderContentWithLinks for components that want mention support.
 * The openUserProfile callback is optional — if provided, @mentions will be clickable.
 */
export function renderContentWithMentions(
  text: string,
  openUserProfile?: (userId: string) => void,
  options?: { linkClassName?: string }
): React.ReactNode[] {
  if (!text) return [text];

  // Combined regex: URLs first (highest priority), then @mentions
  const combinedRegex = /(https?:\/\/[^\s<>"')\]]+)|@(\w[\w.-]{0,29})/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = combinedRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(<React.Fragment key={`t${key++}`}>{text.slice(lastIndex, match.index)}</React.Fragment>);
    }

    if (match[1]) {
      // URL match
      parts.push(
        <a
          key={`url${key++}`}
          href={match[1]}
          target="_blank"
          rel="noopener noreferrer"
          className={options?.linkClassName || "text-[#0A4D5C] underline decoration-[#0A4D5C]/40 underline-offset-2 hover:decoration-[#0A4D5C] transition-colors"}
          onClick={(e) => e.stopPropagation()}
        >
          {match[1]}
        </a>
      );
    } else if (match[2]) {
      // @mention match
      const username = match[2];
      const cached = usernameCache.get(username);
      const userId = cached?.id;

      if (openUserProfile && userId) {
        parts.push(
          <a
            key={`mention${key++}`}
            href="#"
            className="text-[#0A4D5C] font-semibold hover:underline underline-offset-2 transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openUserProfile(userId);
            }}
          >
            @{username}
          </a>
        );
      } else {
        parts.push(
          <span key={`mention${key++}`} className="text-[#0A4D5C] font-semibold">
            @{username}
          </span>
        );
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(<React.Fragment key={`r${key++}`}>{text.slice(lastIndex)}</React.Fragment>);
  }

  return parts.length > 0 ? parts : [text];
}
