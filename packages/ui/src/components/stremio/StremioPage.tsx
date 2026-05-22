import { useState, useEffect, useCallback, useRef } from 'react';
import type { StremioStreamPickerMode, StremioMeta, StremioStream, StremioVideo } from '../../types/stremio';
import { useStremioAddonStore } from '../../stores/stremioAddonStore';
import {
  useStremioView,
  useSetStremioView,
  useStremioActiveMeta,
  useSetStremioActiveMeta,
  useStremioSelectedSeason,
  useSetStremioSelectedSeason,
  useUIStore,
} from '../../stores/uiStore';
import { StremioTopbar } from './StremioTopbar';
import { StremioHome } from './StremioHome';
import { StremioLibrary } from './StremioLibrary';
import { StremioCalendar } from './StremioCalendar';
import { StremioDetail } from './StremioDetail';
import { AddonManagerPanel } from './AddonManagerPanel';
import { StremioHoverProvider } from '../../contexts/StremioHoverContext';
import { StremioHoverCard } from './StremioHoverCard';
import './StremioPage.css';

interface StremioPageProps {
  onClose: () => void;
  stremioStreamPickerMode: StremioStreamPickerMode;
  onStreamPickerModeChange: (mode: StremioStreamPickerMode) => void;
}

export function StremioPage({ onClose, stremioStreamPickerMode, onStreamPickerModeChange }: StremioPageProps) {
  const addons = useStremioAddonStore((s) => s.enabledAddons);
  const stremioView = useStremioView();
  const setStremioView = useSetStremioView();
  const activeMeta = useStremioActiveMeta();
  const setActiveMeta = useSetStremioActiveMeta();
  const selectedSeason = useStremioSelectedSeason();
  const setSelectedSeason = useSetStremioSelectedSeason();
  const [showAddonManager, setShowAddonManager] = useState(false);

  const mainRef = useRef<HTMLDivElement | null>(null);
  const [homeScrollTop, setHomeScrollTop] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAddonManager) {
          setShowAddonManager(false);
        } else if (activeMeta) {
          setActiveMeta(null);
          setStremioView('home');
          setSelectedSeason(undefined);
        } else if (stremioView === 'search') {
          setStremioView('home');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMeta, stremioView, showAddonManager, onClose, setActiveMeta, setStremioView, setSelectedSeason]);

  const handleItemClick = useCallback((meta: StremioMeta) => {
    if (mainRef.current) {
      setHomeScrollTop(mainRef.current.scrollTop);
    }
    setActiveMeta(meta);
    setStremioView('detail');
    // If preselectVideoId is set (from Continue Watching), keep the season
    // already set by the caller. Otherwise, reset to undefined so StremioDetail
    // auto-selects Season 1.
    if (!useUIStore.getState().stremioPreselectVideoId) {
      setSelectedSeason(undefined);
    }
  }, [setActiveMeta, setStremioView, setSelectedSeason]);

  const handleBack = useCallback(() => {
    if (activeMeta) {
      setActiveMeta(null);
      setStremioView(homeScrollTop > 0 ? 'home' : 'home');
      setSelectedSeason(undefined);
    }
  }, [activeMeta, setActiveMeta, setStremioView, setSelectedSeason]);

  const handlePlayStream = useCallback((stream: StremioStream, meta: StremioMeta, episodeVideo?: StremioVideo) => {
    window.dispatchEvent(new CustomEvent('ynotv:stremio-play', {
      detail: { stream, meta, season: selectedSeason, episodeVideo },
    }));
  }, [selectedSeason]);

  useEffect(() => {
    if (stremioView === 'home' || stremioView === 'search') {
      if (mainRef.current && homeScrollTop > 0) {
        const el = mainRef.current;
        const timer = setTimeout(() => {
          el.scrollTop = homeScrollTop;
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [stremioView, homeScrollTop]);

  return (
    <StremioHoverProvider>
      <div className="stremio-page">
        {showAddonManager && (
          <AddonManagerPanel onClose={() => setShowAddonManager(false)} />
        )}

        <StremioTopbar
          addons={addons}
          onOpenAddonManager={() => setShowAddonManager(true)}
        />

        <div className="stremio-main" ref={mainRef}>
          <div style={{ display: stremioView === 'home' || stremioView === 'search' ? 'block' : 'none' }}>
            <StremioHome
              addons={addons}
              onItemClick={handleItemClick}
            />
          </div>

          <div style={{ display: stremioView === 'library' ? 'block' : 'none' }}>
            <StremioLibrary
              onItemClick={handleItemClick}
            />
          </div>

          <div style={{ display: stremioView === 'calendar' ? 'block' : 'none' }}>
            <StremioCalendar
              onItemClick={handleItemClick}
            />
          </div>

          {stremioView === 'detail' && activeMeta && (
            <StremioDetail
              meta={activeMeta}
              onBack={handleBack}
              onPlay={handlePlayStream}
              streamPickerMode={stremioStreamPickerMode}
            />
          )}
        </div>

        <StremioHoverCard />
      </div>
    </StremioHoverProvider>
  );
}