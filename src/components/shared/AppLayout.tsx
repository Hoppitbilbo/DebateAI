/**
 * @file Provides a consistent layout for all educational applications.
 * @remarks This component includes a header with a title, subtitle, a back button, and an optional reset button.
 * It wraps the main content of each application page.
 */

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * @interface AppLayoutProps
 * @description Defines the props for the AppLayout component.
 * @property {string} title - The main title to be displayed in the header.
 * @property {string} [subtitle] - An optional subtitle to be displayed below the title.
 * @property {React.ReactNode} children - The main content of the page to be rendered within the layout.
 * @property {() => void} [onReset] - An optional callback function to reset the application's state. If provided, a reset button is shown.
 * @property {boolean} [showBackButton=true] - Whether to show the "Back to Apps" button.
 * @property {string} [className] - Optional additional CSS classes to apply to the main layout container.
 */
interface AppLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onReset?: () => void;
  showBackButton?: boolean;
  className?: string;
}

/**
 * @function AppLayout
 * @description A reusable layout component that provides a standardized header and structure for application pages.
 * @param {AppLayoutProps} props - The props for the component.
 * @returns {JSX.Element} The rendered application layout.
 */
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
