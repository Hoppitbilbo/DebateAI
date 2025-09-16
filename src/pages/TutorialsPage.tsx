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

const TutorialsPage = () => {
  const { t } = useTranslation('tutorialsPage');

  const tutorials = [
    {
      id: 'you-moderate',
      title: t('sections.availableTutorials.tutorials.youModerate.title'),
      description: t('sections.availableTutorials.tutorials.youModerate.description'),
      icon: <Book className="h-8 w-8 text-white" />,
      appLink: '/apps/you-moderate',
      tutorialLink: '/apps/you-moderate/tutorial',
      available: true
    },
    {
      id: 'doppia-intervista',
      title: t('sections.availableTutorials.tutorials.doppiaIntervista.title'),
      description: t('sections.availableTutorials.tutorials.doppiaIntervista.description'),
      icon: <Users className="h-8 w-8 text-white" />,
      appLink: '/apps/doppia-intervista',
      tutorialLink: '/apps/doppia-intervista/tutorial',
      available: true
    },
    {
      id: 'convinci-tu',
      title: t('sections.availableTutorials.tutorials.convinciTu.title'),
      description: t('sections.availableTutorials.tutorials.convinciTu.description'),
      icon: <Speech className="h-8 w-8 text-white" />,
      appLink: '/apps/convinci-tu',
      tutorialLink: '/apps/convinci-tu/tutorial',
      available: true
    },
    {
      id: 'personaggio-misterioso',
      title: t('sections.availableTutorials.tutorials.personaggioMisterioso.title'),
      description: t('sections.availableTutorials.tutorials.personaggioMisterioso.description'),
      icon: <Search className="h-8 w-8 text-white" />,
      appLink: '/apps/personaggio-misterioso',
      tutorialLink: '/apps/personaggio-misterioso/tutorial',
      available: true
    },
    {
      id: 'impersona-tu',
      title: t('sections.availableTutorials.tutorials.impersonaTu.title'),
      description: t('sections.availableTutorials.tutorials.impersonaTu.description'),
      icon: <User className="h-8 w-8 text-white" />,
      appLink: '/apps/impersona-tu',
      tutorialLink: '/apps/impersona-tu/tutorial',
      available: true
    },
    {
      id: 'wiki-chatbot',
      title: t('sections.availableTutorials.tutorials.wikiChatbot.title'),
      description: t('sections.availableTutorials.tutorials.wikiChatbot.description'),
      icon: <MessageSquare className="h-8 w-8 text-white" />,
      appLink: '/apps/wiki-chatbot',
      tutorialLink: null,
      available: false
    }
  ];

  const comingSoon = [
    {
      id: 'prompt-engineer',
      title: t('sections.comingSoon.promptEngineer.title'),
      description: t('sections.comingSoon.promptEngineer.description'),
      icon: <Calendar className="h-8 w-8 text-white" />,
      appLink: '/apps/prompt-engineer'
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      
      <main className="flex-1 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-education-light mb-4">
              {t('title')}
            </h1>
            <p className="text-xl text-gray-200 max-w-3xl mx-auto">
              {t('subtitle')}
            </p>
          </div>

          {/* Available Tutorials */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-education-light mb-8 flex items-center">
              <BookOpen className="mr-3" />
              {t('sections.availableTutorials.title')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {tutorials.map((tutorial) => (
                <div key={tutorial.id} className="bg-card rounded-lg shadow-lg overflow-hidden border border-border">
                  <div className="bg-gradient-to-r from-education to-education-dark p-6">
                    <div className="flex items-center justify-between mb-4">
                      {tutorial.icon}
                      {tutorial.available && (
                        <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                          {t('sections.availableTutorials.availableLabel')}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{tutorial.title}</h3>
                  </div>
                  <div className="p-6">
                    <p className="text-foreground mb-6">{tutorial.description}</p>
                    <div className="space-y-3">
                      <Link to={tutorial.appLink}>
                        <Button className="w-full bg-education hover:bg-education-dark text-white">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          {t('sections.availableTutorials.goToAppButton')}
                        </Button>
                      </Link>
                      {tutorial.tutorialLink ? (
                        <Link to={tutorial.tutorialLink}>
                          <Button variant="outline" className="w-full border-education text-education hover:bg-education hover:text-white">
                            <Book className="w-4 h-4 mr-2" />
                            {t('sections.availableTutorials.startTutorialButton')}
                          </Button>
                        </Link>
                      ) : (
                        <Button variant="outline" disabled className="w-full">
                          <Book className="w-4 h-4 mr-2" />
                          {t('sections.availableTutorials.tutorialComingSoonButton')}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Coming Soon */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-education-light mb-8 flex items-center">
              <Rocket className="mr-3" />
              {t('sections.comingSoon.title')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {comingSoon.map((app) => (
                <div key={app.id} className="bg-card rounded-lg shadow-lg overflow-hidden border border-border opacity-75">
                  <div className="bg-gradient-to-r from-gray-500 to-gray-600 p-6">
                    <div className="flex items-center justify-between mb-4">
                      {app.icon}
                      <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                        {t('sections.availableTutorials.comingSoonLabel')}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{app.title}</h3>
                  </div>
                  <div className="p-6">
                    <p className="text-foreground mb-6">{app.description}</p>
                    <Button disabled className="w-full">
                      <Calendar className="w-4 h-4 mr-2" />
                      {t('sections.comingSoon.comingSoonButton')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Additional Resources */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-education-light mb-8 flex items-center">
              <BookOpen className="mr-3" />
              {t('sections.additionalResources.title')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-card rounded-lg shadow-lg p-6 border border-border">
                <h3 className="text-xl font-bold text-education-light mb-4">{t('sections.additionalResources.teacherGuide.title')}</h3>
                 <p className="text-foreground mb-6">
                   {t('sections.additionalResources.teacherGuide.description')}
                 </p>
                <Link to="/teacher-guide">
                  <Button className="bg-education hover:bg-education-dark text-white">
                    <BookOpen className="w-4 h-4 mr-2" />
                    {t('sections.additionalResources.teacherGuide.button')}
                  </Button>
                </Link>
              </div>
              <div className="bg-card rounded-lg shadow-lg p-6 border border-border">
                <h3 className="text-xl font-bold text-education-light mb-4">{t('sections.additionalResources.allApps.title')}</h3>
                 <p className="text-foreground mb-6">
                   {t('sections.additionalResources.allApps.description')}
                 </p>
                <Link to="/apps">
                  <Button className="bg-education hover:bg-education-dark text-white">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {t('sections.additionalResources.allApps.button')}
                  </Button>
                </Link>
              </div>
              <div className="bg-card rounded-lg shadow-lg p-6 border border-border">
                <h3 className="text-xl font-bold text-education-light mb-4">{t('sections.additionalResources.reddit.title')}</h3>
                 <p className="text-foreground mb-6">
                   {t('sections.additionalResources.reddit.description')}
                 </p>
                <RedditButton variant="default" className="w-full" />
              </div>
            </div>
          </section>

          {/* How to Start */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-education-light mb-8 flex items-center">
              <Rocket className="mr-3" />
              {t('sections.howToStart.title')}
            </h2>
            <div className="bg-card rounded-lg shadow-lg p-8 border border-border">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="bg-education rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-lg">1</span>
                  </div>
                  <h3 className="font-bold text-education-light mb-2">{t('sections.howToStart.steps.step1.title')}</h3>
                   <p className="text-sm text-foreground">{t('sections.howToStart.steps.step1.description')}</p>
                </div>
                <div className="text-center">
                  <div className="bg-education rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-lg">2</span>
                  </div>
                  <h3 className="font-bold text-education-light mb-2">{t('sections.howToStart.steps.step2.title')}</h3>
                   <p className="text-sm text-foreground">{t('sections.howToStart.steps.step2.description')}</p>
                </div>
                <div className="text-center">
                  <div className="bg-education rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-lg">3</span>
                  </div>
                  <h3 className="font-bold text-education-light mb-2">{t('sections.howToStart.steps.step3.title')}</h3>
                   <p className="text-sm text-foreground">{t('sections.howToStart.steps.step3.description')}</p>
                </div>
                <div className="text-center">
                  <div className="bg-education rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-lg">4</span>
                  </div>
                  <h3 className="font-bold text-education-light mb-2">{t('sections.howToStart.steps.step4.title')}</h3>
                   <p className="text-sm text-foreground">{t('sections.howToStart.steps.step4.description')}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Tips */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-education-light mb-8 flex items-center">
              <Lightbulb className="mr-3" />
              {t('sections.tips.title')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-card rounded-lg shadow-lg p-6 border border-border">
                <h3 className="font-bold text-education-light mb-4 flex items-center">
                  <BookOpen className="w-5 h-5 mr-2" />
                  {t('sections.tips.forTeachers.title')}
                </h3>
                <p className="text-foreground">
                  {t('sections.tips.forTeachers.description')}
                </p>
              </div>
              <div className="bg-card rounded-lg shadow-lg p-6 border border-border">
                <h3 className="font-bold text-education-light mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  {t('sections.tips.forStudents.title')}
                </h3>
                <p className="text-foreground">
                  {t('sections.tips.forStudents.description')}
                </p>
              </div>
              <div className="bg-card rounded-lg shadow-lg p-6 border border-border">
                <h3 className="font-bold text-education-light mb-4 flex items-center">
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
          <div className="text-center text-gray-400 text-sm">
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