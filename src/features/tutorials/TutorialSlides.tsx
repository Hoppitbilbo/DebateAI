import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Tutorial } from "./tutorials";

interface TutorialSlidesProps {
  tutorial: Tutorial;
  /** Where "start the app" leads. */
  appPath: string;
}

/** Shows a tutorial one slide at a time, with dots, back/next and a start button on the last slide. */
const TutorialSlides = ({ tutorial, appPath }: TutorialSlidesProps) => {
  const { t } = useTranslation("tutorial");
  const { t: tc } = useTranslation(); // shared button labels
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const { ns, slides } = tutorial;
  const slide = slides[current];
  const key = `${ns}.slides.${slide.id}`;
  const Icon = slide.icon;
  const isLast = current === slides.length - 1;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold text-education-light">{t(`${ns}.title`)}</h1>
        <p className="text-lg text-muted-foreground">{t(`${ns}.subtitle`)}</p>
      </div>

      <div className="mb-6 flex justify-center">
        <div className="flex space-x-2">
          {slides.map((s, index) => (
            <button
              key={s.id}
              onClick={() => setCurrent(index)}
              aria-label={`${index + 1} / ${slides.length}`}
              aria-current={index === current ? "step" : undefined}
              className={`h-3 w-3 rounded-full transition-colors ${
                index === current ? "bg-education" : "bg-muted-foreground/40 hover:bg-muted-foreground/70"
              }`}
            />
          ))}
        </div>
      </div>

      <Card className="border-border bg-card shadow-lg">
        <CardContent className="p-8">
          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0">
              <Icon className="h-8 w-8 text-education" />
            </div>
            <div className="flex-1">
              <h2 className="mb-4 text-2xl font-semibold text-foreground">{t(`${key}.title`)}</h2>
              <p className="mb-6 text-lg leading-relaxed text-foreground/90">{t(`${key}.content`)}</p>
              <ul className="space-y-3">
                {Array.from({ length: slide.bullets }, (_, i) => (
                  <li key={i} className="flex items-start space-x-3">
                    <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-education" />
                    <span className="text-foreground/90">{t(`${key}.bullet${i + 1}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button onClick={() => setCurrent(current - 1)} variant="outline" disabled={current === 0} className="flex items-center space-x-2">
          <ChevronLeft className="h-4 w-4" />
          <span>{tc("common.back")}</span>
        </Button>
        <span className="text-sm text-muted-foreground">
          {current + 1} / {slides.length}
        </span>
        <Button onClick={() => setCurrent(current + 1)} disabled={isLast} className="flex items-center space-x-2 bg-education hover:bg-education-dark">
          <span>{tc("common.next")}</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLast && (
        <div className="pt-6 text-center">
          <Button size="lg" className="bg-education px-8 py-3 text-education-dark hover:bg-education/90" onClick={() => navigate(appPath)}>
            {t(`${ns}.startApp`)}
          </Button>
        </div>
      )}
    </div>
  );
};

export default TutorialSlides;
