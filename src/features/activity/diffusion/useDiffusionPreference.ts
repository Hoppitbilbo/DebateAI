import { useCallback, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion";

// The diffusion effect on the final feedback is an easter egg: off by
// default, each person switches it on or off for themselves (kept in this
// browser), and never shown to whoever asked the system for less motion.

const KEY = "debateai:feedback-diffusion";

const stored = () => {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
};

export const useDiffusionPreference = () => {
  const [on, setOn] = useState(stored);
  const toggle = useCallback(() => {
    setOn((was) => {
      const next = !was;
      try {
        if (next) localStorage.setItem(KEY, "on");
        else localStorage.removeItem(KEY);
      } catch {
        /* not kept: it lasts until the page is closed */
      }
      return next;
    });
  }, []);
  return { enabled: on, active: on && !prefersReducedMotion(), toggle };
};
