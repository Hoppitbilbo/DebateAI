import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  Book, 
  Users, 
  Speech, 
  Search, 
  User, 
  MessageSquare, 
  Calendar,
  ExternalLink,
  BookOpen,
  Rocket,
  Lightbulb
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import RedditButton from '@/components/shared/RedditButton';
import AppArt from '@/components/AppArt';
import { TUTORIAL_PAGE_APPS, UPCOMING_APP } from '@/features/apps/catalog';
import { TUTORIALS } from '@/features/tutorials/tutorials';

const TutorialsPage = () => {
  const { t } = useTranslation('tutorialsPage');

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      
      <main className="flex-1 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-16 grid items-center gap-8 md:grid-cols-[1fr_minmax(0,280px)]">
            <div className="text-center md:text-left">
              <h1 className="text-4xl text-foreground sm:text-5xl lg:text-6xl mb-5">
                <span className="ink-underline">{t('title')}</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto md:mx-0">
                {t('subtitle')}
              </p>
            </div>
            <img src="/illustrations/ideas.webp" alt="" width={720} height={720} decoding="async"
              className="illustration mx-auto max-w-[200px] md:max-w-[280px]" />
          </div>

          {/* Available Tutorials */}
          <section className="mb-16">
            <h2 className="text-2xl sm:text-3xl text-foreground mb-8 flex items-center">
              <BookOpen className="mr-3 text-education" />
              {t('sections.availableTutorials.title')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {TUTORIAL_PAGE_APPS.map((app) => {
                // Only apps with teacher slides link to a tutorial from here.
                const tutorialLink = TUTORIALS[app.slug] ? app.tutorialPath : null;
                return (
                <div key={app.slug} className="group flex flex-col bg-card rounded-xl overflow-hidden border border-border">
                  <div className="bg-secondary p-6">
                    <div className="flex items-start justify-between">
                      <AppArt slug={app.slug} className="flex-1" />
                    </div>
                    <h3 className="text-xl text-foreground mb-2">{t(`sections.availableTutorials.tutorials.${app.i18nKey}.title`)}</h3>
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <p className="text-muted-foreground mb-6">{t(`sections.availableTutorials.tutorials.${app.i18nKey}.description`)}</p>
                    <div className="mt-auto flex flex-col gap-4">
                      <Button asChild className="w-full bg-education hover:bg-education/90 text-education-dark">
                        <Link to={app.path}>
                          <ExternalLink />
                          {t('sections.availableTutorials.goToAppButton')}
                        </Link>
                      </Button>
                      {tutorialLink ? (
                        <Button asChild variant="outline" className="w-full bg-transparent text-foreground hover:bg-sun-light">
                          <Link to={tutorialLink}>
                            <Book />
                            {t('sections.availableTutorials.startTutorialButton')}
                          </Link>
                        </Button>
                      ) : (
                        <Button variant="outline" disabled className="w-full">
                          <Book />
                          {t('sections.availableTutorials.tutorialComingSoonButton')}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </section>

          {/* Coming Soon */}
          <section className="mb-16">
            <h2 className="text-2xl sm:text-3xl text-foreground mb-8 flex items-center">
              <Rocket className="mr-3 text-education" />
              {t('sections.comingSoon.title')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="bg-card rounded-lg overflow-hidden border border-border opacity-75">
                <div className="bg-muted p-6">
                  <div className="flex items-start justify-between">
                    <AppArt slug={UPCOMING_APP.slug} className="flex-1" />
                    <span className="bg-secondary text-foreground text-xs font-medium px-2 py-1 rounded-full">
                      {t('sections.availableTutorials.comingSoonLabel')}
                    </span>
                  </div>
                  <h3 className="text-xl text-foreground mb-2">{t(`sections.comingSoon.${UPCOMING_APP.i18nKey}.title`)}</h3>
                </div>
                <div className="p-6">
                  <p className="text-muted-foreground mb-6">{t(`sections.comingSoon.${UPCOMING_APP.i18nKey}.description`)}</p>
                  <Button disabled className="w-full">
                    <Calendar className="w-4 h-4 mr-2" />
                    {t('sections.comingSoon.comingSoonButton')}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Additional Resources */}
          <section className="mb-16">
            <h2 className="text-2xl sm:text-3xl text-foreground mb-8 flex items-center">
              <BookOpen className="mr-3 text-education" />
              {t('sections.additionalResources.title')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-card rounded-lg p-6 border border-border">
                <h3 className="text-xl font-semibold text-foreground mb-4">{t('sections.additionalResources.teacherGuide.title')}</h3>
                 <p className="text-muted-foreground mb-6">
                   {t('sections.additionalResources.teacherGuide.description')}
                 </p>
                <Link to="/teacher-guide">
                  <Button className="bg-education hover:bg-education/90 text-education-dark">
                    <BookOpen className="w-4 h-4 mr-2" />
                    {t('sections.additionalResources.teacherGuide.button')}
                  </Button>
                </Link>
              </div>
              <div className="bg-card rounded-lg p-6 border border-border">
                <h3 className="text-xl font-semibold text-foreground mb-4">{t('sections.additionalResources.allApps.title')}</h3>
                 <p className="text-muted-foreground mb-6">
                   {t('sections.additionalResources.allApps.description')}
                 </p>
                <Link to="/apps">
                  <Button className="bg-education hover:bg-education/90 text-education-dark">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {t('sections.additionalResources.allApps.button')}
                  </Button>
                </Link>
              </div>
              <div className="bg-card rounded-lg p-6 border border-border">
                <h3 className="text-xl font-semibold text-foreground mb-4">{t('sections.additionalResources.reddit.title')}</h3>
                 <p className="text-muted-foreground mb-6">
                   {t('sections.additionalResources.reddit.description')}
                 </p>
                <RedditButton variant="default" className="w-full" />
              </div>
            </div>
          </section>

          {/* How to Start */}
          <section className="mb-16">
            <h2 className="text-2xl sm:text-3xl text-foreground mb-8 flex items-center">
              <Rocket className="mr-3 text-education" />
              {t('sections.howToStart.title')}
            </h2>
            <div className="bg-card rounded-lg p-8 border border-border">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="bg-education rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                    <span className="text-education-dark font-bold text-lg">1</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{t('sections.howToStart.steps.step1.title')}</h3>
                   <p className="text-sm text-muted-foreground">{t('sections.howToStart.steps.step1.description')}</p>
                </div>
                <div className="text-center">
                  <div className="bg-education rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                    <span className="text-education-dark font-bold text-lg">2</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{t('sections.howToStart.steps.step2.title')}</h3>
                   <p className="text-sm text-muted-foreground">{t('sections.howToStart.steps.step2.description')}</p>
                </div>
                <div className="text-center">
                  <div className="bg-education rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                    <span className="text-education-dark font-bold text-lg">3</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{t('sections.howToStart.steps.step3.title')}</h3>
                   <p className="text-sm text-muted-foreground">{t('sections.howToStart.steps.step3.description')}</p>
                </div>
                <div className="text-center">
                  <div className="bg-education rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                    <span className="text-education-dark font-bold text-lg">4</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{t('sections.howToStart.steps.step4.title')}</h3>
                   <p className="text-sm text-muted-foreground">{t('sections.howToStart.steps.step4.description')}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Tips */}
          <section className="mb-16">
            <h2 className="text-2xl sm:text-3xl text-foreground mb-8 flex items-center">
              <Lightbulb className="mr-3 text-education" />
              {t('sections.tips.title')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-card rounded-lg p-6 border border-border">
                <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
                  <BookOpen className="w-5 h-5 mr-2" />
                  {t('sections.tips.forTeachers.title')}
                </h3>
                <p className="text-foreground">
                  {t('sections.tips.forTeachers.description')}
                </p>
              </div>
              <div className="bg-card rounded-lg p-6 border border-border">
                <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  {t('sections.tips.forStudents.title')}
                </h3>
                <p className="text-foreground">
                  {t('sections.tips.forStudents.description')}
                </p>
              </div>
              <div className="bg-card rounded-lg p-6 border border-border">
                <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  {t('sections.tips.forEveryone.title')}
                </h3>
                <p className="text-foreground">
                  {t('sections.tips.forEveryone.description')}
                </p>
              </div>
            </div>
          </section>

          {/* Footer Info */}
          <div className="text-center text-muted-foreground text-sm">
            <p>{t('footer.lastUpdate')}</p>
             <p className="mt-2">
               {t('footer.supportText')}{' '}
               <Link to="/about" className="text-education hover:text-education-light underline">
                 {t('footer.supportLink')}
               </Link>
             </p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default TutorialsPage;