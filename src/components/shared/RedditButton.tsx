import React from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface RedditButtonProps {
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

const RedditButton: React.FC<RedditButtonProps> = ({ 
  variant = 'default', 
  size = 'default',
  className = ''
}) => {
  const { t } = useTranslation();

  const handleRedditClick = () => {
    window.open('https://www.reddit.com/r/AIDebatExperiences/', '_blank', 'noopener,noreferrer');
  };

  return (
    <Button
      onClick={handleRedditClick}
      variant={variant}
      size={size}
      className={`h-auto min-h-10 max-w-full gap-2 whitespace-normal py-2 text-left leading-snug bg-orange-600 hover:bg-orange-700 text-white border-orange-600 hover:border-orange-700 ${className}`}
    >
      <img 
        src="/reddit-logo.svg" 
        alt="Reddit" 
        className="w-5 h-5 shrink-0" 
        style={{ filter: 'brightness(0) invert(1)' }}
      />
      <span className="min-w-0">{t('common.reddit.teachersShare')}</span>
      <ExternalLink className="w-4 h-4 shrink-0" />
    </Button>
  );
};

export default RedditButton;