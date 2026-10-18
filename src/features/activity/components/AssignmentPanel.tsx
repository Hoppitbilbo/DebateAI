import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, Circle, ClipboardList, Loader2, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import MarkdownViewer from "@/components/shared/MarkdownViewer";
import type { ActivitySession } from "../useActivitySession";

/** Shows the teacher's assignment, the goals and the live JEV progress. */
const AssignmentPanel = ({ session }: { session: ActivitySession }) => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(true);
  const a = session.assignment;
  if (!a) return null;

  const jevGoals = session.jev?.goals ?? null;
  const goals = a.goals.length ? a.goals : [];
  const progress = session.jev?.progress ?? 0;

  return (
    <section className="rounded-lg border border-primary/40 bg-card text-card-foreground shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <ClipboardList className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("platform.assignment.label")} · {a.className}
            </p>
            <h2 className="font-semibold">{a.title}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {session.judging && <Loader2 className="h-4 w-4 animate-spin text-primary" aria-label={t("platform.assignment.judging")} />}
          <span className="hidden text-sm font-semibold text-primary sm:inline">{progress}%</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          {a.instructions && <MarkdownViewer content={a.instructions} className="prose-sm" />}

          <div className="flex flex-wrap gap-2 text-xs">
            {a.dueAt && (
              <Badge variant="outline" className="gap-1">
                <CalendarClock className="h-3 w-3" />
                {t("platform.assignment.due", { date: new Date(a.dueAt).toLocaleString(i18n.language) })}
              </Badge>
            )}
            {a.maxTurns > 0 && (
              <Badge variant="outline">{t("platform.assignment.turnsLeft", { count: session.turnsLeft ?? a.maxTurns, max: a.maxTurns })}</Badge>
            )}
            {a.minTurns > 0 && <Badge variant="outline">{t("platform.assignment.minTurns", { count: a.minTurns })}</Badge>}
            {a.autoEnd && (
              <Badge variant="outline" className="gap-1">
                <Sparkles className="h-3 w-3" /> {t("platform.assignment.autoEnd")}
              </Badge>
            )}
          </div>

          {goals.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{t("platform.assignment.goals")}</span>
                <span className="text-muted-foreground">
                  {session.jev?.engine && session.jev.engine !== "none"
                    ? t("platform.assignment.judgedBy", { engine: session.jev.engine === "jev" ? "JEV" : "AI" })
                    : t("platform.assignment.notJudgedYet")}
                </span>
              </div>
              <Progress value={progress} aria-label={t("platform.assignment.progress")} />
              <ul className="space-y-1.5">
                {goals.map((g, i) => {
                  const met = jevGoals?.[i]?.met;
                  return (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      {met ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className={cn(met && "text-primary")}>{g}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {session.jev?.hint && !session.jev.completed && (
            <p className="rounded-md bg-primary/10 p-3 text-sm">💡 {session.jev.hint}</p>
          )}
          {session.jev?.offTopic && (
            <p className="flex items-center gap-2 rounded-md bg-amber-400/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-400" /> {t("platform.assignment.offTopic")}
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default AssignmentPanel;
