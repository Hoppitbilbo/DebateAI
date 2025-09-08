/**
 * @file Renders a slide for the teacher's guide detailing the available educational scenarios.
 * @remarks This component uses an accordion to present each activity, explaining its objective
 * and the procedure for students to follow.
 */

import React from 'react';
import { Search, Bot, Users, Lightbulb, TestTube2 } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useTranslation, Trans } from 'react-i18next';

/**
 * @function Slide3Scenarios
 * @description A slide component that outlines the various educational activities and scenarios available
 * in the application. It provides a structured overview of each activity's goals and steps.
 * @returns {JSX.Element} The rendered scenarios slide.
 */
const Slide3Scenarios = () => {
  const { t } = useTranslation();

  return (
    <div className="p-2 md:p-6 animate-fadeIn">
      <div className="flex items-center justify-center mb-6">
        <TestTube2 className="h-12 w-12 text-sky-400 mr-4" />
        <h2 className="text-3xl font-bold text-sky-300 text-center">{t('teacherGuide.slide3.title')}</h2>
      </div>
      <p className="text-lg text-slate-300 mb-8 text-center">
        {t('teacherGuide.slide3.subtitle')}
      </p>

      <Accordion type="single" collapsible className="w-full space-y-4">
        <AccordionItem value="activity-1" className="bg-slate-700/50 rounded-lg shadow-md">
          <AccordionTrigger className="text-xl font-semibold text-amber-300 hover:text-amber-200 p-4">
            <div className="flex items-center gap-3">
              <Search className="h-6 w-6" />
              {t('teacherGuide.slide3.activity1.title')}
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-slate-300 space-y-3 p-4 pt-2">
            <p className="font-semibold text-amber-200">
              <Trans i18nKey="teacherGuide.slide3.activity1.objective" components={{ strong: <strong /> }} />
            </p>
            <div className="space-y-2">
              <p className="font-medium text-slate-200">
                <Trans i18nKey="teacherGuide.slide3.activity1.procedureTitle" components={{ strong: <strong /> }} />
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-300">
                <li>{t('teacherGuide.slide3.activity1.procedure.item1')}</li>
                <li>{t('teacherGuide.slide3.activity1.procedure.item2')}</li>
                <li>{t('teacherGuide.slide3.activity1.procedure.item3')}</li>
                <li>{t('teacherGuide.slide3.activity1.procedure.item4')}</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="activity-2" className="bg-slate-700/50 rounded-lg shadow-md">
          <AccordionTrigger className="text-xl font-semibold text-lime-300 hover:text-lime-200 p-4">
            <div className="flex items-center gap-3">
              <Bot className="h-6 w-6" />
              {t('teacherGuide.slide3.activity2.title')}
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-slate-300 space-y-3 p-4 pt-2">
            <p className="font-semibold text-lime-200">
              <Trans i18nKey="teacherGuide.slide3.activity2.objective" components={{ strong: <strong /> }} />
            </p>
            <div className="space-y-2">
              <p className="font-medium text-slate-200">
                <Trans i18nKey="teacherGuide.slide3.activity2.procedureTitle" components={{ strong: <strong /> }} />
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-300">
                <li>{t('teacherGuide.slide3.activity2.procedure.item1')}</li>
                <li>{t('teacherGuide.slide3.activity2.procedure.item2')}</li>
                <li>{t('teacherGuide.slide3.activity2.procedure.item3')}</li>
                <li>{t('teacherGuide.slide3.activity2.procedure.item4')}</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="activity-3" className="bg-slate-700/50 rounded-lg shadow-md">
          <AccordionTrigger className="text-xl font-semibold text-cyan-300 hover:text-cyan-200 p-4">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6" />
              {t('teacherGuide.slide3.activity3.title')}
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-slate-300 space-y-3 p-4 pt-2">
            <p className="font-semibold text-cyan-200">
              <Trans i18nKey="teacherGuide.slide3.activity3.objective" components={{ strong: <strong /> }} />
            </p>
            <div className="space-y-2">
              <p className="font-medium text-slate-200">
                <Trans i18nKey="teacherGuide.slide3.activity3.procedureTitle" components={{ strong: <strong /> }} />
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-300">
                <li>{t('teacherGuide.slide3.activity3.procedure.item1')}</li>
                <li>{t('teacherGuide.slide3.activity3.procedure.item2')}</li>
                <li>{t('teacherGuide.slide3.activity3.procedure.item3')}</li>
                <li>{t('teacherGuide.slide3.activity3.procedure.item4')}</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="activity-4" className="bg-slate-700/50 rounded-lg shadow-md">
          <AccordionTrigger className="text-xl font-semibold text-fuchsia-300 hover:text-fuchsia-200 p-4">
            <div className="flex items-center gap-3">
              <Lightbulb className="h-6 w-6" />
              {t('teacherGuide.slide3.activity4.title')}
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-slate-300 space-y-3 p-4 pt-2">
            <p className="font-semibold text-fuchsia-200">
              <Trans i18nKey="teacherGuide.slide3.activity4.objective" components={{ strong: <strong /> }} />
            </p>
            <div className="space-y-2">
              <p className="font-medium text-slate-200">
                <Trans i18nKey="teacherGuide.slide3.activity4.procedureTitle" components={{ strong: <strong /> }} />
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-300">
                <li>{t('teacherGuide.slide3.activity4.procedure.item1')}</li>
                <li>{t('teacherGuide.slide3.activity4.procedure.item2')}</li>
                <li>{t('teacherGuide.slide3.activity4.procedure.item3')}</li>
                <li>{t('teacherGuide.slide3.activity4.procedure.item4')}</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      <p className="mt-8 text-md text-sky-400 font-semibold text-center">
        {t('teacherGuide.slide3.conclusion')}
      </p>
    </div>
  );
};

export default Slide3Scenarios;
