
import { Book, School, Users, Link, User } from "lucide-react";
import { useState, useEffect } from "react";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { useTranslation } from "react-i18next";

const FeaturesSection = () => {
  const { t } = useTranslation();
  
  const features = [
    {
      name: t('features.items.wikiInterview.name'),
      description: t('features.items.wikiInterview.description'),
      icon: <Book className="h-6 w-6" />,
      link: "/apps/wiki-interview"
    },
    {
      name: t('features.items.personaggioMisterioso.name'),
      description: t('features.items.personaggioMisterioso.description'),
      icon: <Users className="h-6 w-6" />,
      link: "/apps/personaggio-misterioso"
    },
    {
      name: t('features.items.doppiaIntervista.name'),
      description: t('features.items.doppiaIntervista.description'),
      icon: <Link className="h-6 w-6" />,
      link: "/apps/doppia-intervista"
    },
    {
      name: t('features.items.convinciTu.name'),
      description: t('features.items.convinciTu.description'),
      icon: <School className="h-6 w-6" />,
      link: "/apps/convinci-tu"
    },
    {
      name: t('features.items.impersonaTu.name'),
      description: t('features.items.impersonaTu.description'),
      icon: <User className="h-6 w-6" />,
      link: "/apps/impersona-tu"
    }
  ];

  // Create individual reveal elements for features
  const headerReveal = useScrollReveal({ threshold: 0.1 });
  const featureReveals = features.map(() => 
    useScrollReveal({ threshold: 0.1 })
  );

  return (
    <div className="py-12 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div 
          ref={headerReveal.ref as React.RefObject<HTMLDivElement>}
          className={`lg:text-center reveal-animation ${headerReveal.isVisible ? 'revealed' : ''}`}
        >
          <h2 className="text-base text-education font-semibold tracking-wide uppercase">
            {t('features.title')}
          </h2>
          <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-foreground sm:text-4xl">
            {t('features.subtitle')}
          </p>
          <p className="mt-4 max-w-2xl text-xl text-muted-foreground lg:mx-auto">
            {t('features.description')}
          </p>
        </div>

        <div className="mt-10">
          <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-8">
            {features.map((feature, index) => (
              <a 
                key={feature.name} 
                href={feature.link}
                ref={featureReveals[index].ref as React.RefObject<HTMLAnchorElement>}
                className={`block group reveal-animation ${featureReveals[index].isVisible ? 'revealed' : ''} reveal-delay-${index % 3 + 1}`}
              >
                <div className="flex flex-col items-center p-6 bg-accent rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-105">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-education text-education-dark">
                    {feature.icon}
                  </div>
                  <h3 className="mt-5 text-lg leading-6 font-medium text-[#0E3542] group-hover:text-education">
                    {feature.name}
                  </h3>
                  <p className="mt-2 text-base text-muted-foreground text-center">
                    {feature.description}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeaturesSection;
