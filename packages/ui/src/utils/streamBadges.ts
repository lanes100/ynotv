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

export function convertArgbToRgba(color: string): string {
  if (!color || !color.startsWith('#')) return color;
  const hex = color.substring(1).trim();
  if (hex.length === 8) {
    const a = hex.substring(0, 2);
    const r = hex.substring(2, 4);
    const g = hex.substring(4, 6);
    const b = hex.substring(6, 8);
    return `#${r}${g}${b}${a}`;
  }
  if (hex.length === 4) {
    const a = hex.substring(0, 1);
    const r = hex.substring(1, 2);
    const g = hex.substring(2, 3);
    const b = hex.substring(3, 4);
    return `#${r}${g}${b}${a}`;
  }
  return color;
}

export function isLightColor(color: string): boolean {
  if (!color) return false;
  const hex = color.replace('#', '').trim();
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 180;
  }
  if (hex.length === 6 || hex.length === 8) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 180;
  }
  return false;
}

function compileCustomPayload(payload: ImportedBadgePayload): BadgeRule[] {
  return payload.filters
    .filter((f) => f.isEnabled && f.name.trim() && f.pattern.trim())
    .map((f) => ({
      pattern: toJsRegex(f.pattern),
      badge: {
        label: f.name,
        color: convertArgbToRgba(f.tagColor) || '#1A1A1A',
        textColor: convertArgbToRgba(f.textColor) || '#fff',
        imageUrl: f.imageURL || undefined,
        borderColor: convertArgbToRgba(f.borderColor) || 'transparent',
      },
    }));
}

