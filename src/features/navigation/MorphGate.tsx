import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { preloadOnIntent } from "./intentPreload";
import { settleMorph } from "./morph";

/**
 * Lives inside the router: tells a running morph that the new page is
 * rendered, starts new pages from the top, and downloads a page as soon as
 * the user shows the intent to open it (see intentPreload).
 */
const MorphGate = () => {
  const location = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (navigationType === "PUSH" && !location.hash) window.scrollTo(0, 0);
    settleMorph();
  }, [location.key, location.hash, navigationType]);

  useEffect(() => preloadOnIntent(), []);

  return null;
};

export default MorphGate;
