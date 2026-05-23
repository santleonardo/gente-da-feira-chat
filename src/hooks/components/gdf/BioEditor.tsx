"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Bold, Italic, AtSign } from "lucide-react";
import { UserAvatar } from "./UserAvatar";

// ═══════════════════════════════════════════════════════════
// BioEditor — Mini editor de texto para Bio com:
//   • Formatação: Negrito, Itálico
//   • @Mention autocomplete com dropdown para baixo
//   • Layout compacto para celular
// ═══════════════════════════════════════════════════════════

interface MentionUser {
  id: string;
  display_name: string;
  username: string;
  avatar: string | null;
  neighborhood?: string | null;
}

interface BioEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  searchUsers: (query: string) => Promise<MentionUser[]>;
}

export function BioEditor({
  value,
  onChange,
  maxLength = 300,
  placeholder = "Escreva algo sobre você...",
  searchUsers,
}: BioEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mention dropdown state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionStartNode, setMentionStartNode] = useState<number | null>(null);
  const [mentionStartOffset, setMentionStartOffset] = useState<number>(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Sync initial value to contentEditable ───
  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.textContent = value;
    }
  }, []);

  // ─── Get plain text from contentEditable ───
  const getPlainText = useCallback(() => {
    return editorRef.current?.textContent || "";
  }, []);

  // ─── Handle input ───
  const handleInput = useCallback(() => {
    const text = getPlainText();
    onChange(text.slice(0, maxLength));
    detectMention();
  }, [onChange, maxLength, getPlainText]);

  // ─── Detect @mention trigger in contentEditable ───
  const detectMention = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) {
      setShowMentionDropdown(false);
      return;
    }

    const text = node.textContent || "";
    const offset = range.startOffset;
    const textBeforeCursor = text.slice(0, offset);

    // Match @username at cursor position
    const atMatch = textBeforeCursor.match(/(?:^|\s)@(\w[\w.-]*)$/);

    if (atMatch) {
      const query = atMatch[1];
      const atOffset = offset - query.length - 1;

      setMentionStartNode(Array.from(editorRef.current!.childNodes).indexOf(node as ChildNode));
      setMentionStartOffset(atOffset);

      // Position dropdown below the input
      const rect = editorRef.current!.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom - (containerRect?.top || 0) + 4,
        left: 0,
      });

      setShowMentionDropdown(true);
      setMentionIndex(0);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (query.length >= 1) {
        setMentionLoading(true);
        debounceRef.current = setTimeout(async () => {
          try {
            const results = await searchUsers(query);
            setMentionUsers(results);
          } catch {
            setMentionUsers([]);
          }
          setMentionLoading(false);
        }, 200);
      } else {
        setMentionUsers([]);
      }
    } else {
      setShowMentionDropdown(false);
      setMentionUsers([]);
    }
  }, [searchUsers]);

  // ─── Insert mention into contentEditable ───
  const insertMention = useCallback(
    (user: MentionUser) => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !editorRef.current) return;

      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType !== Node.TEXT_NODE) return;

      const text = node.textContent || "";
      const offset = range.startOffset;
      const textBefore = text.slice(0, offset);
      const atMatch = textBefore.match(/(?:^|\s)@(\w[\w.-]*)$/);

      if (!atMatch) return;

      const atPos = offset - atMatch[0].length;
      const textAfter = text.slice(offset);
      const newText = text.slice(0, atPos) + `@${user.username} ` + textAfter;

      // Create a styled span for the mention
      const beforeNode = document.createTextNode(text.slice(0, atPos));
      const mentionSpan = document.createElement("span");
      mentionSpan.textContent = `@${user.username}`;
      mentionSpan.className = "text-[#0A4D5C] font-semibold";
      mentionSpan.setAttribute("data-mention", user.username);
      const afterNode = document.createTextNode(` ${textAfter}`);

      const parent = node.parentNode;
      if (parent) {
        parent.insertBefore(beforeNode, node);
        parent.insertBefore(mentionSpan, node);
        parent.insertBefore(afterNode, node);
        parent.removeChild(node);
      }

      // Move cursor after the mention
      const newRange = document.createRange();
      newRange.setStartAfter(mentionSpan);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);

      setShowMentionDropdown(false);
      setMentionUsers([]);

      // Update value
      const plainText = getPlainText();
      onChange(plainText.slice(0, maxLength));
    },
    [onChange, maxLength, getPlainText]
  );

  // ─── Formatting commands ───
  const handleBold = useCallback(() => {
    document.execCommand("bold");
    editorRef.current?.focus();
  }, []);

  const handleItalic = useCallback(() => {
    document.execCommand("italic");
    editorRef.current?.focus();
  }, []);

  // ─── Keyboard handling ───
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showMentionDropdown && mentionUsers.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionIndex((i) => (i < mentionUsers.length - 1 ? i + 1 : 0));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionIndex((i) => (i > 0 ? i - 1 : mentionUsers.length - 1));
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          insertMention(mentionUsers[mentionIndex]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowMentionDropdown(false);
          setMentionUsers([]);
          return;
        }
      }
    },
    [showMentionDropdown, mentionUsers, mentionIndex, insertMention]
  );

  // ─── Close dropdown on outside click ───
  useEffect(() => {
    if (!showMentionDropdown) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowMentionDropdown(false);
        setMentionUsers([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMentionDropdown]);

  // ─── Scroll selected mention into view ───
  useEffect(() => {
    if (!showMentionDropdown) return;
    const el = containerRef.current?.querySelector(`[data-bio-mention-index="${mentionIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [mentionIndex, showMentionDropdown]);

  const charCount = getPlainText().length;

  return (
    <div ref={containerRef} className="relative">
      {/* Mini toolbar */}
      <div className="flex items-center gap-0.5 mb-1.5 px-0.5">
        <button
          type="button"
          onClick={handleBold}
          className="flex items-center justify-center rounded-md h-6 w-6 bg-[#0A4D5C]/[0.06] text-[#0A4D5C] hover:bg-[#0A4D5C]/10 transition-colors"
          title="Negrito"
        >
          <Bold className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={handleItalic}
          className="flex items-center justify-center rounded-md h-6 w-6 bg-[#0A4D5C]/[0.06] text-[#0A4D5C] hover:bg-[#0A4D5C]/10 transition-colors"
          title="Itálico"
        >
          <Italic className="h-3 w-3" />
        </button>
        <div className="w-px h-3.5 bg-[#0A4D5C]/10" />
        <button
          type="button"
          onClick={() => {
            // Insert @ character at cursor
            editorRef.current?.focus();
            document.execCommand("insertText", false, "@");
            detectMention();
          }}
          className="flex items-center justify-center rounded-md h-6 w-6 bg-[#0A4D5C]/[0.06] text-[#0A4D5C] hover:bg-[#0A4D5C]/10 transition-colors"
          title="Mencionar usuário"
        >
          <AtSign className="h-3 w-3" />
        </button>

        <div className="flex-1" />

        <span className={`text-[10px] tabular-nums ${charCount > maxLength * 0.9 ? "text-red-500" : "text-[#0A4D5C]/40"}`}>
          {charCount}/{maxLength}
        </span>
      </div>

      {/* ContentEditable editor area */}
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className="w-full min-h-[72px] max-h-[120px] overflow-y-auto rounded-xl border border-[#0A4D5C]/10 bg-[#f7f9fa] px-3 py-2 text-sm text-[#000305] focus:outline-none focus:border-[#2EC4B6] transition-colors"
        style={{ wordBreak: "break-word" }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      {/* Placeholder overlay */}
      <style>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: rgba(10, 77, 92, 0.3);
          pointer-events: none;
        }
      `}</style>

      {/* @Mention dropdown — appears BELOW the editor */}
      {showMentionDropdown && (mentionUsers.length > 0 || mentionLoading) && (
        <div
          className="absolute z-50 min-w-[220px] max-w-[300px] rounded-2xl bg-white shadow-xl border border-[#0A4D5C]/10 overflow-hidden"
          style={{ top: dropdownPos.top, left: 0 }}
        >
          <div className="absolute -top-2 left-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-white drop-shadow-sm" />
          <div className="py-1.5 max-h-[200px] overflow-y-auto">
            {mentionLoading && mentionUsers.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-[#0A4D5C]/40 flex items-center gap-2">
                <span className="inline-block h-3 w-3 border-2 border-[#0A4D5C]/20 border-t-[#0A4D5C] rounded-full animate-spin" />
                Buscando...
              </div>
            ) : (
              mentionUsers.map((user, index) => (
                <button
                  key={user.id}
                  data-bio-mention-index={index}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    index === mentionIndex ? "bg-[#0A4D5C]/[0.06]" : "hover:bg-[#0A4D5C]/[0.03]"
                  }`}
                  onMouseEnter={() => setMentionIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(user);
                  }}
                >
                  <UserAvatar user={{ id: user.id, display_name: user.display_name, avatar_url: user.avatar }} className="h-7 w-7 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[#000305] truncate">{user.display_name}</div>
                    <div className="text-[10px] text-[#0A4D5C]/50 truncate">@{user.username}{user.neighborhood && ` · ${user.neighborhood}`}</div>
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
