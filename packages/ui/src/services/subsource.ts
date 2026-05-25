/**
 * SubSource API v1 client for fetching subtitles.
 * @see https://subsource.net/api-docs
 *
 * Auth: X-API-Key header
 * Base: https://api.subsource.net/api/v1
 *
 * Flow:
 *   1. Search movies: GET /movies/search?searchType=text&q={query}
 *   2. List subtitles: GET /subtitles?movieId={id}&language={lang}
 *   3. Download: GET /subtitles/{id}/download (returns ZIP)
 */

const API_BASE = 'https://api.subsource.net/api/v1';

/* ─── debug logging ─── */
function log(stage: string, ...args: any[]) {
  console.log(`[SubSource][${stage}]`, ...args);
}

/* ─── language helpers ─── */
export const LANG_MAP: Record<string, string> = {
  // 2-letter ISO-639-1
  en: 'english', es: 'spanish', fr: 'french', de: 'german', it: 'italian',
  pt: 'portuguese', ru: 'russian', ar: 'arabic', hi: 'hindi', zh: 'chinese',
  ja: 'japanese', ko: 'korean', nl: 'dutch', pl: 'polish', tr: 'turkish',
  sv: 'swedish', da: 'danish', no: 'norwegian', fi: 'finnish', cs: 'czech',
  el: 'greek', he: 'hebrew', id: 'indonesian', ms: 'malay', th: 'thai',
  vi: 'vietnamese', ro: 'romanian', hu: 'hungarian', bg: 'bulgarian',
  uk: 'ukrainian', sr: 'serbian', hr: 'croatian', sk: 'slovak', sl: 'slovenian',
  lt: 'lithuanian', lv: 'latvian', et: 'estonian', ca: 'catalan', tl: 'tagalog',
  fa: 'persian', ur: 'urdu', bn: 'bengali', ta: 'tamil', te: 'telugu',
  mr: 'marathi', pa: 'punjabi', gu: 'gujarati', kn: 'kannada', ml: 'malayalam',
  si: 'sinhala', ne: 'nepali', my: 'burmese', km: 'khmer', lo: 'lao',
  am: 'amharic', sw: 'swahili', zu: 'zulu', af: 'afrikaans', sq: 'albanian',
  hy: 'armenian', ka: 'georgian', az: 'azerbaijani', uz: 'uzbek', kk: 'kazakh',
  ky: 'kyrgyz', mn: 'mongolian', la: 'latin', cy: 'welsh',
  ga: 'irish', eu: 'basque', gl: 'galician', is: 'icelandic', mt: 'maltese',
  // 3-letter ISO-639-2 (MPV sometimes uses these)
  eng: 'english', spa: 'spanish', fra: 'french', fre: 'french', deu: 'german', ger: 'german',
  ita: 'italian', por: 'portuguese', rus: 'russian', ara: 'arabic', hin: 'hindi',
  zho: 'chinese', chi: 'chinese', jpn: 'japanese', kor: 'korean', nld: 'dutch', dut: 'dutch',
  pol: 'polish', tur: 'turkish', swe: 'swedish', dan: 'danish', nor: 'norwegian',
  fin: 'finnish', ces: 'czech', cze: 'czech', ell: 'greek', gre: 'greek', heb: 'hebrew',
  ind: 'indonesian', msa: 'malay', may: 'malay', tha: 'thai', vie: 'vietnamese',
  ron: 'romanian', rum: 'romanian', hun: 'hungarian', bul: 'bulgarian', ukr: 'ukrainian',
  srp: 'serbian', hrv: 'croatian', slk: 'slovak', slo: 'slovak', slv: 'slovenian',
  lit: 'lithuanian', lav: 'latvian', est: 'estonian', cat: 'catalan', tgl: 'tagalog',
  fas: 'persian', per: 'persian', urd: 'urdu', ben: 'bengali', tam: 'tamil', tel: 'telugu',
  mar: 'marathi', pan: 'punjabi', guj: 'gujarati', kan: 'kannada', mal: 'malayalam',
  sin: 'sinhala', nep: 'nepali', mya: 'burmese', bur: 'burmese', khm: 'khmer', lao: 'lao',
  amh: 'amharic', swa: 'swahili', zul: 'zulu', afr: 'afrikaans', sqi: 'albanian', alb: 'albanian',
  hye: 'armenian', kat: 'georgian', geo: 'georgian', aze: 'azerbaijani', uzb: 'uzbek',
  kaz: 'kazakh', kir: 'kyrgyz', mon: 'mongolian', lat: 'latin', cym: 'welsh', wel: 'welsh',
  gle: 'irish', irl: 'irish', eus: 'basque', baq: 'basque', glg: 'galician', isl: 'icelandic',
  ice: 'icelandic', mlt: 'maltese',
};

