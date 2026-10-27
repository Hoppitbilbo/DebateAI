
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import DebateStory from "@/components/DebateStory";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { useTranslation } from "react-i18next";

const Index = () => {
  const { t } = useTranslation();
  
  // Create scroll reveal hooks for each section
  const heroReveal = useScrollReveal();
  const featuresReveal = useScrollReveal({ threshold: 0.15 });
  const teacherGuideReveal = useScrollReveal({ threshold: 0.15 });
  const socialPurposeReveal = useScrollReveal({ threshold: 0.15 });

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-1">
        <section ref={heroReveal.ref as React.RefObject<HTMLElement>} 
          className={`${heroReveal.isVisible ? 'revealed' : ''}`}>
          <HeroSection />
        </section>

        <DebateStory />
        
        <section ref={featuresReveal.ref as React.RefObject<HTMLElement>} 
          className={`reveal-animation ${featuresReveal.isVisible ? 'revealed' : ''}`}>
          <FeaturesSection />
        </section>
        
        {/* Teacher's Guide Section */}
        <div ref={teacherGuideReveal.ref as React.RefObject<HTMLDivElement>}
          className={`bg-background py-16 sm:py-24 reveal-from-left ${teacherGuideReveal.isVisible ? 'revealed' : ''}`}>
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 md:grid-cols-[minmax(0,320px)_1fr] lg:gap-16 lg:px-8">
            <img src="/illustrations/teacher.webp" alt="" width={720} height={720} loading="lazy" decoding="async"
              className="illustration mx-auto max-w-[240px] md:max-w-[320px]" />
            <div className="text-center md:text-left">
              <h2 className="text-3xl text-foreground sm:text-4xl">
                {t('homepage.teacherGuide.title')}
              </h2>
              <p className="mt-4 max-w-2xl text-lg text-muted-foreground mx-auto md:mx-0">
                {t('homepage.teacherGuide.description')}
              </p>
              <div className="mt-8">
                <Button asChild className="bg-education hover:bg-education/90 text-education-dark">
                  <Link to="/teacher-guide">{t('homepage.teacherGuide.button')}</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Social Purpose Section */}
        <div ref={socialPurposeReveal.ref as React.RefObject<HTMLDivElement>}
          className={`bg-secondary border-t border-border py-16 sm:py-24 reveal-from-right ${socialPurposeReveal.isVisible ? 'revealed' : ''}`}>
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 md:grid-cols-[1fr_minmax(0,320px)] lg:gap-16 lg:px-8">
            <div className="text-center md:text-left">
              <h2 className="text-3xl text-foreground sm:text-4xl">
                {t('homepage.socialPurpose.title')}
              </h2>
              <p className="mt-4 max-w-2xl text-lg text-muted-foreground mx-auto md:mx-0">
                {t('homepage.socialPurpose.description')}
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-center md:justify-start">
                <Button asChild className="bg-education hover:bg-education/90 text-education-dark">
                  <Link to="/apps">{t('homepage.socialPurpose.exploreButton')}</Link>
                </Button>
                <Button asChild variant="outline" className="bg-transparent text-foreground hover:bg-sun-light">
                  <Link to="/tutorials"><BookOpen />{t('platform.nav.tutorials')}</Link>
                </Button>
                <Button asChild variant="outline" className="bg-transparent text-foreground hover:bg-sun-light">
                  <Link to="/about">{t('homepage.socialPurpose.learnMoreButton')}</Link>
                </Button>
              </div>
            </div>
            <img src="/illustrations/community.webp" alt="" width={720} height={720} loading="lazy" decoding="async"
              className="illustration mx-auto max-w-[240px] md:max-w-[320px]" />
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
