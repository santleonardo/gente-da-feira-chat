import React from "react";

const URL_REGEX = /(https?:\/\/[^\s<>"')\]]+)/g;
const MENTION_REGEX = /@(\w+)/g;

// Cache username → userId to avoid repeated lookups
const usernameCache = new Map<string, string | null>();

/**
 * Resolves a username to a user ID via the API, with caching.
 */
export async function resolveUsernameToId(username: string): Promise<string | null> {
  const lower = username.toLowerCase();
  if (usernameCache.has(lower)) return usernameCache.get(lower)!;
  try {
    const res = await fetch(`/api/users?username=${encodeURIComponent(lower)}`);
    if (!res.ok) { usernameCache.set(lower, null); return null; }
    const data = await res.json();
    const userId = data.user?.id || null;
    usernameCache.set(lower, userId);
    return userId;
  } catch {
    usernameCache.set(lower, null);
    return null;
  }
}

/**
 * Opens a user profile from a mention click.
 * First resolves the username to a user ID, then opens the profile dialog.
 */
export function openProfileFromMention(username: string, openUserProfile?: (userId: string) => void) {
  if (!openUserProfile) return;
  const lower = username.toLowerCase();
  const cached = usernameCache.get(lower);
  if (cached) {
    openUserProfile(cached);
    return;
  }
  resolveUsernameToId(lower).then((userId) => {
    if (userId) openUserProfile(userId);
  });
}

/**
 * Extracts all @mentions from a text string.
 */
export function extractMentions(text: string): string[] {
  const matches = text.matchAll(MENTION_REGEX);
  const mentions = new Set<string>();
  for (const m of matches) {
    mentions.add(m[1].toLowerCase());
  }
  return Array.from(mentions);
}

/**
 * Checks if text contains @mentions.
 */
export function hasMentions(text: string): boolean {
  MENTION_REGEX.lastIndex = 0;
  return MENTION_REGEX.test(text);
}

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
    URL_REGEX.lastIndex = 0;
    return part;
  });
}

/**
 * Renders text content with @mentions converted to clickable styled spans.
 * Also processes URLs via renderContentWithLinks.
 * Returns an array of React elements.
 */
export function renderContentWithMentions(
  text: string | null,
  openUserProfile?: (userId: string) => void,
  options?: {
    mentionClassName?: string;
    linkClassName?: string;
    isMine?: boolean;
  }
): React.ReactNode[] {
  if (!text) return [];

  const { mentionClassName, linkClassName, isMine } = options || {};

  const urlParts = text.split(URL_REGEX);

  const result: React.ReactNode[] = [];
  let keyIdx = 0;

  for (const part of urlParts) {
    URL_REGEX.lastIndex = 0;
    if (URL_REGEX.test(part)) {
      result.push(
        <a
          key={`url-${keyIdx++}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName || "text-[#0A4D5C] underline decoration-[#0A4D5C]/40 underline-offset-2 hover:decoration-[#0A4D5C] transition-colors"}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
      continue;
    }

    MENTION_REGEX.lastIndex = 0;
    const mentionParts = part.split(MENTION_REGEX);

    if (mentionParts.length <= 1) {
      result.push(part);
      continue;
    }

    for (let i = 0; i < mentionParts.length; i++) {
      const segment = mentionParts[i];
      if (i % 2 === 0) {
        if (segment) result.push(segment);
      } else {
        const defaultMentionClass = isMine
          ? "text-primary-foreground/90 font-semibold underline decoration-primary-foreground/30 underline-offset-2 hover:decoration-primary-foreground/60 cursor-pointer transition-colors"
          : "text-[#0A4D5C] font-semibold underline decoration-[#0A4D5C]/30 underline-offset-2 hover:decoration-[#0A4D5C]/60 cursor-pointer transition-colors";
        result.push(
          <span
            key={`mention-${keyIdx++}`}
            className={mentionClassName || defaultMentionClass}
            onClick={(e) => {
              e.stopPropagation();
              openProfileFromMention(segment, openUserProfile);
            }}
          >
            @{segment}
          </span>
        );
      }
    }
  }

  return result;
}
