import React from 'react';
import { Search, Bot, Users, SchoolIcon, Lightbulb, TestTube2 } from 'lucide-react'; // Added TestTube2
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useTranslation, Trans } from 'react-i18next';

const Slide3Scenarios = () => {
  const { t } = useTranslation();

  return (
    <div className="p-2 md:p-6 animate-fadeIn">
      <div className="flex items-center justify-center mb-6">
        <TestTube2 className="h-12 w-12 text-education mr-4" />
        <h2 className="text-3xl font-bold text-education-light text-center">{t('teacherGuide.slide3.title')}</h2>
      </div>
      <p className="text-lg text-foreground/85 mb-8 text-center">
        {t('teacherGuide.slide3.subtitle')}
      </p>

      <Accordion type="single" collapsible className="w-full space-y-4">
        <AccordionItem value="activity-1" className="bg-accent/50 rounded-lg shadow-md">
          <AccordionTrigger className="text-xl font-semibold text-education-light hover:text-education p-4">
            <div className="flex items-center gap-3">
              <Search className="h-6 w-6" />
              {t('teacherGuide.slide3.activity1.title')}
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-foreground/85 space-y-3 p-4 pt-2">
            <p className="font-semibold text-education-light">
              <Trans i18nKey="teacherGuide.slide3.activity1.objective" components={{ strong: <strong /> }} />
            </p>
            <div className="space-y-2">
              <p className="font-medium text-foreground">
                <Trans i18nKey="teacherGuide.slide3.activity1.procedureTitle" components={{ strong: <strong /> }} />
              </p>
              <ul className="list-disc pl-6 space-y-1 text-foreground/85">
                <li>{t('teacherGuide.slide3.activity1.procedure.item1')}</li>
                <li>{t('teacherGuide.slide3.activity1.procedure.item2')}</li>
                <li>{t('teacherGuide.slide3.activity1.procedure.item3')}</li>
                <li>{t('teacherGuide.slide3.activity1.procedure.item4')}</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="activity-2" className="bg-accent/50 rounded-lg shadow-md">
          <AccordionTrigger className="text-xl font-semibold text-education-light hover:text-education p-4">
            <div className="flex items-center gap-3">
              <Bot className="h-6 w-6" />
              {t('teacherGuide.slide3.activity2.title')}
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-foreground/85 space-y-3 p-4 pt-2">
            <p className="font-semibold text-education-light">
              <Trans i18nKey="teacherGuide.slide3.activity2.objective" components={{ strong: <strong /> }} />
            </p>
            <div className="space-y-2">
              <p className="font-medium text-foreground">
                <Trans i18nKey="teacherGuide.slide3.activity2.procedureTitle" components={{ strong: <strong /> }} />
              </p>
              <ul className="list-disc pl-6 space-y-1 text-foreground/85">
                <li>{t('teacherGuide.slide3.activity2.procedure.item1')}</li>
                <li>{t('teacherGuide.slide3.activity2.procedure.item2')}</li>
                <li>{t('teacherGuide.slide3.activity2.procedure.item3')}</li>
                <li>{t('teacherGuide.slide3.activity2.procedure.item4')}</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="activity-3" className="bg-accent/50 rounded-lg shadow-md">
          <AccordionTrigger className="text-xl font-semibold text-education-light hover:text-education p-4">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6" />
              {t('teacherGuide.slide3.activity3.title')}
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-foreground/85 space-y-3 p-4 pt-2">
            <p className="font-semibold text-education-light">
              <Trans i18nKey="teacherGuide.slide3.activity3.objective" components={{ strong: <strong /> }} />
            </p>
            <div className="space-y-2">
              <p className="font-medium text-foreground">
                <Trans i18nKey="teacherGuide.slide3.activity3.procedureTitle" components={{ strong: <strong /> }} />
              </p>
              <ul className="list-disc pl-6 space-y-1 text-foreground/85">
                <li>{t('teacherGuide.slide3.activity3.procedure.item1')}</li>
                <li>{t('teacherGuide.slide3.activity3.procedure.item2')}</li>
                <li>{t('teacherGuide.slide3.activity3.procedure.item3')}</li>
                <li>{t('teacherGuide.slide3.activity3.procedure.item4')}</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="activity-4" className="bg-accent/50 rounded-lg shadow-md">
          <AccordionTrigger className="text-xl font-semibold text-fuchsia-300 hover:text-fuchsia-200 p-4">
            <div className="flex items-center gap-3">
              <Lightbulb className="h-6 w-6" /> {/* Changed from SchoolIcon to Lightbulb for consistency */}
              {t('teacherGuide.slide3.activity4.title')}
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-foreground/85 space-y-3 p-4 pt-2">
            <p className="font-semibold text-fuchsia-200">
              <Trans i18nKey="teacherGuide.slide3.activity4.objective" components={{ strong: <strong /> }} />
            </p>
            <div className="space-y-2">
              <p className="font-medium text-foreground">
                <Trans i18nKey="teacherGuide.slide3.activity4.procedureTitle" components={{ strong: <strong /> }} />
              </p>
              <ul className="list-disc pl-6 space-y-1 text-foreground/85">
                <li>{t('teacherGuide.slide3.activity4.procedure.item1')}</li>
                <li>{t('teacherGuide.slide3.activity4.procedure.item2')}</li>
                <li>{t('teacherGuide.slide3.activity4.procedure.item3')}</li>
                <li>{t('teacherGuide.slide3.activity4.procedure.item4')}</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      <p className="mt-8 text-md text-education font-semibold text-center">
        {t('teacherGuide.slide3.conclusion')}
      </p>
    </div>
  );
};

export default Slide3Scenarios;
