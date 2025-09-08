/**
 * @file Renders the concluding slide for the teacher's guide.
 * @remarks This component summarizes the key takeaways from the guide and suggests next steps
 * for teachers to begin implementing the AI-powered activities in their classrooms.
 */

import React from 'react';
import { Rocket, CheckCircle, ExternalLink, Lightbulb } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';

/**
 * @function Slide5Conclusion
 * @description The final slide of the teacher's guide, which provides a summary and encourages
 * teachers to start exploring the platform's features.
 * @returns {JSX.Element} The rendered conclusion slide.
 */
const Slide5Conclusion = () => {
  const { t } = useTranslation();

  return (
    <div className="p-6 animate-fadeIn text-center">
      <div className="flex justify-center mb-6">
        <Rocket className="h-16 w-16 text-green-400 transform rotate-[-45deg] animate-bounce" />
      </div>
      <h2 className="text-3xl font-bold text-sky-300 mb-4">{t('teacherGuide.slide5.title')}</h2>
      <p className="text-lg text-slate-300 mb-8">
        {t('teacherGuide.slide5.subtitle')}
      </p>

      <div className="grid md:grid-cols-2 gap-6 mb-8 text-left">
        <div className="bg-slate-700 p-5 rounded-lg shadow-lg">
          <div className="flex items-center mb-3">
            <CheckCircle className="h-7 w-7 text-green-400 mr-3" />
            <h3 className="text-xl font-semibold text-green-300">{t('teacherGuide.slide5.keyPoints.title')}</h3>
          </div>
          <ul className="list-disc list-inside text-slate-300 space-y-1">
            <li><Trans i18nKey="teacherGuide.slide5.keyPoints.item1" components={{ strong: <strong className="text-sky-300" /> }} /></li>
            <li><Trans i18nKey="teacherGuide.slide5.keyPoints.item2" components={{ strong: <strong className="text-sky-300" /> }} /></li>
            <li><Trans i18nKey="teacherGuide.slide5.keyPoints.item3" components={{ strong: <strong className="text-sky-300" /> }} /></li>
            <li><Trans i18nKey="teacherGuide.slide5.keyPoints.item4" components={{ strong: <strong className="text-sky-300" /> }} /></li>
          </ul>
        </div>

        <div className="bg-slate-700 p-5 rounded-lg shadow-lg">
          <div className="flex items-center mb-3">
            <Lightbulb className="h-7 w-7 text-yellow-400 mr-3" />
            <h3 className="text-xl font-semibold text-yellow-300">{t('teacherGuide.slide5.nextSteps.title')}</h3>
          </div>
          <ul className="list-disc list-inside text-slate-300 space-y-1">
            <li>{t('teacherGuide.slide5.nextSteps.item1')}</li>
            <li>{t('teacherGuide.slide5.nextSteps.item2')}</li>
            <li>{t('teacherGuide.slide5.nextSteps.item3')}</li>
            <li>{t('teacherGuide.slide5.nextSteps.item4')}</li>
            <li className="flex items-center">
              <Trans i18nKey="teacherGuide.slide5.nextSteps.item5" components={{ a: <a href="#" className="ml-1 text-sky-400 hover:text-sky-300 underline flex items-center" target="_blank" rel="noopener noreferrer" />, ExternalLink: <ExternalLink size={16} className="ml-1" /> }} />
            </li>
          </ul>
        </div>
      </div>

      <p className="text-xl text-sky-400 font-semibold">
        {t('teacherGuide.slide5.conclusion')}
      </p>
    </div>
  );
};

export default Slide5Conclusion;
