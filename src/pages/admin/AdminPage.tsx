import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Circle, Plus, RotateCw, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ClassInfo, Invite, Role, User } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { DashboardLayout, EmptyState, formatDate, Panel, Spinner, StatTile, usd } from "../dashboard/common";
import { ClassCreateDialog, ClassGrid, ConfirmButton } from "../dashboard/TeacherPages";
import InviteForm from "../dashboard/InviteForm";
import { LOCALES } from "../auth/AuthPages";
import AdminAI from "./AdminAI";
import AdminCosts from "./AdminCosts";

interface Overview {
  users: Record<Role, number>; classes: number; assignments: number; sessions: number; pendingInvites: number; providers: number;
  monthSpendUsd: number; todaySpendUsd: number; monthBudgetUsd: number; budgetExceeded: boolean; requestsToday: number; errorsToday: number;
  mailConfigured: boolean; routingComplete: boolean;
}

// ---------- overview ----------
const OverviewTab = () => {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ["overview"], queryFn: () => api.get<Overview>("/api/admin/overview") });
  if (!q.data) return <Spinner />;
  const o = q.data;
  const steps = [
    { done: o.providers > 0, label: t("platform.admin.overview.stepProvider"), tab: "ai" },
    { done: o.routingComplete, label: t("platform.admin.overview.stepRouting"), tab: "ai" },
    { done: o.mailConfigured, label: t("platform.admin.overview.stepMail"), tab: "settings" },
    { done: o.users.teacher > 0, label: t("platform.admin.overview.stepTeachers"), tab: "users" },
    { done: o.classes > 0, label: t("platform.admin.overview.stepClasses"), tab: "classes" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t("platform.admin.overview.teachers")} value={o.users.teacher} hint={t("platform.admin.overview.admins", { count: o.users.admin })} />
        <StatTile label={t("platform.admin.overview.students")} value={o.users.student} hint={t("platform.admin.overview.pending", { count: o.pendingInvites })} />
        <StatTile label={t("platform.admin.overview.classes")} value={o.classes} hint={t("platform.admin.overview.assignments", { count: o.assignments })} />
        <StatTile label={t("platform.admin.overview.sessions")} value={o.sessions} />
        <StatTile label={t("platform.admin.overview.monthSpend")} value={usd(o.monthSpendUsd)} hint={o.monthBudgetUsd > 0 ? t("platform.admin.costs.ofBudget", { budget: usd(o.monthBudgetUsd) }) : t("platform.admin.costs.noBudget")} tone={o.budgetExceeded ? "warn" : undefined} />
        <StatTile label={t("platform.admin.overview.todaySpend")} value={usd(o.todaySpendUsd)} />
        <StatTile label={t("platform.admin.overview.requestsToday")} value={o.requestsToday} />
        <StatTile label={t("platform.admin.overview.errorsToday")} value={o.errorsToday} tone={o.errorsToday > 0 ? "warn" : undefined} />
      </div>
      <Panel title={t("platform.admin.overview.checklist")}>
        <ul className="space-y-2">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-sm">
              {s.done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              <Link to={`/admin?tab=${s.tab}`} className={s.done ? "text-muted-foreground" : "hover:text-primary"}>{s.label}</Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
};

// ---------- users ----------
type UserRow = User & { classes: number; costUsd: number };

const CreateUserDialog = ({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "teacher" as Role, locale: "it" });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("platform.admin.users.create")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {(["name", "email", "password"] as const).map((k) => (
            <div key={k} className="space-y-2">
              <Label htmlFor={`u-${k}`}>{t(`platform.auth.${k === "password" ? "newPassword" : k}`)}</Label>
              <Input id={`u-${k}`} type={k === "password" ? "password" : k === "email" ? "email" : "text"} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(["student", "teacher", "admin"] as Role[]).map((r) => <SelectItem key={r} value={r}>{t(`platform.roles.${r}`)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.locale} onValueChange={(v) => setForm({ ...form, locale: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LOCALES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={async () => {
            try {
              await api.post("/api/admin/users", form);
              toast.success(t("platform.common.saved"));
              onDone();
              onOpenChange(false);
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}>{t("platform.common.create")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const UsersTab = () => {
  const { t, i18n } = useTranslation();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  const users = useQuery({
    queryKey: ["users", q, role],
    queryFn: () => api.get<UserRow[]>(`/api/admin/users?q=${encodeURIComponent(q)}${role !== "all" ? `&role=${role}` : ""}`),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["users"] });
  const patch = async (id: number, body: object) => {
    try {
      await api.patch(`/api/admin/users/${id}`, body);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Panel
        className="xl:col-span-2"
        title={t("platform.admin.tabs.users")}
        actions={<Button size="sm" variant="outline" onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />{t("platform.admin.users.create")}</Button>}
      >
        <div className="mb-4 flex flex-wrap gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("platform.common.search")} className="max-w-xs" />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("platform.common.all")}</SelectItem>
              {(["student", "teacher", "admin"] as Role[]).map((r) => <SelectItem key={r} value={r}>{t(`platform.roles.${r}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {users.isLoading ? <Spinner /> : (users.data ?? []).length === 0 ? <EmptyState>{t("platform.admin.users.none")}</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">{t("platform.auth.name")}</th><th className="py-2 pr-3">{t("platform.invite.role")}</th>
                  <th className="py-2 pr-3">{t("platform.admin.users.classes")}</th><th className="py-2 pr-3">{t("platform.admin.users.monthCost")}</th>
                  <th className="py-2 pr-3">{t("platform.teacher.lastLogin")}</th><th className="py-2 pr-3">{t("platform.admin.users.active")}</th><th />
                </tr>
              </thead>
              <tbody>
                {users.data!.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="py-2 pr-3"><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.email}</div></td>
                    <td className="py-2 pr-3">
                      <Select value={u.role} onValueChange={(v) => void patch(u.id, { role: v })} disabled={u.id === me?.id}>
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>{(["student", "teacher", "admin"] as Role[]).map((r) => <SelectItem key={r} value={r}>{t(`platform.roles.${r}`)}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 pr-3">{u.classes}</td>
                    <td className="py-2 pr-3 tabular-nums">{usd(u.costUsd)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{formatDate(u.lastLoginAt, i18n.language)}</td>
                    <td className="py-2 pr-3"><Switch checked={u.active} disabled={u.id === me?.id} onCheckedChange={(v) => void patch(u.id, { active: v })} aria-label={t("platform.admin.users.active")} /></td>
                    <td className="py-2 text-right">
                      {u.id !== me?.id && (
                        <ConfirmButton title={t("platform.admin.users.delete", { name: u.name })} description={t("platform.admin.users.deleteText")} icon={<Trash2 className="h-4 w-4" />}
                          onConfirm={async () => { await api.del(`/api/admin/users/${u.id}`); refresh(); }} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title={t("platform.admin.users.invite")}>
        <InviteForm endpoint="/api/admin/invites" roles={["teacher", "student", "admin"]} onDone={() => void qc.invalidateQueries({ queryKey: ["invites"] })} />
      </Panel>
      <CreateUserDialog open={creating} onOpenChange={setCreating} onDone={refresh} />
    </div>
  );
};

// ---------- invites ----------
const InvitesTab = () => {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const invites = useQuery({ queryKey: ["invites"], queryFn: () => api.get<Invite[]>("/api/admin/invites") });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["invites"] });
  return (
    <Panel title={t("platform.admin.tabs.invites")}>
      {invites.isLoading ? <Spinner /> : (invites.data ?? []).length === 0 ? <EmptyState>{t("platform.admin.invites.none")}</EmptyState> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-2 pr-3">{t("platform.auth.email")}</th><th className="py-2 pr-3">{t("platform.invite.role")}</th><th className="py-2 pr-3">{t("platform.admin.invites.class")}</th><th className="py-2 pr-3">{t("platform.admin.invites.by")}</th><th className="py-2 pr-3">{t("platform.common.status")}</th><th /></tr>
            </thead>
            <tbody>
              {invites.data!.map((inv) => {
                const expired = new Date(inv.expiresAt) < new Date();
                return (
                  <tr key={inv.id} className="border-t border-border">
                    <td className="py-2 pr-3 font-mono text-xs">{inv.email}</td>
                    <td className="py-2 pr-3">{t(`platform.roles.${inv.role}`)}</td>
                    <td className="py-2 pr-3">{inv.className || "–"}</td>
                    <td className="py-2 pr-3">{inv.invitedBy}</td>
                    <td className="py-2 pr-3 text-xs">
                      {inv.acceptedAt ? <span className="text-primary">{t("platform.admin.invites.accepted", { date: formatDate(inv.acceptedAt, i18n.language) })}</span>
                        : expired ? <span className="text-amber-400">{t("platform.admin.invites.expired")}</span>
                        : <span>{inv.emailSent ? t("platform.invite.emailSent") : t("platform.invite.emailNotSent")}</span>}
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {!inv.acceptedAt && (
                        <Button size="icon" variant="ghost" title={t("platform.admin.invites.resend")} onClick={async () => {
                          const r = await api.post<Invite>(`/api/admin/invites/${inv.id}/resend`);
                          if (!r.emailSent && r.link) {
                            await navigator.clipboard.writeText(r.link).catch(() => undefined);
                            toast.info(t("platform.admin.invites.linkCopied"));
                          } else toast.success(t("platform.invite.emailSent"));
                          refresh();
                        }}><RotateCw className="h-4 w-4" /></Button>
                      )}
                      <ConfirmButton title={t("platform.admin.invites.delete")} icon={<Trash2 className="h-4 w-4" />} onConfirm={async () => { await api.del(`/api/admin/invites/${inv.id}`); refresh(); }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
};

// ---------- classes ----------
const ClassesTab = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState<string>("");
  const classes = useQuery({ queryKey: ["classes", "all"], queryFn: () => api.get<ClassInfo[]>("/api/classes") });
  const teachers = useQuery({ queryKey: ["users", "", "teacher"], queryFn: () => api.get<UserRow[]>("/api/admin/users?role=teacher") });
  return (
    <Panel
      title={t("platform.admin.tabs.classes")}
      actions={
        <div className="flex gap-2">
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger className="h-9 w-48"><SelectValue placeholder={t("platform.admin.classes.ownerMe")} /></SelectTrigger>
            <SelectContent>{(teachers.data ?? []).map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />{t("platform.teacher.newClass")}</Button>
        </div>
      }
    >
      {classes.isLoading ? <Spinner /> : <ClassGrid classes={classes.data ?? []} />}
      <ClassCreateDialog open={open} onOpenChange={setOpen} ownerId={owner ? Number(owner) : undefined} onCreated={() => void qc.invalidateQueries({ queryKey: ["classes"] })} />
    </Panel>
  );
};

// ---------- settings ----------
interface General { siteName: string; defaultLocale: string; publicUrl: string; guestAccess: boolean; guestLive: boolean; guestRequestsPerHour: number; studentRequestsPerDay: number; allowJoinByCode: boolean; liveEnabled: boolean }
interface Smtp { host: string; port: number; username: string; password?: string; from: string; security: string }
interface Budget { monthlyUsd: number; warnPercent: number; blockPaidWhenExceeded: boolean }
interface AllSettings { general: General; smtp: Smtp; smtpHasPassword: boolean; budget: Budget }

const SwitchRow = ({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
    <span><span className="block text-sm font-medium">{label}</span>{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span>
    <Switch checked={checked} onCheckedChange={onChange} />
  </label>
);

const SettingsTab = () => {
  const { t } = useTranslation();
  const { refresh: refreshAuth, user } = useAuth();
  const q = useQuery({ queryKey: ["settings-all"], queryFn: () => api.get<AllSettings>("/api/admin/settings") });
  const [general, setGeneral] = useState<General | null>(null);
  const [smtp, setSmtp] = useState<Smtp | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [testTo, setTestTo] = useState(user?.email ?? "");

  useEffect(() => {
    if (q.data) {
      setGeneral(q.data.general);
      setSmtp({ ...q.data.smtp, password: "" });
      setBudget(q.data.budget);
    }
  }, [q.data]);

  if (!general || !smtp || !budget) return <Spinner />;
  const save = async (key: string, body: object) => {
    try {
      await api.put(`/api/admin/settings/${key}`, body);
      toast.success(t("platform.common.saved"));
      void refreshAuth();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title={t("platform.admin.settings.general")} actions={<Button size="sm" onClick={() => save("general", general)}>{t("platform.common.save")}</Button>}>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="g-site">{t("platform.admin.settings.siteName")}</Label><Input id="g-site" value={general.siteName} onChange={(e) => setGeneral({ ...general, siteName: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>{t("platform.admin.settings.defaultLocale")}</Label>
              <Select value={general.defaultLocale} onValueChange={(v) => setGeneral({ ...general, defaultLocale: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LOCALES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="g-url">{t("platform.admin.settings.publicUrl")}</Label>
            <Input id="g-url" value={general.publicUrl} onChange={(e) => setGeneral({ ...general, publicUrl: e.target.value })} placeholder="https://debate.scuola.it" />
            <p className="text-xs text-muted-foreground">{t("platform.admin.settings.publicUrlHint")}</p>
          </div>
          <SwitchRow label={t("platform.admin.settings.guestAccess")} hint={t("platform.admin.settings.guestAccessHint")} checked={general.guestAccess} onChange={(v) => setGeneral({ ...general, guestAccess: v })} />
          <SwitchRow label={t("platform.admin.settings.liveEnabled")} checked={general.liveEnabled} onChange={(v) => setGeneral({ ...general, liveEnabled: v })} />
          <SwitchRow label={t("platform.admin.settings.guestLive")} hint={t("platform.admin.settings.guestLiveHint")} checked={general.guestLive} onChange={(v) => setGeneral({ ...general, guestLive: v })} />
          <SwitchRow label={t("platform.admin.settings.joinByCode")} checked={general.allowJoinByCode} onChange={(v) => setGeneral({ ...general, allowJoinByCode: v })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="g-gr">{t("platform.admin.settings.guestRate")}</Label><Input id="g-gr" type="number" min={0} value={general.guestRequestsPerHour} onChange={(e) => setGeneral({ ...general, guestRequestsPerHour: Number(e.target.value) })} /></div>
            <div className="space-y-2"><Label htmlFor="g-sr">{t("platform.admin.settings.studentRate")}</Label><Input id="g-sr" type="number" min={0} value={general.studentRequestsPerDay} onChange={(e) => setGeneral({ ...general, studentRequestsPerDay: Number(e.target.value) })} /></div>
          </div>
        </div>
      </Panel>

      <div className="space-y-6">
        <Panel title={t("platform.admin.settings.budget")} actions={<Button size="sm" onClick={() => save("budget", budget)}>{t("platform.common.save")}</Button>}>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="b-m">{t("platform.admin.settings.monthlyBudget")}</Label><Input id="b-m" type="number" min={0} step="1" value={budget.monthlyUsd} onChange={(e) => setBudget({ ...budget, monthlyUsd: Number(e.target.value) })} /></div>
              <div className="space-y-2"><Label htmlFor="b-w">{t("platform.admin.settings.warnPercent")}</Label><Input id="b-w" type="number" min={1} max={100} value={budget.warnPercent} onChange={(e) => setBudget({ ...budget, warnPercent: Number(e.target.value) })} /></div>
            </div>
            <SwitchRow label={t("platform.admin.settings.blockPaid")} hint={t("platform.admin.settings.blockPaidHint")} checked={budget.blockPaidWhenExceeded} onChange={(v) => setBudget({ ...budget, blockPaidWhenExceeded: v })} />
          </div>
        </Panel>

        <Panel title={t("platform.admin.settings.email")} actions={<Button size="sm" onClick={() => save("smtp", smtp)}>{t("platform.common.save")}</Button>}>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="s-h">{t("platform.admin.settings.smtpHost")}</Label><Input id="s-h" value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} placeholder="smtp.gmail.com" /></div>
              <div className="space-y-2"><Label htmlFor="s-p">{t("platform.admin.settings.smtpPort")}</Label><Input id="s-p" type="number" value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="s-u">{t("platform.admin.settings.smtpUser")}</Label><Input id="s-u" value={smtp.username} onChange={(e) => setSmtp({ ...smtp, username: e.target.value })} autoComplete="off" /></div>
              <div className="space-y-2"><Label htmlFor="s-pw">{t("platform.admin.settings.smtpPassword")}</Label><Input id="s-pw" type="password" value={smtp.password ?? ""} onChange={(e) => setSmtp({ ...smtp, password: e.target.value })} placeholder={q.data?.smtpHasPassword ? "••••••••" : ""} autoComplete="new-password" /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="s-f">{t("platform.admin.settings.smtpFrom")}</Label><Input id="s-f" value={smtp.from} onChange={(e) => setSmtp({ ...smtp, from: e.target.value })} placeholder='DebateAI <noreply@scuola.it>' /></div>
              <div className="space-y-2">
                <Label>{t("platform.admin.settings.smtpSecurity")}</Label>
                <Select value={smtp.security} onValueChange={(v) => setSmtp({ ...smtp, security: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="starttls">STARTTLS (587)</SelectItem><SelectItem value="tls">SSL/TLS (465)</SelectItem><SelectItem value="none">{t("platform.admin.settings.none")}</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 border-t border-border pt-3">
              <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} type="email" aria-label={t("platform.admin.settings.testTo")} />
              <Button variant="outline" onClick={async () => {
                try {
                  await api.post("/api/admin/smtp/test", { to: testTo });
                  toast.success(t("platform.admin.settings.testSent"));
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}><Send className="mr-2 h-4 w-4" />{t("platform.admin.settings.sendTest")}</Button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
};

const TABS = ["overview", "costs", "ai", "users", "invites", "classes", "settings"] as const;

const AdminPage = () => {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? params.get("tab")! : "overview";
  return (
    <DashboardLayout title={t("platform.admin.title")} subtitle={t("platform.admin.subtitle")}>
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          {TABS.map((k) => <TabsTrigger key={k} value={k}>{t(`platform.admin.tabs.${k}`)}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
        <TabsContent value="costs" className="mt-4"><AdminCosts /></TabsContent>
        <TabsContent value="ai" className="mt-4"><AdminAI /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
        <TabsContent value="invites" className="mt-4"><InvitesTab /></TabsContent>
        <TabsContent value="classes" className="mt-4"><ClassesTab /></TabsContent>
        <TabsContent value="settings" className="mt-4"><SettingsTab /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default AdminPage;
