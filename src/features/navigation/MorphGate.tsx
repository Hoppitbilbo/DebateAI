import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { preloadPrefix } from "@/lib/lazyPage";
import { settleMorph } from "./morph";

/**
 * Lives inside the router: tells a running morph that the new page is
 * rendered, starts new pages from the top, and downloads the app pages in the
 * background so that opening one is instant.
 */
const MorphGate = () => {
  const location = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (navigationType === "PUSH" && !location.hash) window.scrollTo(0, 0);
    settleMorph();
  }, [location.key, location.hash, navigationType]);

  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    idle(() => void preloadPrefix("/apps"));
  }, []);

  return null;
};

export default MorphGate;
