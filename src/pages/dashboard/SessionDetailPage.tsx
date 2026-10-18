import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import MarkdownViewer from "@/components/shared/MarkdownViewer";
import { api, SessionDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { AppName, DashboardLayout, EmptyState, formatDate, Panel, Spinner, StatTile, StatusBadge, usd } from "./common";

/** Transcript + reflection + evaluation of one activity (student, teacher, admin). */
const SessionDetailPage = () => {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["session", id], queryFn: () => api.get<SessionDetail>(`/api/sessions/${id}`) });

  if (q.isLoading) return <DashboardLayout title="…"><Spinner /></DashboardLayout>;
  if (q.error || !q.data) return <DashboardLayout title={t("platform.errors.notFound")}><EmptyState>{t("platform.errors.notFound")}</EmptyState></DashboardLayout>;
  const s = q.data;
  const isOwner = s.userId === user?.id;

  return (
    <DashboardLayout
      title={s.assignmentTitle || s.title || t(`platform.appNames.${s.appType}`)}
      subtitle={`${isOwner ? "" : `${s.userName} · `}${formatDate(s.startedAt, i18n.language)}`}
      actions={<StatusBadge status={s.status} />}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label={t("platform.common.activity")} value={<span className="text-base"><AppName type={s.appType} /></span>} />
        <StatTile label={t("platform.common.turns")} value={s.turns} />
        <StatTile label={t("platform.assignment.progress")} value={`${s.progress}%`} />
        <StatTile label={t("platform.common.score")} value={`${s.scoreConversation ?? "–"} / ${s.scoreReflection ?? "–"}`} hint={t("platform.session.scoreHint")} />
        {user?.role !== "student" && <StatTile label={t("platform.common.cost")} value={usd(s.costUsd)} />}
      </div>

      {s.jev?.goals && s.jev.goals.length > 0 && (
        <Panel title={t("platform.session.jevTitle", { engine: s.jev.engine === "jev" ? "JEV" : "AI" })}>
          <Progress value={s.jev.progress ?? 0} className="mb-3" />
          <ul className="space-y-1.5 text-sm">
            {s.jev.goals.map((g, i) => (
              <li key={i} className="flex items-start gap-2">
                {g.met ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" /> : <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />}
                <span>{g.text}</span>
                <span className="ml-auto text-xs text-muted-foreground">{Math.round(g.score * 100)}%</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("platform.feedback.conversation")}>
          {s.transcript.length === 0 ? <EmptyState>{t("platform.session.emptyTranscript")}</EmptyState> : (
            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-2">
              {s.transcript.map((m, i) => (
                <div key={i} className={m.role === "user" ? "ml-8 rounded-lg bg-primary/15 p-3" : m.role === "system" ? "text-center text-xs text-muted-foreground" : "mr-8 rounded-lg border border-border p-3"}>
                  {m.role !== "system" && <p className="mb-1 text-xs font-semibold text-primary">{m.role === "user" ? m.name || s.userName || t("platform.common.student") : m.name || "AI"}</p>}
                  <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <div className="space-y-6">
          <Panel title={t("platform.feedback.yourReflection")}>
            {s.reflection ? <p className="whitespace-pre-wrap text-sm">{s.reflection}</p> : <EmptyState>{t("platform.session.noReflection")}</EmptyState>}
          </Panel>
          <Panel title={t("platform.feedback.aiFeedback")}>
            {s.evaluation ? <MarkdownViewer content={s.evaluation} className="prose-invert prose-sm" /> : <EmptyState>{t("platform.session.noEvaluation")}</EmptyState>}
          </Panel>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SessionDetailPage;
