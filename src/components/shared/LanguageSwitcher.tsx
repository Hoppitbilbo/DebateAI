/**
 * @file Renders a dropdown menu for switching the application's language.
 * @remarks This component uses `i18next` to manage language changes and displays a list of
 * available languages in a dropdown menu.
 */

import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

/**
 * @function LanguageSwitcher
 * @description A component that provides a user interface for changing the application's language.
 * It displays the current language and allows selection from a predefined list.
 * @returns {JSX.Element} The rendered language switcher dropdown.
 */
const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation();

  const languages = [
    { code: 'it', name: t('language.languages.italian') },
    { code: 'en', name: t('language.languages.english') },
    { code: 'es', name: t('language.languages.spanish') },
    { code: 'fr', name: t('language.languages.french') },
    { code: 'de', name: t('language.languages.german') },
  ];

  /**
   * @function changeLanguage
   * @description Changes the application's language using i18next.
   * @param {string} languageCode - The code of the language to switch to (e.g., 'en', 'it').
   */
  const changeLanguage = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-education hover:text-education-light">
          <Globe className="h-5 w-5" />
          <span className="sr-only">{t('language.selector')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => changeLanguage(language.code)}
            className={`cursor-pointer ${
              i18n.language === language.code ? 'bg-education/10' : ''
            }`}
          >
            {language.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