export function compileBadgeSources(sources: BadgeSource[]): BadgeRule[] {
  const rules: BadgeRule[] = [];
  for (const source of sources) {
    if (source.isActive) {
      rules.push(...compileCustomPayload(source.payload));
    }
  }
  return rules;
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


export const DEFAULT_BADGE_SOURCES: BadgeSource[] = [
  {
  "url": "https://gist.githubusercontent.com/BringerOfRainX1/91203014c5d32c1ca7d5b51870a19786/raw/Badges%20json",
  "name": "Default",
  "isActive": true,
  "isDefault": true,
  "payload": {
    "groups": [
      {
        "borderColor": "#FFFFFF",
        "color": "#FFFFFF",
        "id": "gq",
        "isExpanded": true,
        "name": "Quality"
      },
      {
        "borderColor": "#FFFFFF",
        "color": "#FFFFFF",
        "id": "gv",
        "isExpanded": true,
        "name": "Visual"
      },
      {
        "borderColor": "#FFFFFF",
        "color": "#FFFFFF",
        "id": "gr",
        "isExpanded": true,
        "name": "Resolution"
      },
      {
        "borderColor": "#FFFFFF",
        "color": "#FFFFFF",
        "id": "ga",
        "isExpanded": true,
        "name": "Audio"
      },
      {
        "borderColor": "#FFFFFF",
        "color": "#FFFFFF",
        "id": "gc",
        "isExpanded": true,
        "name": "Channels"
      }
    ],
    "filters": [
      {
        "borderColor": "#FFFFFF",
        "groupId": "gr",
        "id": "r-4k",
        "imageURL": "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/4k.png",
        "isEnabled": true,
        "name": "4K",
        "pattern": "(?i)^(?=.*(?:2160[pi]?|4k|uhd))(?!.*(?:1080[pi]?|720[pi]?))",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "gr",
        "id": "r-1080",
        "imageURL": "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/1080p.png",
        "isEnabled": true,
        "name": "1080p",
        "pattern": "(?i)\\b1080[pi]?\\b",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "gr",
        "id": "r-720",
        "imageURL": "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/720p.png",
        "isEnabled": true,
        "name": "720p",
        "pattern": "(?i)\\b720[pi]?\\b",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "gq",
        "id": "q-r",
        "imageURL": "https://raw.githubusercontent.com/ngreyx1/badges/refs/heads/main/images%20w:o%20logo/remux-black.png",
        "isEnabled": true,
        "name": "Remux",
        "pattern": "(?i)\\bremux\\b",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "gq",
        "id": "q-b",
        "imageURL": "https://raw.githubusercontent.com/ngreyx1/badges/refs/heads/main/images%20w:o%20logo/bluray-black.png",
        "isEnabled": true,
        "name": "BluRay",
        "pattern": "(?i)^(?=.*(?:bluray|blu-ray))(?!.*remux)",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "gq",
        "id": "q-w",
        "imageURL": "https://raw.githubusercontent.com/ngreyx1/badges/refs/heads/main/images%20w:o%20logo/webdl-black.png",
        "isEnabled": true,
        "name": "WEB-DL",
        "pattern": "(?i)\\bweb[-_. ]?dl\\b",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "gq",
        "id": "q-wr",
        "imageURL": "https://raw.githubusercontent.com/ngreyx1/badges/refs/heads/main/images%20w:o%20logo/webrip-black.png",
        "isEnabled": true,
        "name": "WEBRip",
        "pattern": "(?i)\\bweb[-_. ]?rip\\b",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "gq",
        "id": "v-seadex",
        "imageURL": "https://raw.githubusercontent.com/ngreyx1/badges/refs/heads/main/images%20w:o%20logo/SEADEX-black.png",
        "isEnabled": true,
        "name": "SeaDex",
        "pattern": "(?i)\\b(?:seadex|best[\\s._-]?release|alt[\\s._-]?(?:best[\\s._-]?)?release)\\b|ᴀʟᴛ ʀᴇʟᴇᴀsᴇ|ʙᴇsᴛ ʀᴇʟᴇᴀsᴇ",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "gv",
        "id": "v-imax",
        "imageURL": "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/IMAXv2.PNG",
        "isEnabled": true,
        "name": "IMAX",
        "pattern": "(?i)^(?=.*\\bIMAX\\b)(?!.*enhanced)",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "gv",
        "id": "a-dv",
        "imageURL": "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/DV.png",
        "isEnabled": true,
        "name": "DV",
        "pattern": "(?i)\\b(?:dv|dovi|dolby[\\s._-]?vision)\\b",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "gv",
        "id": "v-hdr10p",
        "imageURL": "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/HDR10Plus.png",
        "isEnabled": true,
        "name": "HDR10+",
        "pattern": "(?i)^(?!.*\\b(?:dv|dovi|dolby[\\s._-]?vision)\\b)(?=.*hdr[\\s._-]?10[\\s._-]?(?:\\\\+|plus|p))",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "gv",
        "id": "v-hdr10",
        "imageURL": "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/HDR10.png",
        "isEnabled": true,
        "name": "HDR10",
        "pattern": "(?i)^(?!.*\\b(?:dv|dovi|dolby[\\s._-]?vision)\\b)(?=.*hdr[\\s._-]?10)(?!.*hdr[\\s._-]?10[\\s._-]?(?:\\\\+|plus|p))",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "gv",
        "id": "v-hdr",
        "imageURL": "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/HDR.png",
        "isEnabled": true,
        "name": "HDR",
        "pattern": "(?i)^(?!.*\\b(?:dv|dovi|dolby[\\s._-]?vision)\\b)(?=.*\\bHDR\\b)(?!.*hdr[\\s._-]?10)",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "ga",
        "id": "a-th",
        "imageURL": "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/TrueHD.png",
        "isEnabled": true,
        "name": "TrueHD",
        "pattern": "(?i)(?:\\btrue[ ._-]?hd\\b|^(?=.*\\batmos\\b)(?=.*\\bremux\\b)(?!.*\\b(?:true[ ._-]?hd|ddp|dd\\+|e-?ac3|eac3)\\b).+$)",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "ga",
        "id": "a-at",
        "imageURL": "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/Atmos.png",
        "isEnabled": true,
        "name": "Atmos",
        "pattern": "(?i)^(?!.*\\btrue[ _\\.\\-]?hd\\b).*\\batmos\\b.*$",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "ga",
        "id": "a-dtsx",
        "imageURL": "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/dtsx.png",
        "isEnabled": true,
        "name": "DTS:X",
        "pattern": "(?i)\\bdts[-_.: ]?x\\b",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "ga",
        "id": "a-dtsma",
        "imageURL": "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/dtsHDMA.png",
        "isEnabled": true,
        "name": "DTS-HD MA",
        "pattern": "(?i)^(?=.*\\bdts[-_. ]?(?:hd[-_. ]?)?ma\\b)(?!.*\\bdts[-_.: ]?x\\b)",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "ga",
        "id": "a-dtshd",
        "imageURL": "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/dtsHD.png",
        "isEnabled": true,
        "name": "DTS-HD",
        "pattern": "(?i)^(?=.*\\bdts[-_. ]?hd\\b)(?!.*\\bdts[-_. ]?(?:hd[-_. ]?)?ma\\b)(?!.*\\bdts[-_.: ]?x\\b)",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "ga",
        "id": "a-dts",
        "imageURL": "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/dts.png",
        "isEnabled": true,
        "name": "DTS",
        "pattern": "(?i)^(?=.*\\bDTS\\b)(?!.*\\bdts[-_. ]?(?:hd|ma|xll|x)\\b)",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "ga",
        "id": "a-dp",
        "imageURL": "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/DDPLUS.png",
        "isEnabled": true,
        "name": "DD+",
        "pattern": "(?i)^(?=.*(?:\\bddp|\\bdd\\+|\\beac-?3|\\be-?ac-?3))(?!.*\\batmos\\b)(?!.*\\btrue[\\s._-]?hd\\b)(?!.*\\b(?:dv|dovi|dolby[\\s._-]?vision)\\b)",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "ga",
        "id": "a-dd",
        "imageURL": "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/DD.png",
        "isEnabled": true,
        "name": "DD",
        "pattern": "(?i)^(?=.*\\b(?:dd[25][. ][01]|dd[^p+a-z]\\b|\\bac-?3)\\b)(?!.*(?:\\bddp|\\bdd\\+|\\beac-?3|\\be-?ac-?3))(?!.*\\btrue[\\s._-]?hd\\b)(?!.*\\batmos\\b)(?!.*\\b(?:dv|dovi|dolby[\\s._-]?vision)\\b)",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "gc",
        "id": "ch-71",
        "imageURL": "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/71.png",
        "isEnabled": true,
        "name": "7.1",
        "pattern": "[^0-9][7-8][. ][01](?![0-9])",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "gc",
        "id": "ch-61",
        "imageURL": "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/61.png",
        "isEnabled": true,
        "name": "6.1",
        "pattern": "(?i)(?=.*[^0-9]6[ .][0-1]\\b)(?!.*[^0-9][7-8][ .][0-1]\\b)(?!.*[^0-9]5[ .][0-1]\\b)(?!.*(?<!repac)[^0-9][1-4][ .][0-1]\\b|\\\\b(Stereo|Mono)\\\\b)",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      },
      {
        "borderColor": "#FFFFFF",
        "groupId": "gc",
        "id": "ch-51",
        "imageURL": "https://raw.githubusercontent.com/nobnobz/Omni-Template-Bot-Bid-Raiser/main/Other/regex%20tags/51.png",
        "isEnabled": true,
        "name": "5.1",
        "pattern": "^(?=.*[^0-9]5[. ][01](?![0-9]))(?!.*[^0-9][7-8][. ][01](?![0-9]))",
        "tagColor": "#FFFFFF",
        "tagStyle": "filled",
        "textColor": "#000000",
        "type": "filter"
      }
    ]
  }
}
];

export function mergeDefaultBadgeSources(loadedSources: BadgeSource[] | undefined): BadgeSource[] {
  const defaults = DEFAULT_BADGE_SOURCES;
  if (!loadedSources || loadedSources.length === 0) {
    return defaults;
  }
  const hasDefault = loadedSources.some(s => s.isDefault || s.url === defaults[0].url);
  if (!hasDefault) {
    return [defaults[0], ...loadedSources];
  }
  return loadedSources.map(s => {
    if (s.url === defaults[0].url || s.isDefault) {
      return {
        ...s,
        name: 'Default',
        isDefault: true,
        payload: defaults[0].payload
      };
    }
    return s;
  });
}

export function formatVideoSize(bytes?: number): string | null {
  if (!bytes) return null;
  const gib = bytes / (1024 * 1024 * 1024);
  if (gib >= 1) {
    const roundedGiB = Math.round(gib * 10) / 10;
    return `${roundedGiB} GB`;
  } else {
    const mib = bytes / (1024 * 1024);
    return `${Math.round(mib)} MB`;
  }
}

