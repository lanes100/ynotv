import type { StremioStream, StremioStreamBadge, BadgeSource, ImportedBadgePayload, ImportedBadgeFilter } from '../types/stremio';

interface BadgeRule {
  pattern: RegExp;
  badge: StremioStreamBadge;
}

const builtInRules: BadgeRule[] = [
  // Quality
  { pattern: /\b8K\b/i, badge: { label: '8K', color: '#8b5cf6' } },
  { pattern: /\b4K\b/i, badge: { label: '4K', color: '#ef4444' } },
  { pattern: /\b2160[pP]\b/, badge: { label: '4K', color: '#ef4444' } },
  { pattern: /\b1080[pP]\b/, badge: { label: '1080p', color: '#f59e0b' } },
  { pattern: /\b720[pP]\b/, badge: { label: '720p', color: '#3b82f6' } },
  { pattern: /\b480[pP]\b/, badge: { label: '480p', color: '#6b7280' } },
  { pattern: /\b360[pP]\b/, badge: { label: '360p', color: '#6b7280' } },
  // Codec
  { pattern: /\bx26[45]\b/i, badge: { label: 'x264', color: '#10b981' } },
  { pattern: /\bx265\b/i, badge: { label: 'x265', color: '#10b981' } },
  { pattern: /\bhevc\b/i, badge: { label: 'HEVC', color: '#10b981' } },
  { pattern: /\bav1\b/i, badge: { label: 'AV1', color: '#10b981' } },
  { pattern: /\bvp9\b/i, badge: { label: 'VP9', color: '#10b981' } },
  { pattern: /\bdivx\b/i, badge: { label: 'DivX', color: '#10b981' } },
  // HDR
  { pattern: /\bdolby[\s-]?vision\b/i, badge: { label: 'DV', color: '#a855f7' } },
  { pattern: /\bhdr10?\+?\b/i, badge: { label: 'HDR', color: '#a855f7' } },
  { pattern: /\bhlg\b/i, badge: { label: 'HLG', color: '#a855f7' } },
  // Audio
  { pattern: /\bdolby[\s-]?atmos\b/i, badge: { label: 'Atmos', color: '#ec4899' } },
  { pattern: /\bdts[\s-]?hd\b/i, badge: { label: 'DTS-HD', color: '#ec4899' } },
  { pattern: /\bdts\b/i, badge: { label: 'DTS', color: '#ec4899' } },
  { pattern: /\b5\.1\b/, badge: { label: '5.1', color: '#ec4899' } },
  { pattern: /\b7\.1\b/, badge: { label: '7.1', color: '#ec4899' } },
  { pattern: /\baac\b/i, badge: { label: 'AAC', color: '#ec4899' } },
  { pattern: /\bflac\b/i, badge: { label: 'FLAC', color: '#ec4899' } },
  // CAM
  { pattern: /\b(?:CAM|TS|HDTS|HDCAM|TELESYNC)\b/i, badge: { label: 'CAM', color: '#dc2626' } },
];

function toJsRegex(pattern: string): RegExp {
  // JS doesn't support inline (?i), (?s), (?m) flags — strip them and pass as 2nd arg
  let flags = '';
  const clean = pattern.replace(/\(\?([imsxUJ]+(?:-[imsxUJ]*)?)\)/g, (_, part) => {
    const [pos] = part.split('-');
    for (const ch of pos) {
      if ('ims'.includes(ch) && !flags.includes(ch)) flags += ch;
    }
    return '';
  });
  return new RegExp(clean, flags);
}

function compileCustomPayload(payload: ImportedBadgePayload): BadgeRule[] {
  return payload.filters
    .filter((f) => f.isEnabled && f.name.trim() && f.pattern.trim())
    .map((f) => ({
      pattern: toJsRegex(f.pattern),
      badge: {
        label: f.name,
        color: f.tagColor || '#1A1A1A',
        textColor: f.textColor || '#fff',
        imageUrl: f.imageURL || undefined,
        borderColor: f.borderColor || undefined,
      },
    }));
}

export function compileBadgeSources(sources: BadgeSource[]): BadgeRule[] {
  const active = sources.find((s) => s.isActive);
  if (active) {
    return compileCustomPayload(active.payload);
  }
  return [];
}

export function extractStreamBadges(
  stream: StremioStream,
  customRules?: BadgeRule[],
): StremioStreamBadge[] {
  const text = [stream.name, stream.title, stream.description].filter(Boolean).join(' ');
  if (!text.trim()) return [];

  const rules = customRules && customRules.length > 0 ? customRules : builtInRules;
  const seen = new Set<string>();
  const result: StremioStreamBadge[] = [];

  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      const key = rule.badge.imageUrl || rule.badge.label;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(rule.badge);
      }
    }
  }

  return result;
}

export function parseBadgePayload(json: string): ImportedBadgePayload {
  let parsed: any;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON');
  }

  if (!parsed.filters || !Array.isArray(parsed.filters)) {
    throw new Error('Missing "filters" array');
  }

  const filters = parsed.filters.map((f: any, i: number) => ({
    id: String(f.id ?? `f${i}`),
    groupId: String(f.groupId ?? ''),
    name: String(f.name ?? ''),
    pattern: String(f.pattern ?? ''),
    imageURL: String(f.imageURL ?? ''),
    isEnabled: f.isEnabled !== false,
    tagColor: String(f.tagColor ?? ''),
    tagStyle: String(f.tagStyle ?? ''),
    textColor: String(f.textColor ?? ''),
    borderColor: String(f.borderColor ?? ''),
  }));

  const validFilters = filters.filter((f: ImportedBadgeFilter) => f.name.trim() && f.pattern.trim());
  if (validFilters.length === 0) {
    throw new Error('No usable filters found (each needs a name and pattern)');
  }

  const groups = Array.isArray(parsed.groups)
    ? parsed.groups.map((g: any, i: number) => ({
        id: String(g.id ?? `g${i}`),
        name: String(g.name ?? ''),
        color: String(g.color ?? ''),
        isExpanded: g.isExpanded !== false,
      }))
    : [];

  return { filters, groups };
}
