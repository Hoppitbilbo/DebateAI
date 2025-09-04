
import React from 'react';
import { useAnimation } from '@/context/AnimationContext';

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
