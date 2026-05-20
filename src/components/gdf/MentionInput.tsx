"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { UserAvatar } from "./UserAvatar";

// ═══════════════════════════════════════════════════════════
// MentionInput — textarea/input com autocomplete de @menções
// O dropdown aparece ABAIXO do cursor (apontando para baixo)
// ═══════════════════════════════════════════════════════════

interface MentionUser {
  id: string;
  display_name: string;
  username: string;
  avatar: string | null;
  neighborhood?: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
  rows?: number;
  multiline?: boolean;
  /** Function to search users — should call /api/users/search */
  searchUsers: (query: string) => Promise<MentionUser[]>;
  /** Called when Enter is pressed (without shift) — for single-line or submit */
  onSubmit?: () => void;
  /** Ref to the underlying textarea/input */
  inputRef?: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function MentionInput({
  value,
  onChange,
  placeholder = "",
  className = "",
  maxLength = 500,
  rows = 2,
  multiline = true,
  searchUsers,
  onSubmit,
  inputRef: externalRef,
  onKeyDown,
}: MentionInputProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const inputInternalRef = useRef<HTMLInputElement>(null);
  const textareaEl = internalRef;
  const inputEl = inputInternalRef;
  const containerRef = useRef<HTMLDivElement>(null);

  const [showDropdown, setShowDropdown] = useState(false);
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1); // cursor position where @ was typed
  const [loading, setLoading] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Calculate dropdown position ───
  const updateDropdownPosition = useCallback(() => {
    const el = multiline ? textareaEl.current : inputEl.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();

    // Position dropdown BELOW the input
    setDropdownPos({
      top: rect.bottom - (containerRect?.top || 0) + 4,
      left: rect.left - (containerRect?.left || 0),
    });
  }, [multiline]);

  // ─── Detect @mention trigger ───
  const handleTextChange = useCallback(
    (newValue: string) => {
      onChange(newValue.slice(0, maxLength));

      const el = multiline ? textareaEl.current : inputEl.current;
      if (!el) return;

      const cursorPos = el.selectionStart ?? 0;
      const textBeforeCursor = newValue.slice(0, cursorPos);

      // Find the last @ that isn't preceded by a non-space character
      const atMatch = textBeforeCursor.match(/(?:^|\s)@(\w[\w.-]*)$/);

      if (atMatch) {
        const query = atMatch[1];
        const atPos = cursorPos - query.length - 1; // position of @
        setMentionStart(atPos);
        setMentionQuery(query);
        setShowDropdown(true);
        setSelectedIndex(0);
        updateDropdownPosition();

        // Debounced search
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (query.length >= 1) {
          setLoading(true);
          debounceRef.current = setTimeout(async () => {
            try {
              const results = await searchUsers(query);
              setUsers(results);
            } catch {
              setUsers([]);
            }
            setLoading(false);
          }, 200);
        } else {
          setUsers([]);
        }
      } else {
        setShowDropdown(false);
        setUsers([]);
        setMentionStart(-1);
      }
    },
    [onChange, maxLength, searchUsers, multiline, updateDropdownPosition]
  );

  // ─── Insert mention ───
  const insertMention = useCallback(
    (user: MentionUser) => {
      if (mentionStart < 0) return;

      const before = value.slice(0, mentionStart);
      const after = value.slice(
        (multiline ? textareaEl.current?.selectionStart : inputEl.current?.selectionStart) || value.length
      );

      const newValue = `${before}@${user.username} ${after}`;
      onChange(newValue.slice(0, maxLength));

      setShowDropdown(false);
      setUsers([]);
      setMentionStart(-1);

      // Focus and set cursor position after the inserted mention
      requestAnimationFrame(() => {
        const el = multiline ? textareaEl.current : inputEl.current;
        if (el) {
          el.focus();
          const newCursorPos = before.length + user.username.length + 2; // @username + space
          el.setSelectionRange(newCursorPos, newCursorPos);
        }
      });
    },
    [value, onChange, maxLength, mentionStart, multiline]
  );

  // ─── Keyboard navigation ───
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showDropdown && users.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((i) => (i < users.length - 1 ? i + 1 : 0));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((i) => (i > 0 ? i - 1 : users.length - 1));
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          insertMention(users[selectedIndex]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowDropdown(false);
          setUsers([]);
          return;
        }
      }

      // Pass Enter for submit (when no dropdown is open, or for single line)
      if (e.key === "Enter" && !e.shiftKey && !showDropdown) {
        if (!multiline || onSubmit) {
          e.preventDefault();
          onSubmit?.();
          return;
        }
      }

      onKeyDown?.(e);
    },
    [showDropdown, users, selectedIndex, insertMention, multiline, onSubmit, onKeyDown]
  );

  // ─── Close dropdown on outside click ───
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setUsers([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  // ─── Scroll selected item into view ───
  useEffect(() => {
    if (!showDropdown) return;
    const dropdown = containerRef.current?.querySelector(`[data-mention-index="${selectedIndex}"]`);
    dropdown?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, showDropdown]);

  // ─── Combine refs ───
  const setTextareaRef = useCallback(
    (el: HTMLTextAreaElement | null) => {
      (internalRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
      if (externalRef && typeof externalRef === "object") {
        (externalRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
      }
    },
    [externalRef]
  );

  const setInputRef = useCallback(
    (el: HTMLInputElement | null) => {
      (inputInternalRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
      if (externalRef && typeof externalRef === "object") {
        (externalRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
      }
    },
    [externalRef]
  );

  return (
    <div ref={containerRef} className="relative">
      {/* Input element */}
      {multiline ? (
        <textarea
          ref={setTextareaRef}
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className={className}
          rows={rows}
        />
      ) : (
        <input
          ref={setInputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className={className}
        />
      )}

      {/* Dropdown — appears BELOW the input (apontando para baixo) */}
      {showDropdown && (users.length > 0 || loading) && (
        <div
          className="absolute z-50 min-w-[220px] max-w-[300px] rounded-2xl bg-white shadow-xl border border-[#0A4D5C]/10 overflow-hidden"
          style={{
            top: dropdownPos.top,
            left: 0,
          }}
        >
          {/* Small arrow pointing up (indicating it comes from the input above) */}
          <div className="absolute -top-2 left-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-white drop-shadow-sm" />

          <div className="py-1.5 max-h-[200px] overflow-y-auto">
            {loading && users.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-[#0A4D5C]/40 flex items-center gap-2">
                <span className="inline-block h-3 w-3 border-2 border-[#0A4D5C]/20 border-t-[#0A4D5C] rounded-full animate-spin" />
                Buscando...
              </div>
            ) : (
              users.map((user, index) => (
                <button
                  key={user.id}
                  data-mention-index={index}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    index === selectedIndex
                      ? "bg-[#0A4D5C]/[0.06]"
                      : "hover:bg-[#0A4D5C]/[0.03]"
                  }`}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(user);
                  }}
                >
                  <UserAvatar
                    user={{
                      id: user.id,
                      display_name: user.display_name,
                      avatar_url: user.avatar,
                    }}
                    className="h-7 w-7 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[#000305] truncate">
                      {user.display_name}
                    </div>
                    <div className="text-[10px] text-[#0A4D5C]/50 truncate">
                      @{user.username}
                      {user.neighborhood && ` · ${user.neighborhood}`}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
