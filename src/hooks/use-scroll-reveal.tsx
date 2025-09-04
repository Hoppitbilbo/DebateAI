
import { useEffect, useRef, useState } from 'react';

// Options for the Intersection Observer
type UseScrollRevealOptions = {
  threshold?: number; // Percentage of element visible to trigger (0-1)
  rootMargin?: string; // Margin around the root element
  once?: boolean; // Whether to trigger only once
};

// Hook to reveal elements on scroll
export function useScrollReveal({
  threshold = 0.1,
  rootMargin = '0px',
  once = true,
}: UseScrollRevealOptions = {}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const currentRef = ref.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) {
            observer.unobserve(currentRef);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(currentRef);

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold, rootMargin, once]);

  return { ref, isVisible };
}
