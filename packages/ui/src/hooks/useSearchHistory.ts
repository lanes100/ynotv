import { useState, useCallback } from 'react';

const STORAGE_KEY_PREFIX = 'search-history-';
const MAX_ITEMS = 10;

function loadHistory(key: string): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function saveHistory(key: string, items: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(items));
  } catch {}
}

export function useSearchHistory(storageKey: string) {
  const [history, setHistory] = useState<string[]>(() => loadHistory(storageKey));

  const addToHistory = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setHistory(prev => {
      const filtered = prev.filter(item => item !== trimmed);
      const updated = [trimmed, ...filtered].slice(0, MAX_ITEMS);
      saveHistory(storageKey, updated);
      return updated;
    });
  }, [storageKey]);

  const removeFromHistory = useCallback((query: string) => {
    setHistory(prev => {
      const updated = prev.filter(item => item !== query);
      saveHistory(storageKey, updated);
      return updated;
    });
  }, [storageKey]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory(storageKey, []);
  }, [storageKey]);

  return { history, addToHistory, removeFromHistory, clearHistory };
}
