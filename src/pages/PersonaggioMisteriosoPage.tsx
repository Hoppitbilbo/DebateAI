
import PersonaggioMisteriosoInterface from "@/components/PersonaggioMisteriosoInterface";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTranslation } from "react-i18next";

const PersonaggioMisteriosoPage = () => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center text-education-light mb-6">
          {t('apps.personaggioMisterioso.title')}
        </h1>
        <p className="text-center text-foreground mb-8 max-w-3xl mx-auto">
          {t('apps.personaggioMisterioso.description')}
        </p>
        <PersonaggioMisteriosoInterface />
      </main>
      <Footer />
    </div>
  );
};

export default PersonaggioMisteriosoPage;
