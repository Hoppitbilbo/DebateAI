import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CalendarClock, Play, RotateCcw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ApiError, Assignment } from "@/lib/api";
import { useJoinClass, useMyAssignments, useMyClasses, useMySessions } from "@/features/student/studentApi";
import { useAuth } from "@/context/auth";
import { APPS } from "@/features/activity/types";
import { AppName, DashboardLayout, EmptyState, Panel, Spinner, StatusBadge } from "./common";
import { formatDate } from "@/lib/format";
import { usePageTour } from "@/features/tour/tour";

const StudentDashboard = () => {
  const { t, i18n } = useTranslation();
  const { user, config } = useAuth();
  const [params] = useSearchParams();
  const [code, setCode] = useState((params.get("join") || "").toUpperCase());

  const assignments = useMyAssignments();
  const classes = useMyClasses();
  const sessions = useMySessions();
  const joinClass = useJoinClass();
  usePageTour("student");

  const join = async () => {
    try {
      const res = await joinClass(code);
      toast.success(t("platform.student.joined", { name: res.name }));
      setCode("");
    } catch (e) {
      toast.error(e instanceof ApiError && e.code === "invalid_code" ? t("platform.student.invalidCode") : String((e as Error).message));
    }
  };

  const todo = (assignments.data ?? []).filter((a) => !a.mySession || !["completed", "goal_reached"].includes(a.mySession.status));
  const done = (assignments.data ?? []).filter((a) => a.mySession && ["completed", "goal_reached"].includes(a.mySession.status));

  const AssignmentCard = ({ a }: { a: Assignment }) => {
    const overdue = a.dueAt && new Date(a.dueAt) < new Date() && !done.includes(a);
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-background/40 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">{a.className}</p>
            <h3 className="font-semibold">{a.title}</h3>
          </div>
          <StatusBadge status={a.mySession?.status ?? "todo"} />
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <AppName type={a.appType} />
          {a.dueAt && (
            <span className={overdue ? "inline-flex items-center gap-1 text-amber-400" : "inline-flex items-center gap-1"}>
              <CalendarClock className="h-3.5 w-3.5" /> {formatDate(a.dueAt, i18n.language)}
            </span>
          )}
        </div>
        {a.instructions && <p className="line-clamp-2 text-sm text-muted-foreground">{a.instructions}</p>}
        {a.mySession && <Progress value={a.mySession.progress} aria-label={t("platform.assignment.progress")} />}
        <div className="flex gap-2">
          <Button size="sm" asChild className="flex-1">
            <Link to={`${APPS[a.appType].path}?assignment=${a.id}`}>
              {a.mySession ? <RotateCcw className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {a.mySession ? t("platform.student.retry") : t("platform.student.start")}
            </Link>
          </Button>
          {a.mySession && a.mySession.turns > 0 && (
            <Button size="sm" variant="outline" asChild>
              <Link to={`/sessions/${a.mySession.id}`}><Eye className="h-4 w-4" /></Link>
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (user?.roomId) return <Navigate to="/aula" replace />; // room guests have their own page

  return (
    <DashboardLayout title={t("platform.student.title", { name: user?.name })} subtitle={t("platform.student.subtitle")}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title={t("platform.student.todo")} tour="student-todo">
            {assignments.isLoading ? <Spinner /> : todo.length === 0 ? <EmptyState>{t("platform.student.noTodo")}</EmptyState> : (
              <div className="grid gap-4 md:grid-cols-2">{todo.map((a) => <AssignmentCard key={a.id} a={a} />)}</div>
            )}
          </Panel>
          {done.length > 0 && (
            <Panel title={t("platform.student.done")}>
              <div className="grid gap-4 md:grid-cols-2">{done.map((a) => <AssignmentCard key={a.id} a={a} />)}</div>
            </Panel>
          )}
          <Panel title={t("platform.student.history")} tour="student-history">
            {sessions.isLoading ? <Spinner /> : (sessions.data ?? []).length === 0 ? <EmptyState>{t("platform.student.noHistory")}</EmptyState> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">{t("platform.common.date")}</th>
                      <th className="py-2 pr-3">{t("platform.common.activity")}</th>
                      <th className="py-2 pr-3">{t("platform.common.status")}</th>
                      <th className="py-2 pr-3">{t("platform.common.score")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.data!.map((s) => (
                      <tr key={s.id} className="border-t border-border">
                        <td className="py-2 pr-3 whitespace-nowrap">{formatDate(s.startedAt, i18n.language)}</td>
                        <td className="py-2 pr-3">
                          <div className="font-medium">{s.assignmentTitle || s.title}</div>
                          <div className="text-xs text-muted-foreground"><AppName type={s.appType} /></div>
                        </td>
                        <td className="py-2 pr-3"><StatusBadge status={s.status} /></td>
                        <td className="py-2 pr-3">{s.scoreConversation ?? "–"}{s.scoreReflection !== undefined ? ` / ${s.scoreReflection}` : ""}</td>
                        <td className="py-2 text-right"><Link className="text-primary hover:underline" to={`/sessions/${s.id}`}>{t("platform.common.open")}</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          {config?.allowJoinByCode && (
            <Panel title={t("platform.student.joinTitle")} tour="join-class">
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void join(); }}>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={8} aria-label={t("platform.student.classCode")} />
                <Button type="submit" disabled={code.length < 4}>{t("platform.student.join")}</Button>
              </form>
            </Panel>
          )}
          <Panel title={t("platform.student.myClasses")}>
            {classes.isLoading ? <Spinner /> : (classes.data ?? []).length === 0 ? <EmptyState>{t("platform.student.noClasses")}</EmptyState> : (
              <ul className="space-y-2">
                {classes.data!.map((c) => (
                  <li key={c.id} className="rounded-md border border-border p-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.ownerName}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={t("platform.student.freePractice")} tour="free-practice">
            <p className="mb-3 text-sm text-muted-foreground">{t("platform.student.freePracticeText")}</p>
            <Button variant="outline" asChild className="w-full"><Link to="/apps">{t("navigation.apps")}</Link></Button>
          </Panel>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StudentDashboard;
