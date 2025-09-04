import React from 'react';
import { Zap, BookOpen, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Slide1Intro = () => {
  const { t } = useTranslation();

  return (
    <div className="text-center p-6 animate-fadeIn">
      <div className="flex justify-center mb-6">
        <Zap className="h-16 w-16 text-yellow-400 animate-pulse" />
      </div>
      <h2 className="text-3xl font-bold text-sky-300 mb-4">
        {t('teacherGuide.slide1.title')}
      </h2>
      <p className="text-lg text-slate-300 mb-6">
        {t('teacherGuide.slide1.subtitle')}
      </p>
      <div className="grid md:grid-cols-2 gap-6 text-left">
        <div className="bg-slate-700 p-4 rounded-lg shadow-lg hover:shadow-sky-500/30 transition-shadow duration-300">
          <div className="flex items-center mb-2">
            <BookOpen className="h-6 w-6 text-green-400 mr-3" />
            <h3 className="text-xl font-semibold text-green-300">{t('teacherGuide.slide1.whatYouWillLearn.title')}</h3>
          </div>
          <ul className="list-disc list-inside text-slate-300 space-y-1">
            <li>{t('teacherGuide.slide1.whatYouWillLearn.item1')}</li>
            <li>{t('teacherGuide.slide1.whatYouWillLearn.item2')}</li>
            <li>{t('teacherGuide.slide1.whatYouWillLearn.item3')}</li>
            <li>{t('teacherGuide.slide1.whatYouWillLearn.item4')}</li>
          </ul>
        </div>
        <div className="bg-slate-700 p-4 rounded-lg shadow-lg hover:shadow-sky-500/30 transition-shadow duration-300">
          <div className="flex items-center mb-2">
            <Lightbulb className="h-6 w-6 text-yellow-400 mr-3" />
            <h3 className="text-xl font-semibold text-yellow-300">{t('teacherGuide.slide1.guideObjectives.title')}</h3>
          </div>
          <ul className="list-disc list-inside text-slate-300 space-y-1">
            <li>{t('teacherGuide.slide1.guideObjectives.item1')}</li>
            <li>{t('teacherGuide.slide1.guideObjectives.item2')}</li>
            <li>{t('teacherGuide.slide1.guideObjectives.item3')}</li>
            <li>{t('teacherGuide.slide1.guideObjectives.item4')}</li>
          </ul>
        </div>
      </div>
      <p className="mt-8 text-md text-sky-400 font-semibold">
        {t('teacherGuide.slide1.readyToStart')}
      </p>
    </div>
  );
};

export default Slide1Intro;
