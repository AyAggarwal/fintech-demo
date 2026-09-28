import { useEffect, useRef, useState } from 'react';

interface SearchInputProps {
  /** Committed value (e.g. from the URL). */
  value: string | undefined;
  onCommit: (value: string) => void;
  placeholder?: string;
  delayMs?: number;
  testId?: string;
}

/**
 * Text filter that keeps keystrokes in local state and commits them after a short pause,
 * so router navigation never lags behind typing and the list is not refetched per character.
 */
export function SearchInput({ value, onCommit, placeholder, delayMs = 250, testId }: SearchInputProps) {
  const committed = value ?? '';
  const [draft, setDraft] = useState(committed);
  const lastCommitted = useRef(committed);

  useEffect(() => {
    if (committed !== lastCommitted.current) {
      lastCommitted.current = committed;
      setDraft(committed);
    }
  }, [committed]);

  useEffect(() => {
    if (draft === lastCommitted.current) return;
    const timer = window.setTimeout(() => {
      lastCommitted.current = draft;
      onCommit(draft);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [draft, delayMs, onCommit]);

  return (
    <input
      type="search"
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      placeholder={placeholder}
      data-testid={testId}
    />
  );
}
