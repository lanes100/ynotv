import React, { useMemo } from 'react';
import { useStremioHover } from '../../contexts/StremioHoverContext';
import './StremioHoverCard.css';

export function StremioHoverCard() {
  const {
    activeItem,
    anchorRect,
    mouseY,
    details,
    cast,
    loading,
    isVisible,
    onHoverCardMouseEnter,
    onHoverCardMouseLeave,
  } = useStremioHover();

  // Position calculation
  const style = useMemo<React.CSSProperties | null>(() => {
    if (!isVisible || !anchorRect) return null;

    const rect = anchorRect;
    const isTopHalf = rect.top + rect.height / 2 < window.innerHeight / 2;
    const isLeftHalf = rect.left + rect.width / 2 < window.innerWidth / 2;
    const cardWidth = 320;
    const gap = 12;

    const styleObj: React.CSSProperties = {
      position: 'fixed',
      width: `${cardWidth}px`,
      zIndex: 10000,
    };

    // Horizontal Position: Left half -> appear on the right side of the poster; Right half -> appear on the left side
    if (isLeftHalf) {
      const calculatedLeft = rect.right + gap;
      // Safety check: if it would overflow the right edge of viewport, flip to left side
      if (calculatedLeft + cardWidth > window.innerWidth - 16) {
        styleObj.right = `${window.innerWidth - rect.left + gap}px`;
        styleObj.left = 'auto';
      } else {
        styleObj.left = `${calculatedLeft}px`;
        styleObj.right = 'auto';
      }
    } else {
      const calculatedLeft = rect.left - gap - cardWidth;
      // Safety check: if it would overflow the left edge of viewport, flip to right side
      if (calculatedLeft < 16) {
        styleObj.left = `${rect.right + gap}px`;
        styleObj.right = 'auto';
      } else {
        styleObj.right = `${window.innerWidth - rect.left + gap}px`;
        styleObj.left = 'auto';
      }
    }

    // Vertical Position relative to where the mouse is
    const targetY = mouseY !== null ? mouseY : (isTopHalf ? rect.top : rect.bottom);

    if (isTopHalf) {
      // Top half: display going down from where the mouse is
      // We subtract a small buffer (e.g., 20px) so the cursor is within the card's vertical bounds,
      // which prevents the card from closing if the user moves slightly upwards when moving to the card.
      const buffer = 20;
      let topPos = targetY - buffer;
      if (topPos < 12) topPos = 12;

      styleObj.top = `${topPos}px`;
      styleObj.bottom = 'auto';
      styleObj.maxHeight = `calc(100vh - ${topPos}px - 24px)`;
    } else {
      // Bottom half: display going up from where the mouse is
      // We add a small buffer (e.g., 20px) so the cursor is within the card's vertical bounds.
      const buffer = 20;
      let bottomPos = (window.innerHeight - targetY) - buffer;
      if (bottomPos < 12) bottomPos = 12;

      styleObj.bottom = `${bottomPos}px`;
      styleObj.top = 'auto';
      styleObj.maxHeight = `calc(100vh - ${bottomPos}px - 24px)`;
    }

    return styleObj;
  }, [isVisible, anchorRect, mouseY]);

  if (!isVisible || !activeItem || !style) return null;
  if (document.documentElement.hasAttribute('data-hover-details-disabled')) return null;

  const title = activeItem.name;
  const year = details?.year ?? activeItem.year;
  const rating = details?.imdbRating ?? activeItem.imdbRating;
  const genres = details?.genres ?? activeItem.genres ?? [];
  const plot = details?.description ?? activeItem.description;

  const isSeries = activeItem.type === 'series';

  // Calculate seasons and episodes count
  const seriesInfoText = isSeries && details?.videos ? (() => {
    const s = new Set<number>();
    for (const v of details.videos) {
      if (v.season !== undefined) s.add(v.season);
    }
    const seasonsCount = s.size || (details.videos.length > 0 ? 1 : 0);
    const episodesCount = details.videos.length;
    return `${seasonsCount} Season${seasonsCount !== 1 ? 's' : ''} - ${episodesCount} Episode${episodesCount !== 1 ? 's' : ''}`;
  })() : null;

  function getInitials(name: string): string {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  const isTopHalf = anchorRect ? (anchorRect.top + anchorRect.height / 2 < window.innerHeight / 2) : true;

  return (
    <div
      className={`stremio-hover-card-overlay ${isTopHalf ? 'slide-down' : 'slide-up'}`}
      style={style}
      onMouseEnter={onHoverCardMouseEnter}
      onMouseLeave={onHoverCardMouseLeave}
    >
      <div className="stremio-hover-card-content">
        {/* Title */}
        <h2 className="stremio-hover-title">{title}</h2>

        {/* Meta row: Year, Seasons/Episodes or Runtime */}
        <div className="stremio-hover-meta-row">
          {year && <span className="stremio-hover-year">{year}</span>}
          {isSeries ? (
            seriesInfoText ? (
              <span className="stremio-hover-series-info">{seriesInfoText}</span>
            ) : (
              <span className="stremio-hover-series-info skeleton-text-pulse" style={{ width: '120px', height: '14px' }} />
            )
          ) : (
            details?.runtime && <span className="stremio-hover-runtime">{details.runtime}</span>
          )}
        </div>

        {/* IMDb Rating */}
        {rating && (
          <div className="stremio-hover-rating-row">
            <span className="stremio-hover-imdb-badge">IMDb</span>
            <span className="stremio-hover-rating-value">{rating}</span>
          </div>
        )}

        {/* Genres/Tags */}
        {genres.length > 0 && (
          <div className="stremio-hover-tags-row">
            {genres.map((g, i) => (
              <span key={i} className="stremio-hover-tag-pill">
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Plot Synopsis */}
        <div className="stremio-hover-plot-section">
          <div className="stremio-hover-section-title">Plot</div>
          <div className="stremio-hover-plot-text-wrap">
            {loading && !plot ? (
              <div className="stremio-hover-plot-skeleton">
                <div className="skeleton-line-pulse" style={{ width: '100%' }} />
                <div className="skeleton-line-pulse" style={{ width: '92%' }} />
                <div className="skeleton-line-pulse" style={{ width: '85%' }} />
              </div>
            ) : plot ? (
              <p className="stremio-hover-plot-paragraph">{plot}</p>
            ) : (
              <p className="stremio-hover-plot-empty">No plot synopsis available.</p>
            )}
          </div>
        </div>

        {/* Cast Section */}
        <div className="stremio-hover-cast-section">
          <div className="stremio-hover-section-title">Cast</div>
          {loading && cast.length === 0 ? (
            <div className="stremio-hover-cast-grid">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="stremio-hover-cast-card-skeleton">
                  <div className="skeleton-circle-pulse" />
                  <div className="skeleton-text-lines">
                    <div className="skeleton-line-pulse" style={{ width: '75px', height: '10px' }} />
                    <div className="skeleton-line-pulse" style={{ width: '55px', height: '8px', marginTop: '6px' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : cast.length > 0 ? (
            <div className="stremio-hover-cast-grid">
              {cast.map((member, i) => (
                <div key={i} className="stremio-hover-cast-card">
                  {member.photo ? (
                    <img
                      src={member.photo}
                      alt={member.name}
                      className="stremio-hover-cast-avatar"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.stremio-hover-cast-avatar-fallback');
                        if (fallback) (fallback as HTMLElement).style.display = 'flex';
                      }}
                    />
                  ) : null}
                  {(!member.photo) && (
                    <div className="stremio-hover-cast-avatar-fallback">
                      {getInitials(member.name)}
                    </div>
                  )}
                  {/* Keep fallback element hidden unless img load fails */}
                  {member.photo && (
                    <div className="stremio-hover-cast-avatar-fallback" style={{ display: 'none' }}>
                      {getInitials(member.name)}
                    </div>
                  )}
                  <div className="stremio-hover-cast-info">
                    <div className="stremio-hover-cast-name" title={member.name}>
                      {member.name}
                    </div>
                    {member.character && (
                      <div className="stremio-hover-cast-role" title={member.character}>
                        {member.character}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="stremio-hover-cast-empty">No cast information available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
