
import React, { useState } from 'react';
import { AnimationContext } from './animation';

export const AnimationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const startAnimation = (callback: () => void) => {
    setIsAnimating(true);
    
    // Use setTimeout to allow the animation to start before navigating
    setTimeout(() => {
      callback();
      
      // Reset animation state after navigation
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
