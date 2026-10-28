/** True when the reader asked the system for less motion. False where the browser cannot tell. */
export const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
