import React from "react";

const URL_REGEX = /(https?:\/\/[^\s<>"')\]]+)/g;
const MENTION_REGEX = /@(\w+)/g;

/**
 * Renders text content with URLs and @mentions converted to clickable links.
 * - URLs become external links (open in new tab).
 * - @username mentions become clickable links that dispatch openUserProfile event
 *   (resolves username → userId automatically).
 * Returns an array of React elements (text spans, anchor tags, and mention buttons).
 */
export function renderContentWithLinks(
  text: string,
  linkClassName?: string,
  onOpenUserProfile?: (userId: string) => void
): React.ReactNode[] {
  if (!text) return [text];

  // Combined regex: URLs (highest priority), then @mentions, then plain text
  const combinedRegex = /(https?:\/\/[^\s<>"')\]]+)|@(\w+)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = combinedRegex.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(
        <span key={`t${key++}`}>{text.slice(lastIndex, match.index)}</span>
      );
    }

    if (match[1]) {
      // URL — clickable external link
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
      // @mention — clickable user mention
      const username = match[2];
      parts.push(
        <button
          key={`mention${key++}`}
          onClick={(e) => {
            e.stopPropagation();
            // Resolve username → userId, then open profile
            if (onOpenUserProfile) {
              resolveUsernameToUserId(username).then((userId) => {
                if (userId) onOpenUserProfile(userId);
              });
            } else {
              resolveUsernameToUserId(username).then((userId) => {
                if (userId) {
                  window.dispatchEvent(
                    new CustomEvent("openUserProfile", {
                      detail: { userId },
                    })
                  );
                }
              });
            }
          }}
          className="text-[#0A4D5C] font-semibold hover:underline underline-offset-2 transition-colors cursor-pointer bg-transparent border-0 p-0 m-0 inline"
          style={{ font: "inherit", lineHeight: "inherit" }}
        >
          @{username}
        </button>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last match
  if (lastIndex < text.length) {
    parts.push(<span key={`r${key++}`}>{text.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Resolves a username to a userId by fetching from the API.
 * Uses a simple cache to avoid repeated lookups.
 */
const usernameCache = new Map<string, string | null>();

async function resolveUsernameToUserId(username: string): Promise<string | null> {
  // Check cache first
  if (usernameCache.has(username)) {
    return usernameCache.get(username) || null;
  }

  try {
    const res = await fetch(`/api/users?q=${encodeURIComponent(username)}`);
    const data = await res.json();
    const users = data.users || [];
    // Find exact match by username (case-insensitive)
    const exactMatch = users.find(
      (u: { username: string }) => u.username.toLowerCase() === username.toLowerCase()
    );
    const userId = exactMatch?.id || null;
    usernameCache.set(username, userId);
    return userId;
  } catch {
    usernameCache.set(username, null);
    return null;
  }
}
