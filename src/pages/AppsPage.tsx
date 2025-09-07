/**
 * @file Renders the main page that displays all available educational applications.
 * @remarks This page serves as a hub or dashboard, showing a grid of `AppCard` components,
 * each representing a different interactive learning activity.
 */

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AppCard from "@/components/AppCard";
import { Book, Search, Calendar, MessageSquare, Users, Speech, User } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * @function AppsPage
 * @description The component for the main applications dashboard page.
 * It fetches translated content and renders a list of available apps.
 * @returns {JSX.Element} The rendered applications page.
 */
const AppsPage = () => {
  const { t } = useTranslation();
  
  const apps = [
    {
      title: t('appsPage.appCards.wikiInterview.title'),
      description: t('appsPage.appCards.wikiInterview.description'),
      icon: <Book className="h-12 w-12 text-white" />,
      link: "/apps/wiki-interview",
      isNew: true,
    },
    {
      title: t('appsPage.appCards.doppiaIntervista.title'),
      description: t('appsPage.appCards.doppiaIntervista.description'),
      icon: <Users className="h-12 w-12 text-white" />,
      link: "/apps/doppia-intervista",
      isNew: true,
    },
    {
      title: t('appsPage.appCards.wikiChatbot.title'),
      description: t('appsPage.appCards.wikiChatbot.description'),
      icon: <MessageSquare className="h-12 w-12 text-white" />,
      link: "/apps/wiki-chatbot",
      isNew: true,
    },
    {
      title: t('appsPage.appCards.personaggioMisterioso.title'),
      description: t('appsPage.appCards.personaggioMisterioso.description'),
      icon: <Search className="h-12 w-12 text-white" />,
      link: "/apps/personaggio-misterioso",
      isNew: true,
    },
    {
      title: t('appsPage.appCards.promptEngineer.title'),
      description: t('appsPage.appCards.promptEngineer.description'),
      icon: <Calendar className="h-12 w-12 text-white" />,
      link: "/apps/prompt-engineer",
      isComingSoon: true,
    },
    {
      title: t('appsPage.appCards.convinciTu.title'),
      description: t('appsPage.appCards.convinciTu.description'),
      icon: <Speech className="h-12 w-12 text-white" />,
      link: "/apps/convinci-tu",
      isNew: true,
    },
    {
      title: t('appsPage.appCards.impersonaTu.title'),
      description: t('appsPage.appCards.impersonaTu.description'),
      icon: <User className="h-12 w-12 text-white" />,
      link: "/apps/impersona-tu",
      isNew: true,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen animate-fade-in">
      <Navbar />
      
      <main className="flex-1 py-12 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-extrabold text-education-light sm:text-4xl">
              {t('appsPage.title')}
            </h1>
            <p className="mt-3 text-xl text-gray-200">
              {t('appsPage.subtitle')}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {apps.map((app) => (
              <AppCard
                key={app.title}
                title={app.title}
                description={app.description}
                icon={app.icon}
                link={app.link}
                isNew={app.isNew}
                isComingSoon={app.isComingSoon}
              />
            ))}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default AppsPage;
