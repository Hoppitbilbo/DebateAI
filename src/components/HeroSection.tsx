
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useMemo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMorphClick } from "@/features/navigation/morph";

const HeroSection = () => {
  const { t } = useTranslation();
  const morph = useMorphClick();
  
  // Define available apps to randomly choose from
  const apps = useMemo(() => [{
    path: "/apps/you-moderate",
    name: t('features.items.youModerate.name')
  }, {
    path: "/apps/doppia-intervista",
    name: t('features.items.doppiaIntervista.name')
  }, {
    path: "/apps/convinci-tu",
    name: t('features.items.convinciTu.name')
  }, {
    path: "/apps/personaggio-misterioso",
    name: t('features.items.personaggioMisterioso.name')
  }, {
    path: "/apps/impersona-tu",
    name: t('features.items.impersonaTu.name')
  }], [t]);

  // Select a random app on component render
  const randomApp = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * apps.length);
    return apps[randomIndex];
  }, [apps]);

  // Add staggered reveal animations
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    setIsLoaded(true);
  }, []);
  
  return <div className="relative bg-background overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="relative z-10 pb-8 bg-background sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
          <svg className="hidden lg:block absolute right-0 inset-y-0 h-full w-48 text-background transform translate-x-1/2" fill="currentColor" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polygon points="50,0 100,0 50,100 0,100" />
          </svg>

          <div className="relative pt-6 px-4 sm:px-6 lg:px-8"></div>

          <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
            <div className="sm:text-center lg:text-left">
              <h1 className={`text-4xl tracking-tight font-extrabold text-foreground sm:text-5xl md:text-6xl reveal-animation ${isLoaded ? 'revealed' : ''}`}>
                <span className="block">{t('hero.title')}</span>
                <span className="block text-education-light xl:inline">{t('hero.subtitle')}</span>
              </h1>
              <p className={`mt-3 text-base text-muted-foreground sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0 reveal-animation reveal-delay-1 ${isLoaded ? 'revealed' : ''}`}>
                {t('hero.description')}
              </p>
              <div className={`mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start reveal-animation reveal-delay-2 ${isLoaded ? 'revealed' : ''}`}>
                <div className="rounded-md shadow">
                  <Link to="/apps" onClick={morph("/apps")}>
                    <Button className="w-full flex items-center justify-center px-8 py-3 bg-education hover:bg-education/90 text-education-dark">
                      {t('hero.tryApps')}
                    </Button>
                  </Link>
                </div>
                <div className="mt-3 sm:mt-0 sm:ml-3">
                  <Link to={randomApp.path} onClick={morph(randomApp.path)}>
                    <Button variant="outline" className="w-full flex items-center justify-center px-8 py-3 border-education bg-transparent text-education-light hover:bg-education hover:text-education-dark">
                      {randomApp.name}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
      <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
        <div className={`w-full bg-education-dark lg:h-full flex items-center justify-center reveal-from-right ${isLoaded ? 'revealed' : ''}`}>
          <div className="p-6 max-w-md">
            <div className="chat-bubble chat-bubble-bot text-sm md:text-base">
              {t('hero.sampleChat.bot1')}
            </div>
            <div className="chat-bubble chat-bubble-user text-sm md:text-base">
              {t('hero.sampleChat.user')}
            </div>
            <div className="chat-bubble chat-bubble-bot text-sm md:text-base">
              {t('hero.sampleChat.bot2')}
            </div>
          </div>
        </div>
      </div>
    </div>;
};
export default HeroSection;
