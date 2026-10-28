import type { ReactNode } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Book, BookOpen, Calendar, ExternalLink, Lightbulb, Rocket, User, Users, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import RedditButton from '@/components/shared/RedditButton';
import AppArt from '@/components/AppArt';
import { TUTORIAL_PAGE_APPS, UPCOMING_APP, type OpenApp } from '@/features/apps/catalog';
import { TUTORIALS } from '@/features/tutorials/tutorials';

const HOW_TO_START_STEPS = [1, 2, 3, 4] as const;

/** Links to the rest of the site, after the tutorials (Reddit is a button of its own). */
const RESOURCES = [
  { key: 'teacherGuide', to: '/teacher-guide', icon: BookOpen },
  { key: 'allApps', to: '/apps', icon: ExternalLink },
  { key: 'reddit' },
] as const;

const TIPS: { key: string; icon: LucideIcon }[] = [
  { key: 'forTeachers', icon: BookOpen },
  { key: 'forStudents', icon: User },
  { key: 'forEveryone', icon: Users },
];

const primaryButton = 'bg-education hover:bg-education/90 text-education-dark';

const Section = ({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) => (
  <section className="mb-16">
    <h2 className="text-2xl sm:text-3xl text-foreground mb-8 flex items-center">
      <Icon className="mr-3 text-education" />
      {title}
    </h2>
    {children}
  </section>
);

/** An app with its link and, when it has teacher slides, its tutorial. */
const TutorialCard = ({ app }: { app: OpenApp }) => {
  const { t } = useTranslation('tutorialsPage');
  const tutorialLink = TUTORIALS[app.slug] ? app.tutorialPath : null;
  const text = `sections.availableTutorials.tutorials.${app.i18nKey}`;
  return (
    <div className="group flex flex-col bg-card rounded-xl overflow-hidden border border-border">
      <div className="bg-secondary p-6">
        <div className="flex items-start justify-between">
          <AppArt slug={app.slug} className="flex-1" />
        </div>
        <h3 className="text-xl text-foreground mb-2">{t(`${text}.title`)}</h3>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="text-muted-foreground mb-6">{t(`${text}.description`)}</p>
        <div className="mt-auto flex flex-col gap-4">
          <Button asChild className={`w-full ${primaryButton}`}>
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
};

const UpcomingCard = () => {
  const { t } = useTranslation('tutorialsPage');
  const text = `sections.comingSoon.${UPCOMING_APP.i18nKey}`;
  return (
    <div className="bg-card rounded-lg overflow-hidden border border-border opacity-75">
      <div className="bg-muted p-6">
        <div className="flex items-start justify-between">
          <AppArt slug={UPCOMING_APP.slug} className="flex-1" />
          <span className="bg-secondary text-foreground text-xs font-medium px-2 py-1 rounded-full">
            {t('sections.availableTutorials.comingSoonLabel')}
          </span>
        </div>
        <h3 className="text-xl text-foreground mb-2">{t(`${text}.title`)}</h3>
      </div>
      <div className="p-6">
        <p className="text-muted-foreground mb-6">{t(`${text}.description`)}</p>
        <Button disabled className="w-full">
          <Calendar className="w-4 h-4 mr-2" />
          {t('sections.comingSoon.comingSoonButton')}
        </Button>
      </div>
    </div>
  );
};

const TutorialsPage = () => {
  const { t } = useTranslation('tutorialsPage');

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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

          <Section icon={BookOpen} title={t('sections.availableTutorials.title')}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {TUTORIAL_PAGE_APPS.map((app) => <TutorialCard key={app.slug} app={app} />)}
            </div>
          </Section>

          <Section icon={Rocket} title={t('sections.comingSoon.title')}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <UpcomingCard />
            </div>
          </Section>

          <Section icon={BookOpen} title={t('sections.additionalResources.title')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {RESOURCES.map((resource) => {
                const text = `sections.additionalResources.${resource.key}`;
                return (
                  <div key={resource.key} className="bg-card rounded-lg p-6 border border-border">
                    <h3 className="text-xl font-semibold text-foreground mb-4">{t(`${text}.title`)}</h3>
                    <p className="text-muted-foreground mb-6">{t(`${text}.description`)}</p>
                    {'to' in resource ? (
                      <Button asChild className={primaryButton}>
                        <Link to={resource.to}>
                          <resource.icon className="w-4 h-4 mr-2" />
                          {t(`${text}.button`)}
                        </Link>
                      </Button>
                    ) : (
                      <RedditButton variant="default" className="w-full" />
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          <Section icon={Rocket} title={t('sections.howToStart.title')}>
            <div className="bg-card rounded-lg p-8 border border-border">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {HOW_TO_START_STEPS.map((n) => (
                  <div key={n} className="text-center">
                    <div className="bg-education rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                      <span className="text-education-dark font-bold text-lg">{n}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{t(`sections.howToStart.steps.step${n}.title`)}</h3>
                    <p className="text-sm text-muted-foreground">{t(`sections.howToStart.steps.step${n}.description`)}</p>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section icon={Lightbulb} title={t('sections.tips.title')}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {TIPS.map(({ key, icon: Icon }) => (
                <div key={key} className="bg-card rounded-lg p-6 border border-border">
                  <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center">
                    <Icon className="w-5 h-5 mr-2" />
                    {t(`sections.tips.${key}.title`)}
                  </h3>
                  <p className="text-foreground">{t(`sections.tips.${key}.description`)}</p>
                </div>
              ))}
            </div>
          </Section>

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
