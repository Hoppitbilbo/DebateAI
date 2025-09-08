/**
 * @file Renders a page-flip animation effect.
 * @remarks This component listens to the `AnimationContext` and displays a CSS-based
 * page-flip animation when the `isAnimating` state is true. It is used to create
 * a smooth transition between pages.
 */

import React from 'react';
import { useAnimation } from '@/context/AnimationContext';

/**
 * @function PageFlipAnimation
 * @description A component that renders a full-screen page-flip animation.
 * Its visibility is controlled by the `AnimationContext`.
 * @returns {JSX.Element | null} The rendered animation element, or null if not animating.
 */
const PageFlipAnimation: React.FC = () => {
  const { isAnimating } = useAnimation();

  if (!isAnimating) return null;

  return (
    <div className="page-flip-container">
      <div className="page-flip">
        <div className="page-flip-front"></div>
        <div className="page-flip-back"></div>
      </div>
    </div>
  );
};

export default PageFlipAnimation;
