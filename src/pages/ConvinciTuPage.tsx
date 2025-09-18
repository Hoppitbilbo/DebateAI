
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ConvinciTuInterface from "@/components/ConvinciTuInterface";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

const ConvinciTuPage = () => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-education-light mb-4">
              {t('apps.convinciTu.title')}
            </h1>
            <p className="text-lg text-foreground mb-6">
              {t('apps.convinciTu.subtitle')}
            </p>
            <div className="mb-8">
              <Link to="/apps/convinci-tu/tutorial">
                <Button
                  variant="outline"
                  className="inline-flex items-center space-x-2"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>{t('common.tutorial', 'View Tutorial')}</span>
                </Button>
              </Link>
            </div>
          </div>
          <ConvinciTuInterface />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ConvinciTuPage;
