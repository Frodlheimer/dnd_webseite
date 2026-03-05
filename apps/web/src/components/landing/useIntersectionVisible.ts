import { useEffect, useState, type RefObject } from 'react';

type UseIntersectionVisibleOptions = {
  rootMargin?: string;
  threshold?: number;
  once?: boolean;
};

export const useIntersectionVisible = <T extends Element>(
  ref: RefObject<T | null>,
  options?: UseIntersectionVisibleOptions
): boolean => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    let seen = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) {
          return;
        }

        if (entry.isIntersecting) {
          setIsVisible(true);
          if (options?.once !== false) {
            seen = true;
            observer.disconnect();
          }
          return;
        }

        if (!seen && options?.once === false) {
          setIsVisible(false);
        }
      },
      {
        rootMargin: options?.rootMargin ?? '120px',
        threshold: options?.threshold ?? 0.15
      }
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [options?.once, options?.rootMargin, options?.threshold, ref]);

  return isVisible;
};