/** Convert a 2-letter code to a SubSource language name. */
export function toSubSourceLang(code?: string): string {
  if (!code) return 'english';
  const lower = code.toLowerCase();
  return LANG_MAP[lower] || lower;
}

/** Convert a SubSource language name back to a 2-letter code. */
export function fromSubSourceLang(name: string): string {
  const lower = name.toLowerCase();
  for (const [code, full] of Object.entries(LANG_MAP)) {
    if (full === lower) return code;
  }
  return lower.slice(0, 2);
}

/* ─── types ─── */
export interface SubSourceMovie {
  movieId: number;
  title: string;
  alternateTitle?: string;
  type: 'movie' | 'tvseries' | string;
  releaseYear?: number;
  imdbId?: string;
  tmdbId?: string;
  season?: number | null;
  subtitleCount: number;
  posters?: {
    small?: string;
    medium?: string;
    large?: string;
    original?: string;
  };
}

export interface SubSourceSubtitle {
  subtitleId: number;
  movieId: number;
  language: string;
  releaseInfo: string[];
  commentary?: string;
  files: number;
  size: number;
  hearingImpaired: boolean;
  foreignParts: boolean;
  framerate?: string;
  productionType?: string;
  releaseType?: string;
  downloads: number;
  comments: number;
  rating?: { good: number; bad: number; total: number };
  preview?: string;
  uploaderId?: number;
  createdAt?: string;
  contributors?: { id: number; displayname: string }[];
}

export interface SubSourceMovieResult {
  success: boolean;
  movies?: SubSourceMovie[];
  error?: string;
}

export interface SubSourceSubtitleResult {
  success: boolean;
  subtitles?: SubSourceSubtitle[];
  pagination?: { page: number; limit: number; total: number; pages: number };
  error?: string;
}

export interface SubSourceDownloadResult {
  success: boolean;
  content?: string; // extracted .srt text
  error?: string;
}

/* ─── low-level fetch ─── */
async function apiFetch(
  path: string,
  apiKey: string,
  params?: Record<string, string | number | undefined>
): Promise<{ ok: boolean; status: number; statusText: string; json(): Promise<any>; text: string; arrayBuffer?(): Promise<ArrayBuffer> }> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }

  log('FETCH', url.toString());

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'X-API-Key': apiKey,
  };

  if (window.fetchProxy) {
    log('FETCH', 'using fetchProxy');
    const proxyResult = await window.fetchProxy.fetch(url.toString(), { headers });
    if (proxyResult.error) {
      throw new Error(proxyResult.error);
    }
    if (!proxyResult.data) {
      throw new Error('No response data from fetchProxy');
    }
    log('FETCH', `status=${proxyResult.data.status} ok=${proxyResult.data.ok}`);
    return {
      ok: proxyResult.data.ok,
      status: proxyResult.data.status,
      statusText: proxyResult.data.statusText,
      text: proxyResult.data.text,
      json: () => proxyResult.data!.json(),
    };
  } else {
    log('FETCH', 'using native fetch');
    const response = await fetch(url.toString(), { headers });
    const text = await response.text();
    log('FETCH', `status=${response.status} ok=${response.ok} body=${text.slice(0, 200)}`);
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      text,
      json: () => Promise.resolve(JSON.parse(text)),
    };
  }
}

