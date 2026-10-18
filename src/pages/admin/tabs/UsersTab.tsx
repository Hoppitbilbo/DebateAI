import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Role } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { NewUser, useInviteActions, useUserActions, useUsers } from "@/features/admin/adminApi";
import { EmptyState, Panel, Spinner } from "../../dashboard/common";
import { formatDate, usd } from "@/lib/format";
import ConfirmButton from "../../dashboard/ConfirmButton";
import InviteForm from "../../dashboard/InviteForm";
import { inviteToPlatform } from "@/features/teacher/teacherApi";
import { LOCALES } from "@/i18n/languages";

const CreateUserDialog = ({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) => {
  const { t } = useTranslation();
  const { create } = useUserActions();
  const [form, setForm] = useState<NewUser>({ name: "", email: "", password: "", role: "teacher", locale: "it" });
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
              await create(form);
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
  const { refresh: refreshInvites } = useInviteActions();
  const { update, remove, refresh } = useUserActions();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  const users = useUsers(q, role);
  const patch = async (id: number, change: Parameters<typeof update>[1]) => {
    try {
      await update(id, change);
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
                      <Select value={u.role} onValueChange={(v) => void patch(u.id, { role: v as Role })} disabled={u.id === me?.id}>
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
                          onConfirm={() => remove(u.id)} />
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
        <InviteForm invite={inviteToPlatform} roles={["teacher", "student", "admin"]} onDone={refreshInvites} />
      </Panel>
      <CreateUserDialog open={creating} onOpenChange={setCreating} onDone={refresh} />
    </div>
  );
};

export default UsersTab;
