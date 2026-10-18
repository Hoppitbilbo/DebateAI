import { createContext, useContext } from "react";

// Page-flip animation shared between the app cards and the page transition.

export interface AnimationContextType {
  isAnimating: boolean;
  startAnimation: (callback: () => void) => void;
}

export const AnimationContext = createContext<AnimationContextType>({
  isAnimating: false,
  startAnimation: () => {},
});

export const useAnimation = () => useContext(AnimationContext);
