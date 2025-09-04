import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Handshake } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const AboutPage = () => {
  const { t } = useTranslation();

  return <div className="flex flex-col min-h-screen">
      <Navbar />
      
      <main className="flex-1 py-12 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl mb-6 text-center">
            {t('aboutPage.title')}
          </h1>
          
          <div className="prose dark:prose-invert max-w-none bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-education mb-4">{t('aboutPage.section1.title')}</h2>
            <p className="mb-6 text-slate-800">
              {t('aboutPage.section1.content')}
            </p>
            
            <h2 className="text-2xl font-bold text-education mb-4">{t('aboutPage.section2.title')}</h2>
            <p className="mb-6 font-normal text-slate-800">
              {t('aboutPage.section2.content')}
            </p>
            
            <h2 className="text-2xl font-bold text-education mb-4">{t('aboutPage.section3.title')}</h2>
            <p className="mb-6 text-slate-800">
              {t('aboutPage.section3.content')}
            </p>
            
            <h2 className="text-2xl font-bold text-education mb-4">{t('aboutPage.section4.title')}</h2>
            <p className="mb-6 text-slate-800">
              {t('aboutPage.section4.content')}
            </p>
            
            <h2 className="text-2xl font-bold text-education mb-4">{t('aboutPage.section5.title')}</h2>
            <p className="mb-6 font-normal text-slate-800">
              {t('aboutPage.section5.content')}
            </p>
            
            <h2 className="text-2xl font-bold text-education mb-4">{t('aboutPage.section6.title')}</h2>
            <p className="mb-6 text-slate-800">
              {t('aboutPage.section6.content')}
            </p>
            
            <div className="mt-10 flex justify-center">
              <Button className="bg-education hover:bg-education-dark text-white font-bold py-2 px-6 rounded-lg shadow-lg transition-all" size="lg">
                <Handshake className="mr-2" />
                <Link to="/about" className="text-white">{t('aboutPage.supportButton')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>;
};
export default AboutPage;