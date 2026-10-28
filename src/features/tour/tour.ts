import { createContext, useContext, useEffect } from "react";
import type { TourId } from "./tours";

// The guided tours shared by the whole app (provided by TourProvider).

export interface TourApi {
  /** The tour of the page on screen, if it has one. */
  available: TourId | null;
  /** Whether tours start by themselves on a first visit. */
  enabled: boolean;
  start: (tour: TourId) => void;
  setEnabled: (on: boolean) => void;
  /** Shows every tour again on the next visit of its page. */
  resetSeen: () => void;
  /** Called by a page to offer its tour; returns the cleanup. */
  register: (tour: TourId) => () => void;
}

const noop = () => {};

/** Used outside the provider (e.g. in tests): no tour ever shows. */
const NO_TOURS: TourApi = { available: null, enabled: false, start: noop, setEnabled: noop, resetSeen: noop, register: () => noop };

export const TourContext = createContext<TourApi>(NO_TOURS);

export const useTour = () => useContext(TourContext);

/** Offers `tour` while the page is on screen; it starts by itself on a first visit. */
export const usePageTour = (tour: TourId) => {
  const { register } = useTour();
  useEffect(() => register(tour), [register, tour]);
};
