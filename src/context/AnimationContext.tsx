/**
 * @file Provides a React context for managing page transition animations.
 * @remarks This context allows components to trigger a global animation state, which is used
 * to apply CSS animations during page navigation or other transitions.
 */

import React, { createContext, useContext, useState } from 'react';

/**
 * @interface AnimationContextType
 * @description Defines the shape of the animation context.
 * @property {boolean} isAnimating - A boolean indicating if an animation is currently active.
 * @property {(callback: () => void) => void} startAnimation - A function to trigger the animation and execute a callback after a delay.
 */
interface AnimationContextType {
  isAnimating: boolean;
  startAnimation: (callback: () => void) => void;
}

/**
 * @description The React context for managing animation state.
 */
const AnimationContext = createContext<AnimationContextType>({
  isAnimating: false,
  startAnimation: () => {},
});

/**
 * @function AnimationProvider
 * @description The provider component that makes the animation context available to its children.
 * @param {object} props - The props for the component.
 * @param {React.ReactNode} props.children - The child components to be rendered within the provider.
 * @returns {JSX.Element} The rendered animation provider.
 */
export const AnimationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  /**
   * @function startAnimation
   * @description Sets the animation state to true, executes a callback after a delay,
   * and then resets the animation state.
   * @param {() => void} callback - The function to be called after the animation starts (e.g., navigation).
   */
  const startAnimation = (callback: () => void) => {
    setIsAnimating(true);
    
    setTimeout(() => {
      callback();
      
      setTimeout(() => {
        setIsAnimating(false);
      }, 1000);
    }, 500);
  };

  return (
    <AnimationContext.Provider value={{ isAnimating, startAnimation }}>
      {children}
    </AnimationContext.Provider>
  );
};

/**
 * @function useAnimation
 * @description A custom hook for accessing the animation context.
 * @returns {AnimationContextType} The animation context.
 */
export const useAnimation = () => useContext(AnimationContext);
