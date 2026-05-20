import { useState, useEffect, useCallback } from 'react';
import type { StremioStreamPickerMode, StremioMeta, StremioStream } from '../../types/stremio';
import { useStremioAddonStore } from '../../stores/stremioAddonStore';
import {
  useStremioView,
  useSetStremioView,
  useStremioActiveMeta,
  useSetStremioActiveMeta,
  useStremioSelectedSeason,
  useSetStremioSelectedSeason,
} from '../../stores/uiStore';
import { StremioSidebar } from './StremioSidebar';
import { StremioHome } from './StremioHome';
import { StremioDetail } from './StremioDetail';
import { AddonManagerPanel } from './AddonManagerPanel';
import './StremioPage.css';

interface StremioPageProps {
  onClose: () => void;
  stremioStreamPickerMode: StremioStreamPickerMode;
  onStreamPickerModeChange: (mode: StremioStreamPickerMode) => void;
}

export function StremioPage({ onClose, stremioStreamPickerMode, onStreamPickerModeChange }: StremioPageProps) {
  const addons = useStremioAddonStore((s) => s.addons);
  const stremioView = useStremioView();
  const setStremioView = useSetStremioView();
  const activeMeta = useStremioActiveMeta();
  const setActiveMeta = useSetStremioActiveMeta();
  const selectedSeason = useStremioSelectedSeason();
  const setSelectedSeason = useSetStremioSelectedSeason();
  const [showAddonManager, setShowAddonManager] = useState(false);

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
    setActiveMeta(meta);
    setStremioView('detail');
    setSelectedSeason(undefined);
  }, [setActiveMeta, setStremioView, setSelectedSeason]);

  const handleBack = useCallback(() => {
    if (activeMeta) {
      setActiveMeta(null);
      setStremioView('home');
      setSelectedSeason(undefined);
    }
  }, [activeMeta, setActiveMeta, setStremioView, setSelectedSeason]);

  const handlePlayStream = useCallback((stream: StremioStream, meta: StremioMeta) => {
    window.dispatchEvent(new CustomEvent('ynotv:stremio-play', {
      detail: { stream, meta, season: selectedSeason },
    }));
  }, [selectedSeason]);

  return (
    <div className="stremio-page">
      {showAddonManager && (
        <AddonManagerPanel onClose={() => setShowAddonManager(false)} />
      )}

      <StremioSidebar
        addons={addons}
        onOpenAddonManager={() => setShowAddonManager(true)}
      />

      <div className="stremio-main">
        {stremioView === 'detail' && activeMeta ? (
          <StremioDetail
            meta={activeMeta}
            onBack={handleBack}
            onPlay={handlePlayStream}
            streamPickerMode={stremioStreamPickerMode}
          />
        ) : (
          <StremioHome
            addons={addons}
            onItemClick={handleItemClick}
          />
        )}
      </div>
    </div>
  );
}
