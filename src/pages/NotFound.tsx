
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const NotFound = () => {
  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="text-center">
        <img src="/illustrations/unplugged.webp" alt="" width={720} height={720} decoding="async"
          className="illustration mx-auto mb-6 max-w-[220px]" />
        <h1 className="text-6xl font-bold text-education mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-8">
          {t('notFound.title')}
        </p>
        <Button asChild className="bg-education hover:bg-education/90 text-education-dark">
          <Link to="/">{t('notFound.button')}</Link>
        </Button>
      </div>
      </main>
      <Footer />
    </div>
  );
};

export default NotFound;
