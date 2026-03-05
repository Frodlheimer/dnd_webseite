import { useEffect, useState } from 'react';

const MEDIA_QUERY = '(prefers-reduced-motion: reduce)';

export const usePrefersReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQueryList = window.matchMedia(MEDIA_QUERY);
    const apply = () => {
      setPrefersReducedMotion(mediaQueryList.matches);
    };

    apply();
    mediaQueryList.addEventListener('change', apply);
    return () => {
      mediaQueryList.removeEventListener('change', apply);
    };
  }, []);

  return prefersReducedMotion;
};
