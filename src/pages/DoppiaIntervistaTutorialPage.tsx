import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DoppiaIntervistaTutorial from '@/components/tutorials/DoppiaIntervistaTutorial';

const DoppiaIntervistaTutorialPage: React.FC = () => {
  const { t } = useTranslation();
  const { t: tTutorial } = useTranslation('tutorial');

  const handleBackToApps = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Button
              variant="ghost"
              onClick={handleBackToApps}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('common.backToApps')}</span>
            </Button>
            
            <div className="text-center">
              <h1 className="text-xl font-semibold text-gray-900">
                {tTutorial('doppiaIntervista.title')}
              </h1>
            </div>
            
            <div className="w-24"></div> {/* Spacer for centering */}
          </div>
        </div>
      </div>

      {/* Tutorial Content */}
      <div className="py-8">
        <DoppiaIntervistaTutorial />
      </div>
    </div>
  );
};

export default DoppiaIntervistaTutorialPage;
