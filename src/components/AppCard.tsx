
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { appMorph, useMorphNavigate } from "@/features/navigation/morph";
import { useTranslation } from "react-i18next";
import AppArt from "@/components/AppArt";
import { appArtSlug } from "@/lib/appArt";

interface AppCardProps {
  title: string;
  description: string;
  link: string;
  isNew?: boolean;
  isComingSoon?: boolean;
}

const AppCard = ({ 
  title, 
  description, 
  link, 
  isNew, 
  isComingSoon 
}: AppCardProps) => {
  const { t } = useTranslation();
  const morphTo = useMorphNavigate();

  return (
    <Card className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-none transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-foreground/60 hover:shadow-[4px_4px_0_0_hsl(var(--foreground))]" {...appMorph(link, "card")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <AppArt slug={appArtSlug(link)} className="flex-1" />
          {isNew && (
            <span className="rounded-full bg-education px-2 py-1 text-xs font-medium text-education-dark">
              {t('appsPage.badges.new')}
            </span>
          )}
          {isComingSoon && (
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
              {t('appsPage.badges.comingSoon')}
            </span>
          )}
        </div>
        <CardTitle className="pt-2 text-xl font-semibold text-foreground group-hover:text-education" {...appMorph(link, "title")}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <CardDescription className="text-base text-muted-foreground">{description}</CardDescription>
      </CardContent>
      <CardFooter>
        {isComingSoon ? (
          <Button variant="outline" className="w-full" disabled>
            {t('appsPage.buttons.comingSoon')}
          </Button>
        ) : (
          <Button 
            onClick={() => void morphTo(link)}
            className="w-full bg-education hover:bg-education-muted text-education-dark font-medium"
          >
            {t('appsPage.buttons.launchApp')}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default AppCard;
