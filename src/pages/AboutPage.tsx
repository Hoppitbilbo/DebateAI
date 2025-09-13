import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Handshake, Github, MessageCircle } from "lucide-react";
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
            
            <h2 className="text-2xl font-bold text-education mb-4">{t('aboutPage.section7.title')}</h2>
            <div className="mb-6 text-slate-800 space-y-4">
              <p>{t('aboutPage.section7.paragraph1')}</p>
              <p>{t('aboutPage.section7.paragraph2')}</p>
              <p>{t('aboutPage.section7.paragraph3')}</p>
              <p>{t('aboutPage.section7.paragraph4')}</p>
              <p>{t('aboutPage.section7.paragraph5')}</p>
              <p>{t('aboutPage.section7.paragraph6')}</p>
              <p>{t('aboutPage.section7.paragraph7')}</p>
            </div>
            
            <div className="mt-10 space-y-6">
              <div className="flex justify-center">
                <Button className="bg-education hover:bg-education-dark text-white font-bold py-2 px-6 rounded-lg shadow-lg transition-all" size="lg">
                  <Handshake className="mr-2" />
                  <Link to="/about" className="text-white">{t('aboutPage.supportButton')}</Link>
                </Button>
              </div>
              
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                  {t('aboutPage.helpDevelopment.title')}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
                  {t('aboutPage.helpDevelopment.description')}
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Button 
                     className="bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-6 rounded-lg shadow-md transition-all flex items-center"
                     onClick={() => window.open('https://www.reddit.com/r/AIDebatExperiences/', '_blank')}
                   >
                    <MessageCircle className="mr-2" size={20} />
                    {t('aboutPage.helpDevelopment.redditButton')}
                  </Button>
                  <Button 
                     className="bg-gray-800 hover:bg-gray-900 text-white font-medium py-2 px-6 rounded-lg shadow-md transition-all flex items-center"
                     onClick={() => window.open('https://github.com/Hoppitbilbo/DebateAI', '_blank')}
                   >
                    <Github className="mr-2" size={20} />
                    {t('aboutPage.helpDevelopment.githubButton')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>;
};
export default AboutPage;