/**
 * @file Renders a 404 "Not Found" page.
 * @remarks This page is displayed when a user navigates to a route that does not exist.
 * It includes a link to return to the homepage.
 */

import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

/**
 * @function NotFound
 * @description The component for the 404 error page.
 * It logs the non-existent path and provides a button to navigate back to the homepage.
 * @returns {JSX.Element} The rendered 404 page.
 */
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
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-education mb-4">404</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
          {t('notFound.title')}
        </p>
        <Link to="/">
          <Button className="bg-education hover:bg-education-dark text-white">
            {t('notFound.button')}
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
