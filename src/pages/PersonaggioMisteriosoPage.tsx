
import PersonaggioMisteriosoInterface from "@/components/PersonaggioMisteriosoInterface";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

const PersonaggioMisteriosoPage = () => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center text-education-light mb-6">
          {t('apps.personaggioMisterioso.title')}
        </h1>
        <p className="text-center text-foreground mb-6 max-w-3xl mx-auto">
          {t('apps.personaggioMisterioso.description')}
        </p>
        <div className="text-center mb-8">
          <Link to="/apps/personaggio-misterioso/tutorial">
            <Button
              variant="outline"
              className="inline-flex items-center space-x-2"
            >
              <BookOpen className="w-4 h-4" />
              <span>{t('common.tutorial', 'View Tutorial')}</span>
            </Button>
          </Link>
        </div>
        <PersonaggioMisteriosoInterface />
      </main>
      <Footer />
    </div>
  );
};

export default PersonaggioMisteriosoPage;
