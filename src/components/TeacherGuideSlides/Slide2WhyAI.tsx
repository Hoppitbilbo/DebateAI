import React from 'react';
import { Brain, TrendingUp, Users, Sparkles, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Slide2WhyAI = () => {
  const { t } = useTranslation();

  return (
    <div className="p-6 animate-fadeIn">
      <div className="flex items-center justify-center mb-6">
        <Brain className="h-12 w-12 text-sky-400 mr-4" />
        <h2 className="text-3xl font-bold text-sky-300 text-center">{t('teacherGuide.slide2.title')}</h2>
      </div>
      <p className="text-lg text-slate-300 mb-8 text-center">
        {t('teacherGuide.slide2.subtitle')}
      </p>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-slate-700 p-5 rounded-lg shadow-lg hover:scale-105 transition-transform duration-300">
          <div className="flex items-center mb-3">
            <TrendingUp className="h-7 w-7 text-green-400 mr-3" />
            <h3 className="text-xl font-semibold text-green-300">{t('teacherGuide.slide2.teachingEnhancement.title')}</h3>
          </div>
          <p className="text-slate-300">
            {t('teacherGuide.slide2.teachingEnhancement.description')}
          </p>
        </div>

        <div className="bg-slate-700 p-5 rounded-lg shadow-lg hover:scale-105 transition-transform duration-300">
          <div className="flex items-center mb-3">
            <Users className="h-7 w-7 text-yellow-400 mr-3" />
            <h3 className="text-xl font-semibold text-yellow-300">{t('teacherGuide.slide2.learningPersonalization.title')}</h3>
          </div>
          <p className="text-slate-300">
            {t('teacherGuide.slide2.learningPersonalization.description')}
          </p>
        </div>

        <div className="bg-slate-700 p-5 rounded-lg shadow-lg hover:scale-105 transition-transform duration-300">
          <div className="flex items-center mb-3">
            <Sparkles className="h-7 w-7 text-pink-400 mr-3" />
            <h3 className="text-xl font-semibold text-pink-300">{t('teacherGuide.slide2.futureProofSkills.title')}</h3>
          </div>
          <p className="text-slate-300">
            {t('teacherGuide.slide2.futureProofSkills.description')}
          </p>
        </div>

        <div className="bg-slate-700 p-5 rounded-lg shadow-lg hover:scale-105 transition-transform duration-300">
          <div className="flex items-center mb-3">
            <Lightbulb className="h-7 w-7 text-purple-400 mr-3" /> {/* Re-using Lightbulb, consider a different icon if available */}
            <h3 className="text-xl font-semibold text-purple-300">{t('teacherGuide.slide2.newResources.title')}</h3>
          </div>
          <p className="text-slate-300">
            {t('teacherGuide.slide2.newResources.description')}
          </p>
        </div>
      </div>

      <p className="mt-8 text-md text-sky-400 font-semibold text-center">
        {t('teacherGuide.slide2.conclusion')}
      </p>
    </div>
  );
};

export default Slide2WhyAI;
