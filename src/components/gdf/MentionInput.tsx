'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface MentionUser {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
  onSend?: () => void;
  minRows?: number;
  maxRows?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  searchUsers?: (query: string) => Promise<MentionUser[]>;
}

const MentionInput: React.FC<MentionInputProps> = ({
  value, onChange, placeholder = '', multiline = true, className = '',
  inputRef: externalRef, onSend, minRows = 1, maxRows = 4,
  disabled = false, autoFocus = false, searchUsers,
}) => {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const internalRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = (externalRef || internalRef) as React.RefObject<HTMLInputElement | HTMLTextAreaElement>;

  const searchMentionUsers = useCallback(async (query: string) => {
    if (!searchUsers || query.length === 0) { setSuggestions([]); return; }
    setIsLoading(true);
    try {
      const results = await searchUsers(query);
      setSuggestions(results.slice(0, 8));
      setSelectedIndex(0);
    } catch { setSuggestions([]); }
    finally { setIsLoading(false); }
  }, [searchUsers]);

  const detectMention = useCallback((text: string, cursorPos: number) => {
    const textBeforeCursor = text.substring(0, cursorPos);
    const match = textBeforeCursor.match(/@(\w*)$/);
    if (match) {
      const query = match[1];
      const startIndex = cursorPos - query.length - 1;
      const charBeforeAt = startIndex > 0 ? text[startIndex - 1] : '';
      if (charBeforeAt === '' || charBeforeAt === ' ' || charBeforeAt === '\n') {
        setMentionQuery(query);
        setMentionStartIndex(startIndex);
        return;
      }
    }
    setMentionQuery(null);
    setMentionStartIndex(-1);
    setSuggestions([]);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || newValue.length;
    onChange(newValue);
    detectMention(newValue, cursorPos);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const mentionMatch = newValue.substring(0, cursorPos).match(/@(\w*)$/);
    if (mentionMatch && searchUsers) {
      debounceRef.current = setTimeout(() => searchMentionUsers(mentionMatch[1]), 250);
    }
  };

  const insertMention = useCallback((user: MentionUser) => {
    if (mentionStartIndex === -1) return;
    const before = value.substring(0, mentionStartIndex);
    const after = value.substring(mentionStartIndex + (mentionQuery ? mentionQuery.length + 1 : 0));
    onChange(`${before}@${user.username} ${after}`);
    setMentionQuery(null);
    setMentionStartIndex(-1);
    setSuggestions([]);
    requestAnimationFrame(() => {
      const pos = before.length + user.username.length + 2;
      if (inputRef.current) { inputRef.current.focus(); inputRef.current.setSelectionRange(pos, pos); }
    });
  }, [value, mentionStartIndex, mentionQuery, onChange, inputRef]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length > 0 && mentionQuery !== null) {
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); setSelectedIndex(p => (p + 1) % suggestions.length); return;
        case 'ArrowUp': e.preventDefault(); setSelectedIndex(p => (p - 1 + suggestions.length) % suggestions.length); return;
        case 'Enter': case 'Tab': e.preventDefault(); insertMention(suggestions[selectedIndex]); return;
        case 'Escape': e.preventDefault(); setMentionQuery(null); setMentionStartIndex(-1); setSuggestions([]); return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && onSend && !multiline) { e.preventDefault(); onSend(); }
  };

  useEffect(() => {
    if (dropdownRef.current && suggestions.length > 0) {
      const el = dropdownRef.current.children[selectedIndex] as HTMLElement;
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, suggestions.length]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setMentionQuery(null); setMentionStartIndex(-1); setSuggestions([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [inputRef]);

  useEffect(() => { return () => { if (debounceRef.current) clearTimeout(debounceRef.current); }; }, []);

  const sharedProps = { value, onChange: handleChange, onKeyDown: handleKeyDown, placeholder, className: `mention-input ${className}`, disabled, autoFocus };

  return (
    <div className="mention-input-wrapper" style={{ position: 'relative' }}>
      {multiline ? (
        <textarea ref={inputRef as React.RefObject<HTMLTextAreaElement>} {...sharedProps} rows={minRows} style={{ resize: 'none', overflow: 'auto', maxHeight: maxRows ? `${maxRows * 24}px` : undefined }} />
      ) : (
        <input ref={inputRef as React.RefObject<HTMLInputElement>} {...sharedProps} type="text" />
      )}
      {mentionQuery !== null && suggestions.length > 0 && (
        <div ref={dropdownRef} style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 9999, backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', maxHeight: '240px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {suggestions.map((user, index) => (
            <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', backgroundColor: index === selectedIndex ? '#F0FDFA' : 'transparent', transition: 'background-color 0.1s ease' }}
              onMouseDown={(e) => { e.preventDefault(); insertMention(user); }}
              onMouseEnter={() => setSelectedIndex(index)}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, backgroundColor: '#0A4D5C' }}>
                {user.avatarUrl ? <img src={user.avatarUrl} alt={user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> :
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: '#FFF' }}>
                    {(user.displayName || user.username).charAt(0).toUpperCase()}
                  </div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#0A4D5C' }}>@{user.username}</div>
                {user.displayName && <div style={{ fontSize: '11px', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.displayName}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {mentionQuery !== null && isLoading && (
        <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 9998, backgroundColor: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#6B7280' }}>Buscando usuários...</div>
      )}
      <style jsx>{`
        .mention-input-wrapper .mention-input { width: 100%; }
        .mention-item:hover { background-color: #F0FDFA !important; }
      `}</style>
    </div>
  );
};

export default MentionInput;
export type { MentionInputProps, MentionUser };