/* ─── movie search ─── */
export async function searchSubSourceMovies(
  apiKey: string,
  query: string,
  year?: string,
  type?: 'movie' | 'series' | 'all',
  season?: number
): Promise<SubSourceMovieResult> {
  if (!apiKey) {
    return { success: false, error: 'No API key configured' };
  }

  log('SEARCH_MOVIES', { query, year, type, season });

  try {
    const response = await apiFetch('/movies/search', apiKey, {
      searchType: 'text',
      q: query,
      year: year ? parseInt(year, 10) || undefined : undefined,
      type: type || 'all',
      season: season !== undefined && season > 0 ? season : undefined,
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const body = await response.json();
    log('SEARCH_MOVIES', 'response=', body);

    if (body.success === false) {
      return { success: false, error: body.error || 'API returned success=false' };
    }

    const movies: SubSourceMovie[] = Array.isArray(body.data) ? body.data : [];
    log('SEARCH_MOVIES', `found ${movies.length} movies`);

    return { success: true, movies };
  } catch (e: any) {
    log('SEARCH_MOVIES', 'ERROR', e?.message);
    return { success: false, error: e?.message || 'Network error' };
  }
}

/* ─── subtitle list ─── */
export async function searchSubSourceSubtitles(
  apiKey: string,
  movieId: number,
  language: string,
  sort: 'newest' | 'oldest' | 'popular' | 'rating' = 'popular'
): Promise<SubSourceSubtitleResult> {
  if (!apiKey) {
    return { success: false, error: 'No API key configured' };
  }

  log('SEARCH_SUBS', { movieId, language, sort });

  try {
    const subSourceLang = toSubSourceLang(language);
    log('SEARCH_SUBS', 'converted lang:', language, '→', subSourceLang);

    const response = await apiFetch('/subtitles', apiKey, {
      movieId,
      language: subSourceLang,
      sort,
      limit: 50,
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const body = await response.json();
    log('SEARCH_SUBS', 'response=', body);

    if (body.success === false) {
      return { success: false, error: body.error || 'API returned success=false' };
    }

    const subtitles: SubSourceSubtitle[] = Array.isArray(body.data) ? body.data : [];
    log('SEARCH_SUBS', `found ${subtitles.length} subtitles`);

    return { success: true, subtitles, pagination: body.pagination };
  } catch (e: any) {
    log('SEARCH_SUBS', 'ERROR', e?.message);
    return { success: false, error: e?.message || 'Network error' };
  }
}

/* ─── download + extract ─── */
export interface ZipEntry {
  fileName: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  dataStart: number;
}

export async function downloadSubSourceZip(
  apiKey: string,
  subtitleId: number
): Promise<{ success: boolean; data?: Uint8Array; error?: string }> {
  if (!apiKey) {
    return { success: false, error: 'No API key configured' };
  }

  log('DOWNLOAD_ZIP', { subtitleId });

  try {
    const url = `${API_BASE}/subtitles/${subtitleId}/download`;
    let zipData: Uint8Array;

    if (window.fetchProxy) {
      log('DOWNLOAD_ZIP', 'using fetchProxy.fetchBinary');
      const proxyResult = await window.fetchProxy.fetchBinary(url, {
        headers: { 'X-API-Key': apiKey, 'Accept': 'application/zip' },
      });
      if (proxyResult.error || !proxyResult.data || !proxyResult.success) {
        log('DOWNLOAD_ZIP', 'fetchBinary failed:', proxyResult.error);
        return { success: false, error: proxyResult.error || 'Binary download failed' };
      }
      zipData = proxyResult.data;
    } else {
      log('DOWNLOAD_ZIP', 'using native fetch with arrayBuffer');
      const response = await fetch(url, {
        headers: { 'X-API-Key': apiKey, 'Accept': 'application/zip' },
      });
      if (!response.ok) {
        log('DOWNLOAD_ZIP', `HTTP ${response.status}`);
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }
      zipData = new Uint8Array(await response.arrayBuffer());
    }

    log('DOWNLOAD_ZIP', `got ${zipData.length} bytes`);
    return { success: true, data: zipData };
  } catch (e: any) {
    log('DOWNLOAD_ZIP', 'ERROR', e?.message);
    return { success: false, error: e?.message || 'Download failed' };
  }
}

export async function downloadSubSourceSubtitle(
  apiKey: string,
  subtitleId: number
): Promise<SubSourceDownloadResult> {
  const zipResult = await downloadSubSourceZip(apiKey, subtitleId);
  if (!zipResult.success || !zipResult.data) {
    return { success: false, error: zipResult.error || 'Download failed' };
  }

  const srtText = await extractSrtFromZip(zipResult.data);
  if (!srtText) {
    log('DOWNLOAD', 'no .srt found in ZIP');
    return { success: false, error: 'Could not extract .srt from ZIP archive' };
  }

  log('DOWNLOAD', `extracted ${srtText.length} chars`);
  return { success: true, content: srtText };
}

/* ─── ZIP extraction ─── */
export function getZipEntries(zipData: Uint8Array): ZipEntry[] {
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let offset = 0;

  log('ZIP', `scanning ${zipData.length} bytes for entries`);

  while (offset < zipData.length - 30) {
    // local file header signature: PK\x03\x04
    if (
      zipData[offset] !== 0x50 ||
      zipData[offset + 1] !== 0x4b ||
      zipData[offset + 2] !== 0x03 ||
      zipData[offset + 3] !== 0x04
    ) {
      offset++;
      continue;
    }

    const compressionMethod = zipData[offset + 8] | (zipData[offset + 9] << 8);
    const compressedSize =
      zipData[offset + 18] |
      (zipData[offset + 19] << 8) |
      (zipData[offset + 20] << 16) |
      (zipData[offset + 21] << 24);
    const uncompressedSize =
      zipData[offset + 22] |
      (zipData[offset + 23] << 8) |
      (zipData[offset + 24] << 16) |
      (zipData[offset + 25] << 24);
    const fileNameLength = zipData[offset + 26] | (zipData[offset + 27] << 8);
    const extraLength = zipData[offset + 28] | (zipData[offset + 29] << 8);

    const fileNameStart = offset + 30;
    const fileName = decoder.decode(zipData.slice(fileNameStart, fileNameStart + fileNameLength));
    const dataStart = fileNameStart + fileNameLength + extraLength;

    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith('.srt') || lowerName.endsWith('.vtt')) {
      entries.push({
        fileName,
        compressionMethod,
        compressedSize,
        uncompressedSize,
        dataStart,
      });
    }

    // jump to next local file header
    offset = dataStart + compressedSize;
  }

  return entries;
}

export async function decompressZipEntry(zipData: Uint8Array, entry: ZipEntry): Promise<string | null> {
  const decoder = new TextDecoder();
  const { fileName, compressionMethod, compressedSize, uncompressedSize, dataStart } = entry;

  log('ZIP', `extracting: "${fileName}" method=${compressionMethod} size=${compressedSize}`);

  if (compressionMethod === 0) {
    // Stored (no compression)
    const text = decoder.decode(zipData.slice(dataStart, dataStart + uncompressedSize));
    log('ZIP', 'extracted stored file');
    return text;
  }

  if (compressionMethod === 8) {
    // Deflated – try raw deflate via DecompressionStream
    try {
      const compressed = zipData.slice(dataStart, dataStart + compressedSize);
      log('ZIP', 'decompressing deflated entry…');
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(compressed);
      writer.close();

      const reader = ds.readable.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const total = chunks.reduce((s, c) => s + c.length, 0);
      const result = new Uint8Array(total);
      let pos = 0;
      for (const chunk of chunks) {
        result.set(chunk, pos);
        pos += chunk.length;
      }

      const text = decoder.decode(result);
      log('ZIP', 'extracted deflated file');
      return text;
    } catch (e: any) {
      log('ZIP', 'deflate-raw failed:', e?.message);
    }
  }

  return null;
}

async function extractSrtFromZip(zipData: Uint8Array): Promise<string | null> {
  const entries = getZipEntries(zipData);
  if (entries.length > 0) {
    return decompressZipEntry(zipData, entries[0]);
  }
  return null;
}

/* ─── API key validation ─── */
export async function validateSubSourceApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;

  log('VALIDATE', 'checking key...');

  try {
    // Use the movies search endpoint with a known query as a lightweight validation
    const response = await apiFetch('/movies/search', apiKey, {
      searchType: 'text',
      q: 'test',
      type: 'all',
    });

    if (!response.ok) {
      log('VALIDATE', `failed: HTTP ${response.status}`);
      return false;
    }

    const body = await response.json();
    log('VALIDATE', 'response=', body);

    // A valid key returns success=true (even if no movies found)
    // An invalid key returns 401/403 or success=false
    return body.success === true;
  } catch (e: any) {
    log('VALIDATE', 'ERROR', e?.message);
    return false;
  }
}
