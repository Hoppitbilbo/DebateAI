
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { appMorph, useMorphClick } from "@/features/navigation/morph";
import { useTranslation } from "react-i18next";
import AppArt from "@/components/AppArt";
import { AI_CHARACTERS, type ListedApp } from "@/features/apps/catalog";
import type { AppType } from "@/lib/api";

/** A card on the apps page; the upcoming app is shown but cannot be opened. */
const AppCard = ({ app }: { app: ListedApp }) => {
  const { t } = useTranslation();
  const morphClick = useMorphClick();
  const { path: link, upcoming } = app;
  const title = t(`appsPage.appCards.${app.i18nKey}.title`);

  return (
    <Card className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-none transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-foreground/60 hover:shadow-[4px_4px_0_0_hsl(var(--foreground))]" {...appMorph(link, "card")}>
      <CardHeader className="pb-1">
        <div className="flex items-start justify-between gap-3">
          <AppArt slug={app.slug} className="flex-1" />
          {upcoming && (
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
              {t('appsPage.badges.comingSoon')}
            </span>
          )}
        </div>
        <CardTitle className="pt-2 text-xl font-semibold text-foreground group-hover:text-education" {...appMorph(link, "title")}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <CardDescription className="text-base text-muted-foreground">{t(`appsPage.appCards.${app.i18nKey}.description`)}</CardDescription>
        {!upcoming && (
          // What the activity is like, to choose before opening it.
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="font-medium text-foreground">{t("appsPage.facts.skill")}</dt>
            <dd className="text-muted-foreground">{t(`appsPage.appCards.${app.i18nKey}.skill`)}</dd>
            <dt className="font-medium text-foreground">{t("appsPage.facts.duration")}</dt>
            <dd className="text-muted-foreground">{t(`appsPage.appCards.${app.i18nKey}.duration`)}</dd>
            <dt className="font-medium text-foreground">{t("appsPage.facts.characters")}</dt>
            <dd className="text-muted-foreground">{AI_CHARACTERS[app.slug as AppType]}</dd>
          </dl>
        )}
      </CardContent>
      <CardFooter>
        {upcoming ? (
          <Button variant="outline" className="w-full" disabled>
            {t('appsPage.buttons.comingSoon')}
          </Button>
        ) : (
          // A real link: it can be opened in a new tab, and its name says which app it starts.
          <Button asChild className="w-full bg-education hover:bg-education-muted text-education-dark font-medium">
            <Link to={link} onClick={morphClick(link)} aria-label={t('appsPage.buttons.launchNamed', { name: title })}>
              {t('appsPage.buttons.launchApp')}
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default AppCard;
