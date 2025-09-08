/**
 * @file Renders the main landing page (homepage) of the application.
 * @remarks This page is composed of several sections: a hero section, a features section,
 * a call-to-action for the teacher's guide, and a section about the project's social purpose.
 * It uses the `useScrollReveal` hook to animate sections as they enter the viewport.
 */

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { School, Users } from "lucide-react";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { useTranslation } from "react-i18next";

/**
 * @function Index
 * @description The main component for the application's homepage.
 * It assembles the different sections of the landing page and applies scroll-reveal animations.
 * @returns {JSX.Element} The rendered homepage.
 */
const Index = () => {
  const { t } = useTranslation();
  
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
        
        <div ref={teacherGuideReveal.ref as React.RefObject<HTMLDivElement>}
          className={`bg-white dark:bg-gray-900 py-12 reveal-from-left ${teacherGuideReveal.isVisible ? 'revealed' : ''}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <div className="flex justify-center mb-4">
                <School className="h-12 w-12 text-education" />
              </div>
              <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                {t('homepage.teacherGuide.title')}
              </h2>
              <p className="mt-4 text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                {t('homepage.teacherGuide.description')}
              </p>
              <div className="mt-8">
                <Link to="/teacher-guide">
                  <Button className="bg-education hover:bg-education-dark text-white">
                    {t('homepage.teacherGuide.button')}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div ref={socialPurposeReveal.ref as React.RefObject<HTMLDivElement>}
          className={`bg-education-light dark:bg-gray-800 py-12 reveal-from-right ${socialPurposeReveal.isVisible ? 'revealed' : ''}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <div className="flex justify-center mb-4">
                <Users className="h-12 w-12 text-education" />
              </div>
              <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                {t('homepage.socialPurpose.title')}
              </h2>
              <p className="mt-4 text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                {t('homepage.socialPurpose.description')}
              </p>
              <div className="mt-8 space-y-4 sm:space-y-0 sm:flex sm:justify-center sm:space-x-4">
                <Link to="/apps">
                  <Button className="bg-education hover:bg-education-dark text-white w-full sm:w-auto">
                    {t('homepage.socialPurpose.exploreButton')}
                  </Button>
                </Link>
                <Link to="/about">
                  <Button variant="outline" className="border-education text-education hover:bg-education hover:text-white w-full sm:w-auto">
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
