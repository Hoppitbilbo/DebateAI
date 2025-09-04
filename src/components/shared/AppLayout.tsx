import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onReset?: () => void;
  showBackButton?: boolean;
  className?: string;
}

const AppLayout: React.FC<AppLayoutProps> = ({
  title,
  subtitle,
  children,
  onReset,
  showBackButton = true,
  className = ''
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className={`min-h-screen bg-gradient-to-br from-education-light/10 to-education/10 ${className}`}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <Card className="mb-6 p-6 bg-white/80 backdrop-blur-sm border-education/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {showBackButton && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/apps')}
                  className="border-education/30 text-education hover:bg-education/10"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('common.backToApps')}
                </Button>
              )}
              <div>
                <h1 className="text-2xl font-heading font-bold text-education-dark">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-sm text-education-muted mt-1">{subtitle}</p>
                )}
              </div>
            </div>
            
            {onReset && (
              <Button
                variant="outline"
                size="sm"
                onClick={onReset}
                className="border-education/30 text-education hover:bg-education/10"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {t('common.reset')}
              </Button>
            )}
          </div>
        </Card>

        {/* Main Content */}
        <div className="space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
