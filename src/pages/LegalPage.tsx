import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";

const SECTIONS = { privacy: 5, terms: 4 } as const;

const LegalPage = ({ kind }: { kind: keyof typeof SECTIONS }) => {
  const { t } = useTranslation();
  const base = `platform.legal.${kind}`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold text-education-light sm:text-4xl">{t(`${base}.title`)}</h1>
        <p className="mt-4 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          {t("platform.legal.note")}
        </p>
        {Array.from({ length: SECTIONS[kind] }, (_, i) => (
          <section key={i} className="mt-8">
            <h2 className="text-xl font-semibold text-foreground">{t(`${base}.s${i + 1}h`)}</h2>
            <p className="mt-2 leading-relaxed text-foreground/85">{t(`${base}.s${i + 1}p`)}</p>
          </section>
        ))}
        <Button asChild variant="outline" className="mt-10">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("platform.legal.back")}
          </Link>
        </Button>
      </main>
      <Footer />
    </div>
  );
};

export default LegalPage;
