import React from "react";

const URL_REGEX = /(https?:\/\/[^\s<>"')\]]+)/g;

export function renderContentWithLinks(text: string, linkClassName?: string): React.ReactNode[] {
  if (!text) return [text];
  const parts = text.split(URL_REGEX);
  if (parts.length <= 1) return [text];
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          className={linkClassName || "text-[#0A4D5C] underline decoration-[#0A4D5C]/40 underline-offset-2 hover:decoration-[#0A4D5C] transition-colors"}
          onClick={(e) => e.stopPropagation()}>
          {part}
        </a>
      );
    }
    URL_REGEX.lastIndex = 0;
    return part;
  });
}

// ═══════════════════════════════════════════════════════════
// @MENTION SUPPORT
// ═══════════════════════════════════════════════════════════

const MENTION_REGEX = /@(\w[\w.-]{0,29})/g;
const usernameCache = new Map<string, { id: string; avatar: string | null }>();

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
      parts.push(
        <a key={`url${key++}`} href={match[1]} target="_blank" rel="noopener noreferrer"
          className={options?.linkClassName || "text-[#0A4D5C] underline decoration-[#0A4D5C]/40 underline-offset-2 hover:decoration-[#0A4D5C] transition-colors"}
          onClick={(e) => e.stopPropagation()}>
          {match[1]}
        </a>
      );
    } else if (match[2]) {
      const username = match[2];
      const userId = usernameCache.get(username)?.id;
      if (openUserProfile && userId) {
        parts.push(
          <a key={`mention${key++}`} href="#" className="text-[#0A4D5C] font-semibold hover:underline underline-offset-2 transition-colors"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); openUserProfile(userId); }}>
            @{username}
          </a>
        );
      } else {
        parts.push(<span key={`mention${key++}`} className="text-[#0A4D5C] font-semibold">@{username}</span>);
      }
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<React.Fragment key={`r${key++}`}>{text.slice(lastIndex)}</React.Fragment>);
  }
  return parts.length > 0 ? parts : [text];
}
