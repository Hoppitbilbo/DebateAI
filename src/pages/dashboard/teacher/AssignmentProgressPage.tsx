import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAssignmentProgress } from "@/features/teacher/teacherApi";
import { DashboardLayout, EmptyState, formatDate, Panel, Spinner, StatusBadge, usd } from "../common";

/** How each student is doing on one assignment. */
const AssignmentProgressPage = () => {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const q = useAssignmentProgress(id);
  if (q.isLoading) return <DashboardLayout title="…"><Spinner /></DashboardLayout>;
  if (!q.data) return <DashboardLayout title={t("platform.errors.notFound")}><EmptyState>{t("platform.errors.notFound")}</EmptyState></DashboardLayout>;
  const { assignment: a, students } = q.data;
  const completed = students.filter((s) => s.session && ["completed", "goal_reached"].includes(s.session.status)).length;
  const avg = (k: "scoreConversation" | "scoreReflection") => {
    const v = students.map((s) => s.session?.[k]).filter((x): x is number => x !== undefined);
    return v.length ? (v.reduce((p, c) => p + c, 0) / v.length).toFixed(1) : "–";
  };
  const cost = students.reduce((p, s) => p + (s.session?.costUsd ?? 0), 0);

  return (
    <DashboardLayout
      title={a.title}
      subtitle={`${a.className} · ${t(`platform.appNames.${a.appType}`)}`}
      actions={<Button variant="outline" asChild><Link to={`/teacher/classes/${a.classId}`}>{t("platform.teacher.backToClass")}</Link></Button>}
    >
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs uppercase text-muted-foreground">{t("platform.teacher.completed")}</p><p className="font-heading text-2xl font-bold">{completed}/{students.length}</p></div>
        <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs uppercase text-muted-foreground">{t("platform.feedback.scoreConversation")}</p><p className="font-heading text-2xl font-bold">{avg("scoreConversation")}</p></div>
        <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs uppercase text-muted-foreground">{t("platform.feedback.scoreReflection")}</p><p className="font-heading text-2xl font-bold">{avg("scoreReflection")}</p></div>
        <div className="rounded-lg border border-border bg-card p-4"><p className="text-xs uppercase text-muted-foreground">{t("platform.common.cost")}</p><p className="font-heading text-2xl font-bold">{usd(cost)}</p></div>
      </div>

      {(a.instructions || a.goals.length > 0) && (
        <Panel title={t("platform.assignment.label")}>
          {a.instructions && <p className="mb-3 whitespace-pre-wrap text-sm">{a.instructions}</p>}
          {a.goals.length > 0 && <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">{a.goals.map((g, i) => <li key={i}>{g}</li>)}</ol>}
        </Panel>
      )}

      <Panel title={t("platform.teacher.tabs.students")}>
        {students.length === 0 ? <EmptyState>{t("platform.teacher.noStudents")}</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">{t("platform.common.student")}</th>
                  <th className="py-2 pr-3">{t("platform.common.status")}</th>
                  <th className="py-2 pr-3 w-40">{t("platform.assignment.progress")}</th>
                  <th className="py-2 pr-3">{t("platform.common.turns")}</th>
                  <th className="py-2 pr-3">{t("platform.common.score")}</th>
                  <th className="py-2 pr-3">{t("platform.teacher.attempts")}</th>
                  <th className="py-2 pr-3">{t("platform.common.updated")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.userId} className="border-t border-border">
                    <td className="py-2 pr-3"><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.email}</div></td>
                    <td className="py-2 pr-3"><StatusBadge status={s.session?.status ?? "todo"} /></td>
                    <td className="py-2 pr-3"><Progress value={s.session?.progress ?? 0} /></td>
                    <td className="py-2 pr-3">{s.session?.turns ?? "–"}</td>
                    <td className="py-2 pr-3">{s.session?.scoreConversation ?? "–"} / {s.session?.scoreReflection ?? "–"}</td>
                    <td className="py-2 pr-3">{s.attemptCount}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{formatDate(s.session?.updatedAt, i18n.language)}</td>
                    <td className="py-2 text-right">{s.session && <Link to={`/sessions/${s.session.id}`} className="text-primary hover:underline">{t("platform.common.open")}</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </DashboardLayout>
  );
};

export default AssignmentProgressPage;
