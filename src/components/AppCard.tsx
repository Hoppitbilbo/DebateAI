
import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAnimation } from "@/context/AnimationContext";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface AppCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  link: string;
  isNew?: boolean;
  isComingSoon?: boolean;
}

const AppCard = ({ 
  title, 
  description, 
  icon, 
  link, 
  isNew, 
  isComingSoon 
}: AppCardProps) => {
  const { t } = useTranslation();
  const { startAnimation } = useAnimation();
  const navigate = useNavigate();

  const handleLaunchApp = () => {
    startAnimation(() => {
      navigate(link);
    });
  };

  return (
    <Card className="overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-lg border border-accent">
      <CardHeader className="pb-3 bg-accent">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-white">{title}</CardTitle>
          {isNew && (
            <span className="bg-education text-education-dark text-xs font-medium px-2 py-1 rounded-full">
              {t('appsPage.badges.new')}
            </span>
          )}
          {isComingSoon && (
            <span className="bg-muted text-xs font-medium px-2 py-1 rounded-full">
              {t('appsPage.badges.comingSoon')}
            </span>
          )}
        </div>
        <div className="flex justify-center py-3 text-education">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <CardDescription className="text-sm text-education-light">{description}</CardDescription>
      </CardContent>
      <CardFooter>
        {isComingSoon ? (
          <Button variant="outline" className="w-full" disabled>
            {t('appsPage.buttons.comingSoon')}
          </Button>
        ) : (
          <Button 
            onClick={handleLaunchApp}
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
