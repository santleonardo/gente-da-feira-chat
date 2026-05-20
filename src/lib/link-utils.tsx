import React from "react";

const URL_REGEX = /(https?:\/\/[^\s<>"')\]]+)/g;

// ============================================
// USERNAME → USER ID RESOLUTION CACHE
// ============================================

const usernameToUserIdCache = new Map<string, string | null>();

/**
 * Resolve a username to a userId via API, with caching.
 * Used when a @mention is clicked to navigate to the user's profile.
 */
export async function resolveUsernameToUserId(
  username: string,
  apiBaseUrl?: string
): Promise<string | null> {
  const cleanUsername = username.replace(/^@/, "").toLowerCase();

  if (usernameToUserIdCache.has(cleanUsername)) {
    return usernameToUserIdCache.get(cleanUsername) ?? null;
  }

  try {
    const baseUrl = apiBaseUrl || "/api";
    const response = await fetch(
      `${baseUrl}/users/resolve?username=${encodeURIComponent(cleanUsername)}`
    );
    if (!response.ok) {
      usernameToUserIdCache.set(cleanUsername, null);
      return null;
    }
    const data = await response.json();
    const userId = data?.userId || data?.id || null;
    usernameToUserIdCache.set(cleanUsername, userId);
    return userId;
  } catch (error) {
    console.error("Failed to resolve username:", cleanUsername, error);
    usernameToUserIdCache.set(cleanUsername, null);
    return null;
  }
}

export function clearUsernameCache() {
  usernameToUserIdCache.clear();
}

// ============================================
// MENTION DETECTION
// ============================================

/** Regex to match @mentions - @username preceded by start of text or whitespace */
export const MENTION_REGEX = /(?:^|\s)@(\w+)/g;

export function hasMentions(text: string): boolean {
  MENTION_REGEX.lastIndex = 0;
  return MENTION_REGEX.test(text);
}

export function extractMentions(text: string): string[] {
  MENTION_REGEX.lastIndex = 0;
  const mentions: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  return [...new Set(mentions)];
}

// ============================================
// ORIGINAL FUNCTION (unchanged)
// ============================================

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

// ============================================
// NEW: RENDER WITH LINKS + @MENTIONS
// ============================================

interface RenderContentWithMentionsOptions {
  openUserProfile?: (userId: string) => void;
  apiBaseUrl?: string;
  linkClassName?: string;
  mentionClassName?: string;
}

/**
 * Renders text content with BOTH URLs and @mentions as clickable elements.
 * - URLs become clickable links (same style as renderContentWithLinks)
 * - @mentions become clickable buttons that open the user's profile
 */
export function renderContentWithMentions(
  text: string,
  options: RenderContentWithMentionsOptions = {}
): React.ReactNode[] {
  const { openUserProfile, apiBaseUrl, linkClassName, mentionClassName } = options;
  if (!text) return [text];

  const COMBINED_REGEX = /(https?:\/\/[^\s<>"')\]]+|(?:^|\s)@\w+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let keyIndex = 0;
  let match: RegExpExecArray | null;
  COMBINED_REGEX.lastIndex = 0;

  while ((match = COMBINED_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${keyIndex++}`}>{text.substring(lastIndex, match.index)}</span>);
    }
    const matchedText = match[0];

    if (URL_REGEX.test(matchedText)) {
      URL_REGEX.lastIndex = 0;
      parts.push(
        <a
          key={`link-${keyIndex++}`}
          href={matchedText}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName || "text-[#0A4D5C] underline decoration-[#0A4D5C]/40 underline-offset-2 hover:decoration-[#0A4D5C] transition-colors"}
          onClick={(e) => e.stopPropagation()}
        >
          {matchedText}
        </a>
      );
    } else {
      const mentionMatch = matchedText.match(/@(\w+)/);
      if (mentionMatch) {
        const username = mentionMatch[1];
        const precedingWhitespace = matchedText.match(/^(\s)/)?.[1] || "";
        if (precedingWhitespace) {
          parts.push(<span key={`ws-${keyIndex}`}>{precedingWhitespace}</span>);
        }
        parts.push(
          <button
            key={`mention-${keyIndex++}`}
            className={mentionClassName || "gdf-mention text-[#0A4D5C] font-semibold hover:underline cursor-pointer bg-transparent border-none p-0 m-0 inline text-inherit font-inherit"}
            onClick={async (e) => {
              e.stopPropagation();
              if (openUserProfile) {
                const userId = await resolveUsernameToUserId(username, apiBaseUrl);
                if (userId) openUserProfile(userId);
              }
            }}
            title={`Ver perfil de @${username}`}
          >
            @{username}
          </button>
        );
      }
    }
    lastIndex = match.index + matchedText.length;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`text-${keyIndex++}`}>{text.substring(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : [text];
}

// ============================================
// NEW: PARSE INLINE FORMATTING WITH @MENTIONS
// (shared version for FeedView, ProfileView, UserProfileDialog)
// ============================================

/**
 * Parse inline formatting including @mentions, URLs, bold, italic.
 * This replaces the duplicated parseInlineFormatting in FeedView/ProfileView/UserProfileDialog.
 */
export function parseInlineFormattingWithMentions(
  text: string,
  onMentionClick?: (username: string) => void
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Combined regex: URLs, @mentions, ***bold+italic***, **bold**, _italic_
  const regex = /(https?:\/\/[^\s<>"')\]]+)|(?:^|\s)(@\w+)|(\*\*\*(.+?)\*\*\*)|(\*\*(.+?)\*\*)|_(.+?)_/g;
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<React.Fragment key={`t${key++}`}>{text.slice(lastIndex, match.index)}</React.Fragment>);
    }

    if (match[1]) {
      // URL
      parts.push(
        <a key={`url${key++}`} href={match[1]} target="_blank" rel="noopener noreferrer"
          className="text-[#0A4D5C] underline decoration-[#0A4D5C]/40 underline-offset-2 hover:decoration-[#0A4D5C] transition-colors"
          onClick={(e) => e.stopPropagation()}>
          {match[1]}
        </a>
      );
    } else if (match[2]) {
      // @mention
      const mentionText = match[2]; // e.g. "@joao" or " @joao"
      const hasLeadingSpace = /^(\s)/.test(mentionText);
      const username = mentionText.replace(/^\s/, "").replace(/^@/, "");

      if (hasLeadingSpace) {
        parts.push(<React.Fragment key={`ws${key++}`}> </React.Fragment>);
      }
      parts.push(
        <button
          key={`mention${key++}`}
          className="gdf-mention text-[#0A4D5C] font-semibold hover:underline cursor-pointer bg-transparent border-none p-0 m-0 inline text-inherit font-inherit"
          onClick={async (e) => {
            e.stopPropagation();
            if (onMentionClick) {
              onMentionClick(username);
            }
          }}
          title={`Ver perfil de @${username}`}
        >
          @{username}
        </button>
      );
    } else if (match[4]) {
      // ***bold+italic***
      parts.push(<strong key={`bi${key++}`}><em>{match[4]}</em></strong>);
    } else if (match[6]) {
      // **bold**
      parts.push(<strong key={`b${key++}`}>{match[6]}</strong>);
    } else if (match[7]) {
      // _italic_
      parts.push(<em key={`i${key++}`}>{match[7]}</em>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<React.Fragment key={`r${key++}`}>{text.slice(lastIndex)}</React.Fragment>);
  }

  return parts.length > 0 ? parts : [<React.Fragment key="empty">{text}</React.Fragment>];
}

// ============================================
// CSS FOR @MENTIONS
// ============================================

export const mentionStyles = `
  .gdf-mention {
    color: #0A4D5C;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }
  .gdf-mention:hover {
    opacity: 0.8;
    text-decoration: underline;
  }
`;
