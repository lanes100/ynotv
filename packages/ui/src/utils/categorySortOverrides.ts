const OVERRIDES_KEY = 'ynotv:customizedCategorySortOrders';

export function getCustomizedCategorySortOrders(): string[] {
  try {
    const saved = localStorage.getItem(OVERRIDES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function isCategorySortCustomized(sourceId: string): boolean {
  return getCustomizedCategorySortOrders().includes(sourceId);
}

export function setCategorySortCustomized(sourceId: string, customized: boolean) {
  const current = getCustomizedCategorySortOrders();
  let updated: string[];
  if (customized) {
    if (current.includes(sourceId)) return;
    updated = [...current, sourceId];
  } else {
    updated = current.filter(id => id !== sourceId);
  }
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('ynotv:category-sort-overrides-changed'));
}
