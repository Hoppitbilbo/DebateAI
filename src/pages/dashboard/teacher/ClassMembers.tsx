import { useTranslation } from "react-i18next";
import { Copy, RefreshCw, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClassDetail } from "@/features/teacher/teacherApi";
import { EmptyState, formatDate, Panel } from "../common";
import ConfirmButton from "../ConfirmButton";
import InviteForm, { copy } from "../InviteForm";

interface ClassMembersProps {
  detail: ClassDetail;
  onRemoveMember: (userId: number) => Promise<void>;
  onRegenerateCode: () => Promise<void>;
  onInvited: () => void;
}

/** Members, pending invites, the invite form and the join code of a class. */
const ClassMembers = ({ detail, onRemoveMember, onRegenerateCode, onInvited }: ClassMembersProps) => {
  const { t, i18n } = useTranslation();
  const { class: cls, members, invites } = detail;
  const classId = cls.id;
  const joinLink = `${window.location.origin}/student?join=${cls.joinCode}`;
  return (
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
                      <ConfirmButton title={t("platform.teacher.removeMember", { name: m.name })} icon={<UserMinus className="h-4 w-4" />} onConfirm={() => onRemoveMember(m.userId)} />
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
          <InviteForm endpoint={`/api/classes/${classId}/invite`} roles={["student", "teacher"]} onDone={onInvited} />
        </Panel>
        <Panel title={t("platform.teacher.joinCode")}>
          <p className="mb-3 text-sm text-muted-foreground">{t("platform.teacher.joinCodeHint")}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-background px-3 py-2 text-center font-mono text-2xl tracking-widest text-primary">{cls.joinCode}</code>
            <Button size="icon" variant="outline" onClick={() => copy(cls.joinCode ?? "", t("platform.common.copied"))} aria-label={t("platform.common.copy")}><Copy className="h-4 w-4" /></Button>
            <ConfirmButton title={t("platform.teacher.regenerateCode")} variant="outline" icon={<RefreshCw className="h-4 w-4" />} onConfirm={onRegenerateCode} />
          </div>
          <Button variant="link" className="px-0" onClick={() => copy(joinLink, t("platform.common.copied"))}>{t("platform.teacher.copyJoinLink")}</Button>
        </Panel>
      </div>
    </div>
  );
};

export default ClassMembers;
