import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, MessageSquare, Search, Speech, User, Users, BookOpen } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth";
import type { AppType, Role, SessionSummary } from "@/lib/api";
import { APP_ICONS } from "@/features/activity/appCatalog";

export const AppName = ({ type }: { type: AppType }) => {
  const { t } = useTranslation();
  const Icon = APP_ICONS[type];
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-4 w-4 text-primary" /> {t(`platform.appNames.${type}`)}
    </span>
  );
};

export const DashboardLayout = ({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex min-h-screen flex-col bg-background text-foreground">
    <div className="print:hidden">
      <Navbar />
    </div>
    <main className="flex-1">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-primary">{title}</h1>
            {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
        {children}
      </div>
    </main>
    <Footer />
  </div>
);

export const Panel = ({ title, actions, children, className, tour }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; /** Target name for the guided tour. */ tour?: string }) => (
  <section className={cn("rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm", className)} data-tour={tour}>
    {(title || actions) && (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        {title && <h2 className="text-lg font-semibold">{title}</h2>}
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    )}
    {children}
  </section>
);

export const StatTile = ({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "warn" | "ok" }) => (
  <div className="rounded-lg border border-border bg-card p-4 text-card-foreground">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={cn("mt-1 font-heading text-2xl font-bold", tone === "warn" ? "text-warning" : "text-foreground")}>{value}</p>
    {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
  </div>
);

export const StatusBadge = ({ status }: { status?: SessionSummary["status"] | "todo" }) => {
  const { t } = useTranslation();
  const s = status ?? "todo";
  const tone: Record<string, string> = {
    todo: "border-border text-muted-foreground",
    active: "border-sky-400/60 text-info",
    goal_reached: "border-primary text-primary",
    turn_limit: "border-amber-400/60 text-warning",
    completed: "border-primary bg-primary text-primary-foreground",
    abandoned: "border-border text-muted-foreground",
  };
  return <Badge variant="outline" className={cn("whitespace-nowrap", tone[s])}>{t(`platform.status.${s}`)}</Badge>;
};

export const EmptyState = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{children}</p>
);

/**
 * A list or page that could not be loaded: says so, instead of looking
 * empty, and offers to try again.
 */
export const LoadError = ({ onRetry }: { onRetry: () => void }) => {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-md border border-dashed border-destructive/50 p-6 text-center text-sm">
      <p className="text-destructive">{t("platform.common.loadError")}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>{t("platform.activity.retry")}</Button>
    </div>
  );
};

export const Spinner = () => (
  <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
);

/** Route guard by role (admin > teacher > student). */
export const RequireRole = ({ role, children }: { role: Role; children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  const rank: Record<Role, number> = { student: 1, teacher: 2, admin: 3 };
  if (rank[user.role] < rank[role]) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};
