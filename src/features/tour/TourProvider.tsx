import { type ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth";
import { lazyPage } from "@/lib/lazyPage";
import { TourContext, type TourApi } from "./tour";
import { closeTour, DEFAULT_TOUR_PREFS, loadTourPrefs, saveTourPrefs, shouldAutoStart, type TourPrefs } from "./tourPrefs";
import type { TourId } from "./tours";

const ProductTour = lazyPage(() => import("./ProductTour"));

/** Lets the page render (and its data load) before a tour starts by itself. */
const AUTO_START_DELAY_MS = 800;

/**
 * Owns the guided tours: which page offers one, which one is running and the
 * user's choices. A tour starts by itself the first time a logged-in user
 * opens its page, unless they turned tours off.
 */
const TourProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [prefs, setPrefs] = useState<TourPrefs>(DEFAULT_TOUR_PREFS);
  const [available, setAvailable] = useState<TourId | null>(null);
  const [active, setActive] = useState<TourId | null>(null);

  useEffect(() => setPrefs(userId ? loadTourPrefs(userId) : DEFAULT_TOUR_PREFS), [userId]);

  const update = useCallback((change: (p: TourPrefs) => TourPrefs) => {
    setPrefs((p) => {
      const next = change(p);
      if (userId) saveTourPrefs(userId, next);
      return next;
    });
  }, [userId]);

  const register = useCallback((tour: TourId) => {
    setAvailable(tour);
    return () => {
      setAvailable((a) => (a === tour ? null : a));
      setActive((a) => (a === tour ? null : a)); // leaving the page ends its tour
    };
  }, []);

  useEffect(() => {
    if (!userId || !available || active || !shouldAutoStart(prefs, available)) return;
    const timer = setTimeout(() => setActive(available), AUTO_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [userId, available, active, prefs]);

  const close = useCallback((dontShowAgain: boolean) => {
    if (active) update((p) => closeTour(p, active, dontShowAgain));
    setActive(null);
  }, [active, update]);

  const api = useMemo<TourApi>(() => ({
    available,
    enabled: !prefs.disabled,
    start: setActive,
    setEnabled: (on) => update((p) => ({ ...p, disabled: !on })),
    resetSeen: () => update(() => DEFAULT_TOUR_PREFS),
    register,
  }), [available, prefs.disabled, update, register]);

  return (
    <TourContext.Provider value={api}>
      {children}
      {active && <Suspense fallback={null}><ProductTour key={active} tour={active} onClose={close} /></Suspense>}
    </TourContext.Provider>
  );
};

export default TourProvider;
