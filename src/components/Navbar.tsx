
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, Github, Key } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";
import RedditButton from "@/components/shared/RedditButton";
import ApiKeyModal from "@/components/shared/ApiKeyModal";
import { useApiKey } from "@/context/ApiKeyContext";

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const { t } = useTranslation();
  const { isApiKeySet } = useApiKey();

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className={`bg-education-dark shadow-sm reveal-animation ${isLoaded ? 'revealed' : ''}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <span className="text-xl font-bold text-education logo">
                AiDebate<span className="text-slate-50">.tech</span>
              </span>
            </Link>
          </div>

          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <Link to="/" className="px-3 py-2 rounded-md text-sm font-medium text-education hover:text-education-light font-heading">
                {t('navigation.home')}
              </Link>
              <Link to="/apps" className="px-3 py-2 rounded-md text-sm font-medium text-education hover:text-education-light font-heading">
                {t('navigation.apps')}
              </Link>
              <Link to="/tutorials" className="px-3 py-2 rounded-md text-sm font-medium text-education hover:text-education-light font-heading">
                Tutorial
              </Link>
              {/* <Link to="/teacher-guide" className="px-3 py-2 rounded-md text-sm font-medium text-education hover:text-education-light font-heading">
                {t('navigation.teacherGuide')}
              </Link> */}
              
              <RedditButton />
              
              {/* API Key Button */}
              <Button
                key="desktop-api-key-button"
                variant="outline"
                size="sm"
                onClick={() => setIsApiKeyModalOpen(true)}
                className={`ml-2 border-education text-education hover:bg-education hover:text-education-dark font-heading transition-all duration-300 ${
                  !isApiKeySet ? 'animate-bounce shadow-lg shadow-education/30' : ''
                }`}
                title={isApiKeySet ? "Manage API Key" : "Insert Your API Key"}
              >
                <Key className={`h-4 w-4 mr-2 ${!isApiKeySet ? 'text-yellow-500' : ''}`} />
                {isApiKeySet ? "API Key" : "Insert API Key"}
              </Button>
              
              <LanguageSwitcher />
              
              <a href="https://github.com/Hoppitbilbo/DebateAI" target="_blank" rel="noopener noreferrer">
                <Button key="desktop-github-button" variant="outline" className="ml-2 border-education text-education hover:bg-education hover:text-education-dark font-heading">
                  <Github className="h-4 w-4 mr-2" />
                  GitHub
                </Button>
              </a>
              <Link to="/about">
                <Button key="desktop-about-button" variant="outline" className="ml-2 border-education text-education hover:bg-education hover:text-education-dark font-heading">
                  {t('navigation.about')}
                </Button>
              </Link>
            </div>
          </div>

          <div className="md:hidden flex items-center space-x-2">
            <LanguageSwitcher />
            
            <Button key="mobile-menu-toggle" variant="ghost" size="icon" onClick={toggleMobileMenu} className="text-education">
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && <div className="md:hidden bg-education-dark shadow-lg">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link to="/" className="block px-3 py-2 rounded-md text-base font-medium text-education hover:text-education-light font-heading" onClick={() => setIsMobileMenuOpen(false)}>
              {t('navigation.home')}
            </Link>
            <Link to="/apps" className="block px-3 py-2 rounded-md text-base font-medium text-education hover:text-education-light font-heading" onClick={() => setIsMobileMenuOpen(false)}>
              {t('navigation.apps')}
            </Link>
            <Link to="/tutorials" className="block px-3 py-2 rounded-md text-base font-medium text-education hover:text-education-light font-heading" onClick={() => setIsMobileMenuOpen(false)}>
              Tutorial
            </Link>
            {/* <Link to="/teacher-guide" className="block px-3 py-2 rounded-md text-base font-medium text-education hover:text-education-light font-heading" onClick={() => setIsMobileMenuOpen(false)}>
              {t('navigation.teacherGuide')}
            </Link> */}
            
            <div className="px-3 py-2">
              <RedditButton />
            </div>
            
            {/* Mobile API Key Button */}
            <div className="px-3 py-2">
              <Button
                key="mobile-api-key-button"
                onClick={() => {
                  setIsApiKeyModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full bg-education hover:bg-education-light text-education-dark font-heading transition-all duration-300 ${
                  !isApiKeySet ? 'animate-bounce shadow-lg shadow-education/30' : ''
                }`}
              >
                <Key className={`h-4 w-4 mr-2 ${!isApiKeySet ? 'text-yellow-500' : ''}`} />
                {isApiKeySet ? "Manage API Key" : "Insert Your API Key"}
              </Button>
            </div>
            <a href="https://github.com/Hoppitbilbo/DebateAI" target="_blank" rel="noopener noreferrer" className="block w-full my-2">
              <Button key="mobile-github-button" className="w-full bg-education hover:bg-education-light text-education-dark font-heading">
                <Github className="h-4 w-4 mr-2" />
                GitHub
              </Button>
            </a>
            <Link to="/about" onClick={() => setIsMobileMenuOpen(false)}>
              <Button key="mobile-about-button" className="w-full my-2 bg-education hover:bg-education-light text-education-dark font-heading">
                {t('navigation.about')}
              </Button>
            </Link>
          </div>
        </div>}
        
      {/* API Key Modal */}
      <ApiKeyModal 
        isOpen={isApiKeyModalOpen} 
        onClose={() => setIsApiKeyModalOpen(false)} 
      />
    </header>
  );
};

export default Navbar;
