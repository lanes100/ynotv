const HIDDEN_EVENTS_KEY = 'ynotv_hidden_sports_events';

/** Get list of hidden event IDs */
export function getHiddenEventIds(): string[] {
  try {
    const stored = localStorage.getItem(HIDDEN_EVENTS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load hidden sports events:', e);
  }
  return [];
}

/** Hide a specific event by ID */
export function hideEvent(eventId: string): void {
  const hidden = getHiddenEventIds();
  if (!hidden.includes(eventId)) {
    hidden.push(eventId);
    localStorage.setItem(HIDDEN_EVENTS_KEY, JSON.stringify(hidden));
  }
}

/** Unhide a specific event by ID */
export function unhideEvent(eventId: string): void {
  const hidden = getHiddenEventIds().filter(id => id !== eventId);
  localStorage.setItem(HIDDEN_EVENTS_KEY, JSON.stringify(hidden));
}

/** Clear all hidden events */
export function clearHiddenEvents(): void {
  localStorage.removeItem(HIDDEN_EVENTS_KEY);
}

/** Check if an event is hidden */
export function isEventHidden(eventId: string): boolean {
  return getHiddenEventIds().includes(eventId);
}
