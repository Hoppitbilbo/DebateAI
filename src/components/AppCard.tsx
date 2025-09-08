/**
 * @file Renders an application card with a title, description, icon, and a launch button.
 * @remarks This component is used on the apps page to display a grid of available applications.
 * It includes badges for "New" and "Coming Soon" states and handles navigation with an animation.
 */

import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAnimation } from "@/context/AnimationContext";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

/**
 * @interface AppCardProps
 * @description Defines the props for the AppCard component.
 * @property {string} title - The title of the application.
 * @property {string} description - A brief description of the application.
 * @property {ReactNode} icon - The icon representing the application.
 * @property {string} link - The route to navigate to when the app is launched.
 * @property {boolean} [isNew] - Optional flag to display a "New" badge.
 * @property {boolean} [isComingSoon] - Optional flag to display a "Coming Soon" badge and disable the launch button.
 */
interface AppCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  link: string;
  isNew?: boolean;
  isComingSoon?: boolean;
}

/**
 * @function AppCard
 * @description A reusable component that displays an application card.
 * It features a title, description, icon, and a button to launch the application.
 * The card can also display "New" or "Coming Soon" badges based on the props.
 * @param {AppCardProps} props - The props for the component.
 * @returns {JSX.Element} The rendered application card.
 */
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

  /**
   * @function handleLaunchApp
   * @description Handles the click event for the launch button.
   * It triggers a page transition animation and navigates to the specified application route.
   */
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
