import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Member } from "@/lib/api";
import { copy } from "@/lib/clipboard";
import { apiErrorText } from "@/lib/apiErrorText";
import { requestPasswordReset, ResetLink } from "@/features/teacher/teacherApi";
import { useBusyAction } from "@/hooks/useBusyAction";

/** Time of day in the reader's locale. */
const clock = (iso: string, locale: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

/**
 * Assisted password recovery for a student without e-mail: the teacher asks
 * for a one-time link (15 minutes) and hands it over in person. The link is
 * kept only while the dialog is open.
 */
const MemberResetLink = ({ classId, member }: { classId: number; member: Member }) => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<ResetLink | null>(null);
  const { busy, run, error, clearError } = useBusyAction((e) => apiErrorText(e, t, "platform.teacher.resetLink.errors"), { inline: true });

  const onOpenChange = (o: boolean) => {
    if (busy) return;
    setOpen(o);
    if (!o) {
      setLink(null);
      clearError();
    }
  };
  const create = () => run(async () => setLink(await requestPasswordReset(classId, member.userId)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label={t("platform.teacher.resetLink.action", { name: member.name })}>
          <KeyRound className="h-4 w-4" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("platform.teacher.resetLink.title", { name: member.name })}</DialogTitle>
          <DialogDescription>{t("platform.teacher.resetLink.inPerson")}</DialogDescription>
        </DialogHeader>
        {link ? (
          <div className="space-y-3">
            <Label htmlFor="reset-link">{t("platform.teacher.resetLink.linkLabel")}</Label>
            <div className="flex gap-2">
              <Input id="reset-link" readOnly value={link.url} className="font-mono text-xs" autoFocus onFocus={(e) => e.currentTarget.select()} />
              <Button size="icon" variant="outline" onClick={() => void copy(link.url, t("platform.common.copied"))} aria-label={t("platform.common.copy")}>
                <Copy className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <p className="text-sm">{t("platform.teacher.resetLink.expires", { time: clock(link.expiresAt, i18n.language) })}</p>
            <p className="text-xs text-muted-foreground">{t("platform.teacher.resetLink.once")}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("platform.teacher.resetLink.explain")}</p>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          {link ? (
            <Button onClick={() => onOpenChange(false)}>{t("platform.teacher.resetLink.done")}</Button>
          ) : (
            <Button onClick={() => void create()} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {t("platform.teacher.resetLink.create")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MemberResetLink;
