
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Github } from "lucide-react";

const Footer = () => {
  const { t } = useTranslation();
  return <footer className="mt-auto border-t border-border bg-[#0E3542]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <Link to="/" className="text-lg font-bold text-education">
              AiDebate<span className="text-slate-50">.tech</span>
            </Link>
            <p className="mt-2 text-sm text-gray-300">
              {t('footer.description')}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-education-light">{t('footer.resources.title')}</h3>
            <ul className="mt-2 space-y-2">
              <li>
                <Link to="/apps" className="text-sm text-gray-300 hover:text-education-light transition">
                  {t('footer.resources.allApps')}
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-sm text-gray-300 hover:text-education-light transition">
                  {t('footer.resources.aboutUs')}
                </Link>
              </li>
              <li>
                <a href="https://github.com/Hoppitbilbo/DebateAI" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-300 hover:text-education-light transition flex items-center">
                  <Github className="h-4 w-4 mr-2" />
                  GitHub
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-education-light">{t('footer.legal.title')}</h3>
            <ul className="mt-2 space-y-2">
              <li>
                <Link to="/privacy" className="text-sm text-gray-300 hover:text-education-light transition">
                  {t('footer.legal.privacy')}
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-sm text-gray-300 hover:text-education-light transition">
                  {t('footer.legal.terms')}
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-gray-400">
          {t('footer.copyright', { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>;
};

export default Footer;
