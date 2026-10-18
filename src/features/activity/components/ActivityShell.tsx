import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, BookOpen, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AiStatus } from "@/services/aiService";
import { useAiClient } from "@/services/aiClient";
import { useAuth } from "@/context/AuthContext";
import type { ActivityPhase, AppMeta } from "../types";
import type { ActivitySession } from "../useActivitySession";
import AssignmentPanel from "./AssignmentPanel";

interface ActivityShellProps {
  app: AppMeta;
  phase: ActivityPhase;
  session: ActivitySession;
  onReset?: () => void;
  children: React.ReactNode;
  /** Optional extra steps label override (e.g. "Final guess"). */
  phaseLabels?: Partial<Record<ActivityPhase, string>>;
}

const PHASES: ActivityPhase[] = ["setup", "chat", "reflection", "feedback"];

/** Common page frame for every learning app: same header, stepper, assignment panel. */
const ActivityShell = ({ app, phase, session, onReset, children, phaseLabels }: ActivityShellProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const ai = useAiClient();
  const [status, setStatus] = useState<AiStatus | null>(null);

  useEffect(() => {
    void ai.status().then(setStatus);
  }, [user, ai]);

  const title = t(`apps.${app.i18nKey}.title`);
  const description = t(`apps.${app.i18nKey}.description`, { defaultValue: "" }) || t(`apps.${app.i18nKey}.subtitle`, { defaultValue: "" });
  const currentIndex = PHASES.indexOf(phase);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
          <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <nav className="flex items-center gap-1 text-sm text-muted-foreground">
                <Link to="/apps" className="hover:text-primary">{t("navigation.apps")}</Link>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground">{title}</span>
              </nav>
              <h1 className="font-heading text-3xl font-bold text-primary sm:text-4xl">{title}</h1>
              {description && <p className="max-w-3xl text-muted-foreground">{description}</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              {app.tutorialPath && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={app.tutorialPath}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    {t("platform.activity.tutorial")}
                  </Link>
                </Button>
              )}
              {onReset && phase !== "setup" && (
                <Button variant="outline" size="sm" onClick={onReset}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t("platform.activity.restart")}
                </Button>
              )}
            </div>
          </header>

          <ol className="grid grid-cols-4 gap-2" aria-label={t("platform.activity.steps")}>
            {PHASES.map((p, i) => (
              <li
                key={p}
                className={cn(
                  "truncate rounded-md border px-1 py-2 text-center text-[11px] font-medium sm:px-3 sm:text-sm",
                  i < currentIndex && "border-primary/40 bg-primary/10 text-primary",
                  i === currentIndex && "border-primary bg-primary text-primary-foreground",
                  i > currentIndex && "border-border text-muted-foreground",
                )}
                aria-current={i === currentIndex ? "step" : undefined}
              >
                <span className="mr-1 hidden opacity-70 sm:inline">{i + 1}.</span>
                {phaseLabels?.[p] ?? t(`platform.activity.phase.${p}`)}
              </li>
            ))}
          </ol>

          {status && !status.text && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-400/50 bg-amber-400/10 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div>
                {!status.loggedIn && !status.guestAccess ? (
                  <>
                    {t("platform.activity.loginRequired")}{" "}
                    <Link to="/login" className="font-semibold text-primary underline">{t("platform.auth.login")}</Link>
                  </>
                ) : user?.role === "admin" ? (
                  <>
                    {t("platform.activity.aiNotConfiguredAdmin")}{" "}
                    <Link to="/admin?tab=ai" className="font-semibold text-primary underline">{t("platform.admin.tabs.ai")}</Link>
                  </>
                ) : (
                  t("platform.activity.aiNotConfigured")
                )}
              </div>
            </div>
          )}

          {session.assignmentId > 0 && session.loadingAssignment && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("platform.common.loading")}
            </div>
          )}
          {session.assignmentId > 0 && !session.user && !session.loadingAssignment && (
            <div className="rounded-lg border border-border bg-card p-4 text-sm">
              {t("platform.activity.loginForAssignment")}{" "}
              <Link to={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`} className="font-semibold text-primary underline">
                {t("platform.auth.login")}
              </Link>
            </div>
          )}
          {session.assignmentError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm">
              {t("platform.activity.assignmentError")}
            </div>
          )}
          {session.assignment && <AssignmentPanel session={session} />}

          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ActivityShell;
