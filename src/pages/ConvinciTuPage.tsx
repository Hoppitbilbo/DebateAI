
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ConvinciTuInterface from "@/components/ConvinciTuInterface";
import { useTranslation } from "react-i18next";

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
            <p className="text-lg text-foreground">
              {t('apps.convinciTu.subtitle')}
            </p>
          </div>
          <ConvinciTuInterface />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ConvinciTuPage;
