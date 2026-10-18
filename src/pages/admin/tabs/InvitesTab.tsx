import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInviteActions, useInvites } from "@/features/admin/adminApi";
import { EmptyState, formatDate, Panel, Spinner } from "../../dashboard/common";
import { ConfirmButton } from "../../dashboard/TeacherPages";

const InvitesTab = () => {
  const { t, i18n } = useTranslation();
  const invites = useInvites();
  const { resend, remove } = useInviteActions();
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
                          const r = await resend(inv.id);
                          if (!r.emailSent && r.link) {
                            await navigator.clipboard.writeText(r.link).catch(() => undefined);
                            toast.info(t("platform.admin.invites.linkCopied"));
                          } else toast.success(t("platform.invite.emailSent"));
                        }}><RotateCw className="h-4 w-4" /></Button>
                      )}
                      <ConfirmButton title={t("platform.admin.invites.delete")} icon={<Trash2 className="h-4 w-4" />} onConfirm={() => remove(inv.id)} />
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

export default InvitesTab;
