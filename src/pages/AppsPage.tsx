
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AppCard from "@/components/AppCard";
import { useTranslation } from "react-i18next";
import { APPS_PAGE_APPS } from "@/features/apps/catalog";

const AppsPage = () => {
  const { t } = useTranslation();


  return (
    <div className="flex flex-col min-h-screen animate-fade-in">
      <Navbar />
      
      <main className="flex-1 bg-background">
        <header className="border-b border-border bg-secondary">
          <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1fr_minmax(0,260px)] lg:px-8 lg:py-16">
            <div>
              <p className="font-body text-sm font-semibold uppercase tracking-[0.14em] text-education">{t('features.title')}</p>
              <h1 className="mt-3 text-4xl text-foreground sm:text-5xl lg:text-6xl">
                <span className="ink-underline">{t('appsPage.title')}</span>
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
                {t('appsPage.subtitle')}
              </p>
            </div>
            <img src="/illustrations/community.webp" alt="" width={720} height={720} decoding="async"
              className="illustration mx-auto hidden max-w-[260px] md:block" />
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {APPS_PAGE_APPS.map((app) => (
              <AppCard key={app.slug} app={app} />
            ))}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default AppsPage;
