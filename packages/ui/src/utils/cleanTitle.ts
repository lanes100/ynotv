/**
 * Clean a media title for API searching.
 * Strips common suffixes like year, quality tags, release group names,
 * and other non-title cruft that IPTV sources often append.
 */
export function cleanTitleForSearch(title: string | undefined | null): string {
  if (!title) return '';

  let cleaned = title.trim();

  // Strip leading language-code prefixes
  // Examples: "EN - Title", "AR/BG - Title", "EXYU - Title",
  //           "EN/FR/DE - Title", "AR/BG/BR/CN/DE/ES/EXYU/FR - Title"
  cleaned = cleaned.replace(/^([A-Z]{2,4}\/)*[A-Z]{2,4}\s*[-–—]\s*/i, '');

  // Strip trailing year patterns:
  // "Movie Name - 2023", "Movie Name (2023)", "Movie Name [2023]",
  // "Movie Name 2023", "Movie Name – 2023", "Movie Name — 2023"
  cleaned = cleaned.replace(/\s*[-–—]\s*\(?\[?\d{4}\]?\)?\s*$/i, '');
  cleaned = cleaned.replace(/\s*[\(\[]\d{4}[\)\]]\s*$/i, '');
  cleaned = cleaned.replace(/\s+\d{4}\s*$/i, '');

  // Strip common quality / format suffixes
  // Examples: " - 1080p", " - WEB-DL", " - BluRay", " - HDRip", " - HEVC", " - x264"
  cleaned = cleaned.replace(/\s*[-–—]\s*(\d{3,4}[pk]\b|WEB[\s-]?DL|BluRay|BRRip|HDRip|DVDRip|HDTV|HEVC|x264|x265|AAC|AC3|MP3|DTS|Atmos)\s*$/i, '');

  // Strip release group names in brackets at the end
  // Examples: " [YTS]", " [RARBG]", " [TGx]"
  cleaned = cleaned.replace(/\s*\[[A-Za-z0-9\s._-]+\]\s*$/i, '');

  // Strip any parenthetical content anywhere in the title
  // Examples: " (multi-sub)", "(xxx)", " (VOD)"
  cleaned = cleaned.replace(/\s*\([^)]+\)/g, '');

  // Strip standalone "4K" or "4k" anywhere in the title
  cleaned = cleaned.replace(/\b4[Kk]\b/g, '');

  // Strip extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}
