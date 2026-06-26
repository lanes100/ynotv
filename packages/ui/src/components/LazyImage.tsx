import { useState, useRef, useEffect } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  rootMargin?: string;
}

export function LazyImage({ src, alt, rootMargin = '400px', className, style, fetchPriority, ...imgProps }: LazyImageProps) {
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className} style={{ ...style, overflow: 'hidden' }}>
      {inView && (
        <img
          src={src}
          alt={alt}
          decoding="async"
          fetchPriority={fetchPriority as any}
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: loaded ? 1 : 0, transition: 'opacity 0.15s' }}
          onLoad={() => setLoaded(true)}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          {...imgProps}
        />
      )}
    </div>
  );
}
