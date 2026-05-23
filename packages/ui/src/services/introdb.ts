export interface IntroSegment {
  start_sec: number;
  end_sec: number;
  start_ms: number;
  end_ms: number;
  confidence: number;
  submission_count: number;
  updated_at: string;
}

export interface IntroDbResponse {
  imdb_id: string;
  season: number;
  episode: number;
  intro: IntroSegment | null;
  recap: IntroSegment | null;
  outro: IntroSegment | null;
}

export async function fetchIntroSegments(
  imdbId: string,
  season: number,
  episode: number
): Promise<IntroSegment | null> {
  try {
    const url = `https://api.introdb.app/segments?imdb_id=${encodeURIComponent(imdbId)}&season=${season}&episode=${episode}`;
    console.log('[IntroDB] Fetching:', url);

    const fp = (window as any).fetchProxy;
    const useProxy = fp?.fetch;
    let data: IntroDbResponse;

    if (useProxy) {
      const res = await useProxy(url);
      if (!res.data?.ok) {
        console.log('[IntroDB] Request failed:', res.data?.status);
        return null;
      }
      data = await res.data.json();
    } else {
      const response = await fetch(url);
      if (!response.ok) {
        console.log('[IntroDB] Request failed:', response.status);
        return null;
      }
      data = await response.json();
    }

    console.log('[IntroDB] Response:', data);

    if (data.intro && data.intro.start_sec != null && data.intro.end_sec != null) {
      console.log('[IntroDB] Found intro:', data.intro.start_sec, '-', data.intro.end_sec);
      return data.intro;
    }

    console.log('[IntroDB] No intro found for this episode');
    return null;
  } catch (err) {
    console.error('[IntroDB] Error:', err);
    return null;
  }
}
