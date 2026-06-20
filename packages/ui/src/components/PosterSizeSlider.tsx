import { memo, useCallback } from 'react';
import './PosterSizeSlider.css';

export const POSTER_SIZE_PRESETS = [
  { value: 100, label: 'XS' },
  { value: 120, label: 'S' },
  { value: 150, label: 'M' }, // matches default 150px
  { value: 180, label: 'L' },
  { value: 210, label: 'XL' },
  { value: 240, label: '2XL' },
  { value: 270, label: '3XL' },
] as const;

export type PosterSizeValue = typeof POSTER_SIZE_PRESETS[number]['value'];

interface PosterSizeSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export const PosterSizeSlider = memo(function PosterSizeSlider({ value, onChange }: PosterSizeSliderProps) {
  // Find the closest preset value to the current value
  const currentIndex = POSTER_SIZE_PRESETS.reduce((bestIndex, current, index) => {
    const currentDiff = Math.abs(current.value - value);
    const bestDiff = Math.abs(POSTER_SIZE_PRESETS[bestIndex].value - value);
    return currentDiff < bestDiff ? index : bestIndex;
  }, 0);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value, 10);
    onChange(POSTER_SIZE_PRESETS[index].value);
  }, [onChange]);

  const handleDecrease = useCallback(() => {
    if (currentIndex > 0) {
      onChange(POSTER_SIZE_PRESETS[currentIndex - 1].value);
    }
  }, [currentIndex, onChange]);

  const handleIncrease = useCallback(() => {
    if (currentIndex < POSTER_SIZE_PRESETS.length - 1) {
      onChange(POSTER_SIZE_PRESETS[currentIndex + 1].value);
    }
  }, [currentIndex, onChange]);

  const canDecrease = currentIndex > 0;
  const canIncrease = currentIndex < POSTER_SIZE_PRESETS.length - 1;

  return (
    <div className="poster-size-slider">
      <button
        className={`poster-size-slider__icon poster-size-slider__icon--small ${!canDecrease ? 'disabled' : ''}`}
        onClick={handleDecrease}
        disabled={!canDecrease}
        aria-label="Decrease poster size"
        title="Smaller posters"
        type="button"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <rect x="2" y="2" width="20" height="20" rx="2" />
        </svg>
      </button>
      <div className="poster-size-slider__track">
        <input
          type="range"
          min={0}
          max={POSTER_SIZE_PRESETS.length - 1}
          step={1}
          value={currentIndex}
          onChange={handleChange}
          className="poster-size-slider__input"
          aria-label="Poster size"
          title={`Poster size: ${POSTER_SIZE_PRESETS[currentIndex]?.label || 'Default'}`}
        />
        <div className="poster-size-slider__marks">
          {POSTER_SIZE_PRESETS.map((_, index) => (
            <div
              key={index}
              className={`poster-size-slider__mark ${index === currentIndex ? 'active' : ''}`}
            />
          ))}
        </div>
      </div>
      <button
        className={`poster-size-slider__icon poster-size-slider__icon--large ${!canIncrease ? 'disabled' : ''}`}
        onClick={handleIncrease}
        disabled={!canIncrease}
        aria-label="Increase poster size"
        title="Larger posters"
        type="button"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <rect x="2" y="2" width="20" height="20" rx="2" />
        </svg>
      </button>
    </div>
  );
});
