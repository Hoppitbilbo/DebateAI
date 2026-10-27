import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useMemo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMorphClick } from "@/features/navigation/morph";

// The Icons8 loop runs a touch slower than drawn: calmer next to the copy.
const HERO_PLAYBACK_RATE = 0.8;

const HeroIllustration = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Slow the loop down, pause it off screen and keep it still for reduced motion.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = HERO_PLAYBACK_RATE;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
      return;
    }
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void video.play().catch(() => undefined);
      else video.pause();
    });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="hero-art relative mx-auto aspect-square w-full max-w-[460px]">
      <div aria-hidden="true" className="absolute inset-[10%] rounded-[46%_54%_52%_48%/55%_45%_55%_45%] bg-sun-light" />
      <video
        ref={videoRef}
        className="illustration relative"
        width={640}
        height={640}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster="/illustrations/hero-poster.webp"
        aria-hidden="true"
      >
        <source src="/illustrations/hero.mp4" type="video/mp4; codecs=hvc1" />
        <source src="/illustrations/hero.webm" type="video/webm" />
      </video>
    </div>
  );
};

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

  return (
    <div className="relative bg-background">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="text-center lg:text-left">
          <h1 className={`text-4xl tracking-tight text-foreground sm:text-5xl lg:text-6xl reveal-animation ${isLoaded ? 'revealed' : ''}`}>
            <span className="block">{t('hero.title')}</span>
            <span className="mt-1 block italic font-medium text-education"><span className="ink-underline">{t('hero.subtitle')}</span></span>
          </h1>
          <p className={`mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0 reveal-animation reveal-delay-1 ${isLoaded ? 'revealed' : ''}`}>
            {t('hero.description')}
          </p>
          <div className={`mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start reveal-animation reveal-delay-2 ${isLoaded ? 'revealed' : ''}`}>
            <Button asChild size="lg" className="bg-education hover:bg-education/90 text-education-dark">
              <Link to="/apps" onClick={morph("/apps")}>{t('hero.tryApps')}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-transparent text-foreground hover:bg-sun-light">
              <Link to={randomApp.path} onClick={morph(randomApp.path)}>{randomApp.name}</Link>
            </Button>
          </div>
        </div>
        <div className={`reveal-animation reveal-delay-1 ${isLoaded ? 'revealed' : ''}`}>
          <HeroIllustration />
        </div>
      </div>

    </div>
  );
};
export default HeroSection;
