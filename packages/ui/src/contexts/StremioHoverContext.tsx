import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import type { StremioMetaPreview, StremioMeta, InstalledAddon } from '../types/stremio';
import { fetchMeta } from '../services/stremio-addon';
import { useStremioAddonStore } from '../stores/stremioAddonStore';
import { useTmdbAccessToken } from '../hooks/useTmdbLists';
import { searchTvShows, searchMovies, getTvShowCredits, getMovieCredits, getTmdbImageUrl } from '../services/tmdb';

export interface StremioCastMember {
  name: string;
  character: string;
  photo: string | null;
}

interface StremioHoverContextType {
  activeItem: StremioMetaPreview | null;
  anchorRect: DOMRect | null;
  mouseY: number | null;
  details: StremioMeta | null;
  cast: StremioCastMember[];
  loading: boolean;
  isVisible: boolean;
  disabled: boolean;
  onCardMouseEnter: (item: StremioMetaPreview, element: HTMLElement, event?: React.MouseEvent) => void;
  onCardMouseLeave: () => void;
  onCardClick: () => void;
  onHoverCardMouseEnter: () => void;
  onHoverCardMouseLeave: () => void;
}

const StremioHoverContext = createContext<StremioHoverContextType | undefined>(undefined);

export function StremioHoverProvider({ children, addons, disabled }: { children: React.ReactNode; addons?: InstalledAddon[]; disabled?: boolean }) {
  const [activeItem, setActiveItem] = useState<StremioMetaPreview | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [mouseY, setMouseY] = useState<number | null>(null);
  const [details, setDetails] = useState<StremioMeta | null>(null);
  const [cast, setCast] = useState<StremioCastMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const stremioAddons = useStremioAddonStore((s) => s.enabledAddons);
  const enabledAddons = addons ?? stremioAddons;
  const tmdbToken = useTmdbAccessToken();

  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchIdRef = useRef(0);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Resolve disabled status reactively from document attribute
  const [domDisabled, setDomDisabled] = useState(() => document.documentElement.hasAttribute('data-hover-details-disabled'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDomDisabled(document.documentElement.hasAttribute('data-hover-details-disabled'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-hover-details-disabled'] });
    return () => observer.disconnect();
  }, []);

  const isCurrentlyDisabled = disabled !== undefined ? disabled : domDisabled;

  const fetchDetails = async (item: StremioMetaPreview, fetchId: number) => {
    setLoading(true);
    setDetails(null);
    setCast([]);

    try {
      const meta = await fetchMeta(enabledAddons, item.type, item.id);
      if (fetchIdRef.current !== fetchId) return;

      if (!meta) {
        setDetails(item as StremioMeta);
        setLoading(false);
        return;
      }

      setDetails(meta);

      // Fetch TMDB Cast details if accessToken is available
      if (tmdbToken) {
        const isSeries = meta.type === 'series';
        const title = meta.name;
        const year = meta.year;
        let tmdbId: number | null = null;

        try {
          if (isSeries) {
            const results = await searchTvShows(tmdbToken, title, year ? parseInt(String(year)) : undefined);
            if (results.length > 0) tmdbId = results[0].id;
          } else {
            const results = await searchMovies(tmdbToken, title, year ? parseInt(String(year)) : undefined);
            if (results.length > 0) tmdbId = results[0].id;
          }

          if (tmdbId && fetchIdRef.current === fetchId) {
            let tmdbCast: StremioCastMember[] = [];
            if (isSeries) {
              const credits = await getTvShowCredits(tmdbToken, tmdbId);
              if (credits.cast) {
                tmdbCast = credits.cast.slice(0, 4).map((c: any) => ({
                  name: c.name,
                  character: c.character,
                  photo: c.profile_path ? getTmdbImageUrl(c.profile_path, 'w185') : null,
                }));
              }
            } else {
              const credits = await getMovieCredits(tmdbToken, tmdbId);
              if (credits.cast) {
                tmdbCast = credits.cast.slice(0, 4).map((c: any) => ({
                  name: c.name,
                  character: c.character,
                  photo: c.profile_path ? getTmdbImageUrl(c.profile_path, 'w185') : null,
                }));
              }
            }

            if (tmdbCast.length > 0 && fetchIdRef.current === fetchId) {
              setCast(tmdbCast);
              setLoading(false);
              return;
            }
          }
        } catch (tmdbErr) {
          console.warn('[StremioHoverContext] Error getting TMDB cast:', tmdbErr);
        }
      }

      // Fallback to meta.cast names
      if (fetchIdRef.current === fetchId && meta.cast && meta.cast.length > 0) {
        setCast(
          meta.cast.slice(0, 4).map((name) => ({
            name,
            character: '',
            photo: null,
          }))
        );
      }
    } catch (e) {
      console.warn('[StremioHoverContext] Failed to load details:', e);
    } finally {
      if (fetchIdRef.current === fetchId) {
        setLoading(false);
      }
    }
  };

  const onCardMouseEnter = (item: StremioMetaPreview, element: HTMLElement, event?: React.MouseEvent) => {
    if (isCurrentlyDisabled) return;

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
    }

    const rect = element.getBoundingClientRect();
    const clientY = event ? event.clientY : (rect.top + rect.height / 2);

    if (activeItem?.id === item.id) {
      // Keep visible and update coordinates if mouse re-entered the same card
      setAnchorRect(rect);
      setMouseY(clientY);
      return;
    }

    showTimerRef.current = setTimeout(() => {
      setActiveItem(item);
      setIsVisible(true);
      setAnchorRect(rect);
      setMouseY(clientY);

      const fetchId = ++fetchIdRef.current;
      void fetchDetails(item, fetchId);
    }, 300);
  };

  const onCardMouseLeave = () => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      setActiveItem(null);
      setDetails(null);
      setCast([]);
      setAnchorRect(null);
      setMouseY(null);
    }, 200);
  };

  const onCardClick = () => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setIsVisible(false);
    setActiveItem(null);
    setDetails(null);
    setCast([]);
    setAnchorRect(null);
    setMouseY(null);
  };

  const onHoverCardMouseEnter = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const onHoverCardMouseLeave = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      setActiveItem(null);
      setDetails(null);
      setCast([]);
      setAnchorRect(null);
      setMouseY(null);
    }, 200);
  };

  return (
    <StremioHoverContext.Provider
      value={{
        activeItem,
        anchorRect,
        mouseY,
        details,
        cast,
        loading,
        isVisible,
        disabled: isCurrentlyDisabled,
        onCardMouseEnter,
        onCardMouseLeave,
        onCardClick,
        onHoverCardMouseEnter,
        onHoverCardMouseLeave,
      }}
    >
      {children}
    </StremioHoverContext.Provider>
  );
}

export function useStremioHover() {
  const context = useContext(StremioHoverContext);
  if (!context) {
    throw new Error('useStremioHover must be used within a StremioHoverProvider');
  }
  return context;
}

export function useStremioHoverTrigger(item: StremioMetaPreview) {
  const { onCardMouseEnter, onCardMouseLeave, onCardClick } = useStremioHover();

  return {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      onCardMouseEnter(item, e.currentTarget, e);
    },
    onMouseLeave: onCardMouseLeave,
    onClick: onCardClick,
  };
}
