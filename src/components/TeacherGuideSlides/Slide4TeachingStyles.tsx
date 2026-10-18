import React from 'react';
import { Zap, Users, Puzzle, FlaskConical, MessageSquareHeart } from 'lucide-react'; // Added MessageSquareHeart
import { useTranslation } from 'react-i18next';

const Slide4TeachingStyles = () => {
  const { t } = useTranslation();

  return (
    <div className="p-2 md:p-6 animate-fadeIn">
      <div className="flex items-center justify-center mb-6">
        <Zap className="h-12 w-12 text-education mr-4" />
        <h2 className="text-3xl font-bold text-education-light text-center">{t('teacherGuide.slide4.title')}</h2>
      </div>
      <p className="text-lg text-foreground/85 mb-8 text-center">
        {t('teacherGuide.slide4.subtitle')}
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-accent/70 p-5 rounded-lg shadow-xl hover:shadow-green-500/30 transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center mb-3">
            <Users className="h-7 w-7 text-green-400 mr-3" />
            <h3 className="text-xl font-semibold text-green-300">{t('teacherGuide.slide4.personalizedLearning.title')}</h3>
          </div>
          <p className="text-foreground/85">
            {t('teacherGuide.slide4.personalizedLearning.description')}
          </p>
        </div>

        <div className="bg-accent/70 p-5 rounded-lg shadow-xl hover:shadow-yellow-500/30 transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center mb-3">
            <Puzzle className="h-7 w-7 text-yellow-400 mr-3" />
            <h3 className="text-xl font-semibold text-yellow-300">{t('teacherGuide.slide4.problemBasedLearning.title')}</h3>
          </div>
          <p className="text-foreground/85">
            {t('teacherGuide.slide4.problemBasedLearning.description')}
          </p>
        </div>

        <div className="bg-accent/70 p-5 rounded-lg shadow-xl hover:shadow-pink-500/30 transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center mb-3">
            <FlaskConical className="h-7 w-7 text-pink-400 mr-3" />
            <h3 className="text-xl font-semibold text-pink-300">{t('teacherGuide.slide4.inquiryBasedLearning.title')}</h3>
          </div>
          <p className="text-foreground/85">
            {t('teacherGuide.slide4.inquiryBasedLearning.description')}
          </p>
        </div>

        <div className="bg-accent/70 p-5 rounded-lg shadow-xl hover:shadow-purple-500/30 transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center mb-3">
            <MessageSquareHeart className="h-7 w-7 text-purple-400 mr-3" />
            <h3 className="text-xl font-semibold text-purple-300">{t('teacherGuide.slide4.immediateFeedback.title')}</h3>
          </div>
          <p className="text-foreground/85">
            {t('teacherGuide.slide4.immediateFeedback.description')}
          </p>
        </div>
      </div>

      <p className="mt-8 text-md text-education font-semibold text-center">
        {t('teacherGuide.slide4.conclusion')}
      </p>
    </div>
  );
};

export default Slide4TeachingStyles;
