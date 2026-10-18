
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { School, Users, BookOpen } from "lucide-react";
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
        
        <section ref={featuresReveal.ref as React.RefObject<HTMLElement>} 
          className={`reveal-animation ${featuresReveal.isVisible ? 'revealed' : ''}`}>
          <FeaturesSection />
        </section>
        
        {/* Teacher's Guide Section */}
        <div ref={teacherGuideReveal.ref as React.RefObject<HTMLDivElement>}
          className={`bg-background py-16 reveal-from-left ${teacherGuideReveal.isVisible ? 'revealed' : ''}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <div className="flex justify-center mb-4">
                <School className="h-12 w-12 text-education" />
              </div>
              <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">
                {t('homepage.teacherGuide.title')}
              </h2>
              <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto">
                {t('homepage.teacherGuide.description')}
              </p>
              <div className="mt-8">
                <Link to="/teacher-guide">
                  <Button className="bg-education hover:bg-education/90 text-education-dark">
                    {t('homepage.teacherGuide.button')}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Social Purpose Section */}
        <div ref={socialPurposeReveal.ref as React.RefObject<HTMLDivElement>}
          className={`bg-secondary border-t border-border/60 py-16 reveal-from-right ${socialPurposeReveal.isVisible ? 'revealed' : ''}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <div className="flex justify-center mb-4">
                <Users className="h-12 w-12 text-education" />
              </div>
              <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">
                {t('homepage.socialPurpose.title')}
              </h2>
              <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto">
                {t('homepage.socialPurpose.description')}
              </p>
              <div className="mt-8 space-y-4 sm:space-y-0 sm:flex sm:justify-center sm:space-x-4">
                <Link to="/apps" className="block sm:inline-block">
                  <Button className="bg-education hover:bg-education/90 text-education-dark w-full sm:w-auto">
                    {t('homepage.socialPurpose.exploreButton')}
                  </Button>
                </Link>
                <Link to="/tutorials" className="block sm:inline-block">
                  <Button variant="outline" className="border-education bg-transparent text-education-light hover:bg-education hover:text-education-dark w-full sm:w-auto">
                    <BookOpen className="w-4 h-4 mr-2" />
                    {t('platform.nav.tutorials')}
                  </Button>
                </Link>
                <Link to="/about" className="block sm:inline-block">
                  <Button variant="outline" className="border-education bg-transparent text-education-light hover:bg-education hover:text-education-dark w-full sm:w-auto">
                    {t('homepage.socialPurpose.learnMoreButton')}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
