import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Github, LayoutDashboard, LogIn, LogOut, Menu, Settings, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";
import { cn } from "@/lib/utils";
import { dashboardPath, useAuth } from "@/context/auth";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const { user, logout, config } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: "/", label: t("navigation.home"), end: true },
    { to: "/apps", label: t("navigation.apps") },
    { to: "/tutorials", label: t("platform.nav.tutorials") },
    { to: "/about", label: t("navigation.about") },
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn("rounded-md px-3 py-2 text-sm font-medium font-heading transition-colors", isActive ? "text-education-light" : "text-education hover:text-education-light");

  const doLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-education-dark/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="logo text-xl font-bold text-education">
          {config?.siteName && config.siteName !== "AiDebate.tech" ? config.siteName : <>AiDebate<span className="text-foreground">.tech</span></>}
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label={t("platform.nav.main")}>
          {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>{l.label}</NavLink>)}
        </nav>

        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <a href="https://github.com/Hoppitbilbo/DebateAI" target="_blank" rel="noopener noreferrer" className="hidden lg:block" aria-label="GitHub">
            <Button variant="ghost" size="icon" className="text-education hover:text-education-light"><Github className="h-5 w-5" /></Button>
          </a>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="ml-1 border-education text-education hover:bg-education hover:text-education-dark">
                  <UserRound className="mr-2 h-4 w-4" />
                  <span className="max-w-[120px] truncate">{user.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="truncate">{user.email}</div>
                  <div className="text-xs font-normal text-muted-foreground">{t(`platform.roles.${user.role}`)}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(dashboardPath(user))}><LayoutDashboard className="mr-2 h-4 w-4" />{t("platform.nav.dashboard")}</DropdownMenuItem>
                {user.role === "admin" && <DropdownMenuItem onClick={() => navigate("/teacher")}><LayoutDashboard className="mr-2 h-4 w-4" />{t("platform.nav.myClasses")}</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => navigate("/account")}><Settings className="mr-2 h-4 w-4" />{t("platform.nav.account")}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={doLogout}><LogOut className="mr-2 h-4 w-4" />{t("platform.nav.logout")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm" variant="outline" className="ml-1 hidden border-education text-education hover:bg-education hover:text-education-dark sm:inline-flex">
              <Link to="/login"><LogIn className="mr-2 h-4 w-4" />{t("platform.auth.login")}</Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="text-education md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t("platform.nav.menu")}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {open && (
        <nav className="space-y-1 border-t border-border/60 px-4 pb-4 pt-2 md:hidden" aria-label={t("platform.nav.main")}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={(s) => cn(linkClass(s), "block")} onClick={() => setOpen(false)}>{l.label}</NavLink>
          ))}
          {!user && (
            <NavLink to="/login" className={(s) => cn(linkClass(s), "block")} onClick={() => setOpen(false)}>{t("platform.auth.login")}</NavLink>
          )}
        </nav>
      )}
    </header>
  );
};

export default Navbar;
