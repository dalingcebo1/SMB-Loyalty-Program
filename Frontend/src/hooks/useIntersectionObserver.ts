// src/hooks/useIntersectionObserver.ts
import { useEffect, useRef, useState } from 'react';

export interface UseIntersectionObserverProps {
  threshold?: number;
  root?: Element | null;
  rootMargin?: string;
  freezeOnceVisible?: boolean;
}

export function useIntersectionObserver({
  threshold = 0,
  root = null,
  rootMargin = '0%',
  freezeOnceVisible = false,
}: UseIntersectionObserverProps = {}) {
  const elementRef = useRef<Element | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  const frozen = isVisible && freezeOnceVisible;

  useEffect(() => {
    const node = elementRef.current;
    if (!node || frozen) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold, root, rootMargin }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [threshold, root, rootMargin, frozen]);

  return [elementRef, isVisible] as const;
}
