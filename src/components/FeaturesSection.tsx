
import AppArt from "@/components/AppArt";
import { appArtSlug } from "@/lib/appArt";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { appMorph, useMorphClick } from "@/features/navigation/morph";

const FeaturesSection = () => {
  const { t } = useTranslation();
  const morph = useMorphClick();
  
  const features = [
    {
      name: t('features.items.youModerate.name'),
      description: t('features.items.youModerate.description'),
      link: "/apps/you-moderate"
    },
    {
      name: t('features.items.personaggioMisterioso.name'),
      description: t('features.items.personaggioMisterioso.description'),
      link: "/apps/personaggio-misterioso"
    },
    {
      name: t('features.items.doppiaIntervista.name'),
      description: t('features.items.doppiaIntervista.description'),
      link: "/apps/doppia-intervista"
    },
    {
      name: t('features.items.convinciTu.name'),
      description: t('features.items.convinciTu.description'),
      link: "/apps/convinci-tu"
    },
    {
      name: t('features.items.impersonaTu.name'),
      description: t('features.items.impersonaTu.description'),
      link: "/apps/impersona-tu"
    }
  ];

  // Create individual reveal elements for features
  const headerReveal = useScrollReveal({ threshold: 0.1 });

  return (
    <div className="py-16 sm:py-24 bg-secondary border-y border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div 
          ref={headerReveal.ref as React.RefObject<HTMLDivElement>}
          className={`lg:text-center reveal-animation ${headerReveal.isVisible ? 'revealed' : ''}`}
        >
          <h2 className="font-body text-sm font-medium uppercase tracking-[0.14em] text-education">
            {t('features.title')}
          </h2>
          <p className="mt-3 font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t('features.subtitle')}
          </p>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground lg:mx-auto">
            {t('features.description')}
          </p>
        </div>

        <div className="mt-10">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <RouterLink
                key={feature.name}
                to={feature.link}
                onClick={morph(feature.link)}
                className={`block h-full group reveal-animation revealed reveal-delay-${index % 3 + 1}`}
              >
                <div
                  className="flex h-full flex-col items-start p-6 bg-card border border-border rounded-xl transition-[transform,box-shadow,border-color] duration-200 group-hover:-translate-y-1 group-hover:border-foreground/60 group-hover:shadow-[4px_4px_0_0_hsl(var(--foreground))]"
                  {...appMorph(feature.link, "card")}
                >
                  <AppArt slug={appArtSlug(feature.link)} className="w-full" />
                  <h3
                    className="mt-3 text-xl font-semibold text-foreground group-hover:text-education"
                    {...appMorph(feature.link, "title")}
                  >
                    {feature.name}
                  </h3>
                  <p className="mt-2 text-base text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </RouterLink>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeaturesSection;
