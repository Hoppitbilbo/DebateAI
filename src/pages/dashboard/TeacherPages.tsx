import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, CalendarClock, Copy, Eye, Pencil, Plus, RefreshCw, Trash2, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { api, Assignment, ClassInfo, Invite, Member, SessionSummary } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { AppName, DashboardLayout, EmptyState, formatDate, Panel, Spinner, StatusBadge, usd } from "./common";
import AssignmentForm from "./AssignmentForm";
import InviteForm, { copy } from "./InviteForm";

// ---------- confirm helper ----------
export const ConfirmButton = ({ label, title, description, onConfirm, icon, variant = "ghost" }: {
  label?: string; title: string; description?: string; onConfirm: () => void; icon?: React.ReactNode; variant?: "ghost" | "outline" | "destructive";
}) => {
  const { t } = useTranslation();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size={label ? "sm" : "icon"} variant={variant} aria-label={title}>{icon}{label && <span className={icon ? "ml-2" : ""}>{label}</span>}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("platform.common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t("platform.common.confirm")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// ---------- class list ----------
export const ClassCreateDialog = ({ open, onOpenChange, onCreated, ownerId }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (c: ClassInfo) => void; ownerId?: number }) => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("platform.teacher.newClass")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label htmlFor="c-name">{t("platform.teacher.className")}</Label><Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="3A - Storia" /></div>
          <div className="space-y-2"><Label htmlFor="c-desc">{t("platform.teacher.classDescription")}</Label><Textarea id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button
            disabled={!name.trim()}
            onClick={async () => {
              try {
                const c = await api.post<ClassInfo>("/api/classes", { name, description, ownerId });
                onCreated(c);
                setName("");
                setDescription("");
                onOpenChange(false);
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            {t("platform.common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ClassGrid = ({ classes }: { classes: ClassInfo[] }) => {
  const { t } = useTranslation();
  if (classes.length === 0) return <EmptyState>{t("platform.teacher.noClasses")}</EmptyState>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {classes.map((c) => (
        <Link key={c.id} to={`/teacher/classes/${c.id}`} className={cn("rounded-lg border border-border bg-card p-5 transition hover:border-primary", c.archived && "opacity-60")}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold">{c.name}</h3>
            {c.archived && <Badge variant="outline">{t("platform.teacher.archived")}</Badge>}
          </div>
          {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>{t("platform.teacher.studentsCount", { count: c.studentCount })}</span>
            <span>{t("platform.teacher.assignmentsCount", { count: c.assignmentCount })}</span>
            {c.ownerName && <span>{c.ownerName}</span>}
          </div>
        </Link>
      ))}
    </div>
  );
};

export const TeacherDashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const classes = useQuery({ queryKey: ["classes", "mine"], queryFn: () => api.get<ClassInfo[]>("/api/classes?mine=1") });
  return (
    <DashboardLayout
      title={t("platform.teacher.title")}
      subtitle={t("platform.teacher.subtitle", { name: user?.name })}
      actions={<Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />{t("platform.teacher.newClass")}</Button>}
    >
      {classes.isLoading ? <Spinner /> : <ClassGrid classes={classes.data ?? []} />}
      <ClassCreateDialog open={open} onOpenChange={setOpen} onCreated={() => void qc.invalidateQueries({ queryKey: ["classes"] })} />
    </DashboardLayout>
  );
};

// ---------- single class ----------
interface ClassDetail { class: ClassInfo; members: Member[]; invites: Invite[] }
interface Cell { assignmentId: number; userId: number; status: SessionSummary["status"]; progress: number; sessionId: number; score?: number; costUsd: number }

export const ClassPage = () => {
  const { id } = useParams();
  const classId = Number(id);
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "assignments";
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);

  const detail = useQuery({ queryKey: ["class", classId], queryFn: () => api.get<ClassDetail>(`/api/classes/${classId}`) });
  const assignments = useQuery({ queryKey: ["class-assignments", classId], queryFn: () => api.get<Assignment[]>(`/api/classes/${classId}/assignments`) });
  const progress = useQuery({ queryKey: ["class-progress", classId], queryFn: () => api.get<{ cells: Cell[] }>(`/api/classes/${classId}/progress`), enabled: tab === "progress" });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["class", classId] });
    void qc.invalidateQueries({ queryKey: ["class-assignments", classId] });
    void qc.invalidateQueries({ queryKey: ["class-progress", classId] });
  };

  if (detail.isLoading) return <DashboardLayout title="…"><Spinner /></DashboardLayout>;
  if (!detail.data) return <DashboardLayout title={t("platform.errors.notFound")}><EmptyState>{t("platform.errors.notFound")}</EmptyState></DashboardLayout>;
  const { class: cls, members, invites } = detail.data;
  const students = members.filter((m) => m.role === "student");
  const joinLink = `${window.location.origin}/student?join=${cls.joinCode}`;

  return (
    <DashboardLayout
      title={cls.name}
      subtitle={cls.description}
      actions={
        <>
          <Button variant="outline" asChild><Link to="/teacher">{t("platform.teacher.allClasses")}</Link></Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="mr-2 h-4 w-4" />{t("platform.teacher.newAssignment")}</Button>
        </>
      }
    >
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList>
          <TabsTrigger value="assignments">{t("platform.teacher.tabs.assignments")}</TabsTrigger>
          <TabsTrigger value="students">{t("platform.teacher.tabs.students")} ({students.length})</TabsTrigger>
          <TabsTrigger value="progress">{t("platform.teacher.tabs.progress")}</TabsTrigger>
          <TabsTrigger value="settings">{t("platform.teacher.tabs.settings")}</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="mt-4 space-y-3">
          {assignments.isLoading ? <Spinner /> : (assignments.data ?? []).length === 0 ? <EmptyState>{t("platform.teacher.noAssignments")}</EmptyState> : (
            assignments.data!.map((a) => (
              <div key={a.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{a.title}</h3>
                    {!a.published && <Badge variant="outline">{t("platform.teacher.draft")}</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <AppName type={a.appType} />
                    {a.goals.length > 0 && <span>{t("platform.teacher.goalsCount", { count: a.goals.length })}</span>}
                    {a.dueAt && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{formatDate(a.dueAt, i18n.language)}</span>}
                  </div>
                </div>
                {a.stats && (
                  <div className="w-full md:w-48">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>{t("platform.teacher.completedOf", { done: a.stats.completed, total: a.stats.students })}</span>
                    </div>
                    <Progress value={a.stats.students ? (a.stats.completed / a.stats.students) * 100 : 0} />
                  </div>
                )}
                <div className="flex gap-1">
                  <Button size="sm" asChild><Link to={`/teacher/assignments/${a.id}`}><Eye className="mr-2 h-4 w-4" />{t("platform.teacher.progress")}</Link></Button>
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(a); setFormOpen(true); }} aria-label={t("platform.common.edit")}><Pencil className="h-4 w-4" /></Button>
                  <ConfirmButton
                    title={t("platform.teacher.deleteAssignment")}
                    description={t("platform.teacher.deleteAssignmentText")}
                    icon={<Trash2 className="h-4 w-4" />}
                    onConfirm={async () => { await api.del(`/api/assignments/${a.id}`); refresh(); }}
                  />
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title={t("platform.teacher.members")} className="lg:col-span-2">
              {members.length === 0 ? <EmptyState>{t("platform.teacher.noStudents")}</EmptyState> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr><th className="py-2 pr-3">{t("platform.auth.name")}</th><th className="py-2 pr-3">{t("platform.auth.email")}</th><th className="py-2 pr-3">{t("platform.invite.role")}</th><th className="py-2 pr-3">{t("platform.teacher.lastLogin")}</th><th /></tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.userId} className="border-t border-border">
                          <td className="py-2 pr-3 font-medium">{m.name}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{m.email}</td>
                          <td className="py-2 pr-3">{t(`platform.roles.${m.role}`)}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{formatDate(m.lastLoginAt, i18n.language)}</td>
                          <td className="py-2 text-right">
                            <ConfirmButton title={t("platform.teacher.removeMember", { name: m.name })} icon={<UserMinus className="h-4 w-4" />} onConfirm={async () => { await api.del(`/api/classes/${classId}/members/${m.userId}`); refresh(); }} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {invites.length > 0 && (
                <div className="mt-6">
                  <h3 className="mb-2 text-sm font-semibold">{t("platform.teacher.pendingInvites")}</h3>
                  <ul className="space-y-1 text-sm">
                    {invites.map((inv) => (
                      <li key={inv.id} className="flex flex-wrap justify-between gap-2 rounded border border-border p-2">
                        <span className="font-mono">{inv.email}</span>
                        <span className="text-xs text-muted-foreground">{inv.emailSent ? t("platform.invite.emailSent") : t("platform.invite.emailNotSent")} · {t("platform.invite.expires", { date: formatDate(inv.expiresAt, i18n.language) })}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
            <div className="space-y-6">
              <Panel title={t("platform.teacher.inviteStudents")}>
                <InviteForm endpoint={`/api/classes/${classId}/invite`} roles={["student", "teacher"]} onDone={refresh} />
              </Panel>
              <Panel title={t("platform.teacher.joinCode")}>
                <p className="mb-3 text-sm text-muted-foreground">{t("platform.teacher.joinCodeHint")}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-background px-3 py-2 text-center font-mono text-2xl tracking-widest text-primary">{cls.joinCode}</code>
                  <Button size="icon" variant="outline" onClick={() => copy(cls.joinCode ?? "", t("platform.common.copied"))} aria-label={t("platform.common.copy")}><Copy className="h-4 w-4" /></Button>
                  <ConfirmButton title={t("platform.teacher.regenerateCode")} variant="outline" icon={<RefreshCw className="h-4 w-4" />} onConfirm={async () => { await api.post(`/api/classes/${classId}/code`); refresh(); }} />
                </div>
                <Button variant="link" className="px-0" onClick={() => copy(joinLink, t("platform.common.copied"))}>{t("platform.teacher.copyJoinLink")}</Button>
              </Panel>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="progress" className="mt-4">
          <Panel title={t("platform.teacher.progressMatrix")}>
            {progress.isLoading || assignments.isLoading ? <Spinner /> : students.length === 0 || (assignments.data ?? []).length === 0 ? <EmptyState>{t("platform.teacher.matrixEmpty")}</EmptyState> : (
              <div className="overflow-x-auto">
                <table className="text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-card py-2 pr-4 text-left">{t("platform.common.student")}</th>
                      {assignments.data!.map((a) => (
                        <th key={a.id} className="max-w-[140px] px-2 py-2 text-left align-bottom text-xs font-medium text-muted-foreground">
                          <Link to={`/teacher/assignments/${a.id}`} className="line-clamp-2 hover:text-primary">{a.title}</Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.userId} className="border-t border-border">
                        <td className="sticky left-0 bg-card py-2 pr-4 font-medium">{s.name}</td>
                        {assignments.data!.map((a) => {
                          const c = progress.data?.cells.find((x) => x.userId === s.userId && x.assignmentId === a.id);
                          return (
                            <td key={a.id} className="px-2 py-1.5">
                              {c ? (
                                <Link to={`/sessions/${c.sessionId}`} className={cn("block rounded px-2 py-1 text-center text-xs font-semibold",
                                  c.status === "completed" || c.status === "goal_reached" ? "bg-primary text-primary-foreground" : "bg-sky-500/20 text-sky-200")}
                                  title={t(`platform.status.${c.status}`)}>
                                  {c.progress}%{c.score !== undefined ? ` · ${c.score}` : ""}
                                </Link>
                              ) : <span className="block text-center text-muted-foreground">–</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-muted-foreground">{t("platform.teacher.matrixLegend")}</p>
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <ClassSettings cls={cls} onChanged={refresh} />
        </TabsContent>
      </Tabs>

      <AssignmentForm classId={classId} open={formOpen} onOpenChange={setFormOpen} initial={editing} onSaved={refresh} />
    </DashboardLayout>
  );
};

const ClassSettings = ({ cls, onChanged }: { cls: ClassInfo; onChanged: () => void }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(cls.name);
  const [description, setDescription] = useState(cls.description);
  return (
    <Panel title={t("platform.teacher.tabs.settings")} className="max-w-2xl">
      <div className="space-y-3">
        <div className="space-y-2"><Label htmlFor="cs-name">{t("platform.teacher.className")}</Label><Input id="cs-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="cs-desc">{t("platform.teacher.classDescription")}</Label><Textarea id="cs-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={async () => { await api.patch(`/api/classes/${cls.id}`, { name, description }); toast.success(t("platform.common.saved")); onChanged(); }}>{t("platform.common.save")}</Button>
          <Button variant="outline" onClick={async () => { await api.patch(`/api/classes/${cls.id}`, { archived: !cls.archived }); onChanged(); }}>
            <Archive className="mr-2 h-4 w-4" /> {cls.archived ? t("platform.teacher.unarchive") : t("platform.teacher.archive")}
          </Button>
          <ConfirmButton
            variant="destructive"
            label={t("platform.teacher.deleteClass")}
            title={t("platform.teacher.deleteClass")}
            description={t("platform.teacher.deleteClassText")}
            onConfirm={async () => { await api.del(`/api/classes/${cls.id}`); window.location.href = "/teacher"; }}
          />
        </div>
      </div>
    </Panel>
  );
};

// ---------- assignment progress ----------
interface ProgressRow { userId: number; name: string; email: string; session?: SessionSummary; attemptCount: number }

export const AssignmentProgressPage = () => {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const q = useQuery({ queryKey: ["assignment-progress", id], queryFn: () => api.get<{ assignment: Assignment; students: ProgressRow[] }>(`/api/assignments/${id}/progress`), refetchInterval: 20000 });
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
