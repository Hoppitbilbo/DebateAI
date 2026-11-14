import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Github, MessageCircle, Linkedin, LayoutGrid, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ABOUT_REFERENCES } from "./aboutReferences";

const REPO_URL = "https://github.com/Hoppitbilbo/DebateAI";

const AboutPage = () => {
  const { t } = useTranslation();

  // Each section is a title and one or more paragraphs.
  const sections = [
    { title: t("aboutPage.origin.title"), body: [t("aboutPage.origin.p1"), t("aboutPage.origin.p2")] },
    { title: t("aboutPage.homework.title"), body: [t("aboutPage.homework.p1"), t("aboutPage.homework.p2")] },
    { title: t("aboutPage.assessment.title"), body: [t("aboutPage.assessment.p1"), t("aboutPage.assessment.p2")] },
    { title: t("aboutPage.cost.title"), body: [t("aboutPage.cost.p1"), t("aboutPage.cost.p2")] },
    { title: t("aboutPage.local.title"), body: [t("aboutPage.local.p1")] },
    { title: t("aboutPage.limits.title"), body: [t("aboutPage.limits.p1")] },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 py-12 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-extrabold text-education-light sm:text-4xl mb-4 text-center">
            {t("aboutPage.title")}
          </h1>
          <p className="text-lg text-foreground/90 leading-relaxed text-center mb-10">{t("aboutPage.lead")}</p>

          <article className="bg-card border border-border p-5 sm:p-8 rounded-lg shadow-md space-y-8">
            {sections.map((s) => (
              <section key={s.title}>
                <h2 className="text-xl sm:text-2xl font-bold text-education-light mb-3">{s.title}</h2>
                <div className="space-y-4 text-foreground/90 leading-relaxed">
                  {s.body.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </div>
              </section>
            ))}

            <section>
              <h2 className="text-xl sm:text-2xl font-bold text-education-light mb-3">{t("aboutPage.code.title")}</h2>
              <div className="space-y-4 text-foreground/90 leading-relaxed">
                <p>{t("aboutPage.code.p1")}</p>
                <p>{t("aboutPage.code.p2")}</p>
              </div>
              <Button asChild variant="outline" className="mt-4">
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                  <Github className="mr-2" size={18} />
                  {t("aboutPage.code.button")}
                </a>
              </Button>
            </section>

            <section id="help" className="scroll-mt-24 border-t border-border pt-8 text-center">
              <h2 className="text-xl sm:text-2xl font-bold text-education-light mb-3">{t("aboutPage.cta.title")}</h2>
              <p className="text-foreground/90 leading-relaxed max-w-2xl mx-auto mb-6">{t("aboutPage.cta.p1")}</p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center">
                <Button asChild className="bg-education hover:bg-education/90 text-education-dark font-bold">
                  <Link to="/apps">
                    <LayoutGrid className="mr-2" size={18} />
                    {t("aboutPage.cta.apps")}
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/teacher-guide">
                    <BookOpen className="mr-2" size={18} />
                    {t("aboutPage.cta.guide")}
                  </Link>
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center mt-3">
                <Button asChild variant="ghost">
                  <a href="https://www.reddit.com/r/AIDebatExperiences/" target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2" size={18} />
                    Reddit
                  </a>
                </Button>
                <Button asChild variant="ghost">
                  <a href={`${REPO_URL}/issues`} target="_blank" rel="noopener noreferrer">
                    <Github className="mr-2" size={18} />
                    GitHub
                  </a>
                </Button>
                <Button asChild variant="ghost">
                  <a href="https://www.linkedin.com/in/andres-moles-ab620a263/" target="_blank" rel="noopener noreferrer">
                    <Linkedin className="mr-2" size={18} />
                    LinkedIn
                  </a>
                </Button>
              </div>
            </section>
          </article>

          <section className="mt-10" aria-labelledby="references">
            <h2 id="references" className="text-xl sm:text-2xl font-bold text-education-light mb-2">
              {t("aboutPage.references.title")}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">{t("aboutPage.references.note")}</p>
            <div className="space-y-6">
              {ABOUT_REFERENCES.map((group) => (
                <div key={group.id}>
                  <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">{t(`aboutPage.references.groups.${group.id}`)}</h3>
                  <ul className="space-y-2 text-sm text-foreground/80 leading-relaxed">
                    {group.items.map((ref) => (
                      <li key={ref.text} className="pl-4 -indent-4 break-words">
                        {ref.text}{" "}
                        {ref.url && (
                          <a
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-education-light underline underline-offset-2 hover:no-underline"
                          >
                            {ref.url.replace(/^https?:\/\//, "")}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AboutPage;
