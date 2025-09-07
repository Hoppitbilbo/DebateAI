/**
 * @file A custom React hook to reveal elements on scroll using the Intersection Observer API.
 * @remarks This hook provides a way to trigger animations or state changes when an element
 * enters the viewport.
 */

import { useEffect, useRef, useState } from 'react';

/**
 * @typedef {object} UseScrollRevealOptions
 * @description Options for the Intersection Observer.
 * @property {number} [threshold=0.1] - The percentage of the element that needs to be visible to trigger the reveal (0-1).
 * @property {string} [rootMargin='0px'] - A margin around the root element (e.g., '10px 20px 30px 40px').
 * @property {boolean} [once=true] - If true, the animation will only trigger once.
 */
type UseScrollRevealOptions = {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
};

/**
 * @function useScrollReveal
 * @description A custom hook that uses the Intersection Observer API to detect when an element
 * is visible in the viewport.
 * @param {UseScrollRevealOptions} [options={}] - Configuration options for the Intersection Observer.
 * @returns {{ ref: React.MutableRefObject<HTMLElement | null>, isVisible: boolean }} An object containing a ref to attach to the element and a boolean indicating its visibility.
 */
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
