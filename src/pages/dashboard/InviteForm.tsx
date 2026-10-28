import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Copy, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InviteResult, Role } from "@/lib/api";
import type { InviteSender } from "@/features/teacher/teacherApi";
import { useAuth } from "@/context/auth";
import { copy } from "@/lib/clipboard";
import { LOCALES } from "@/i18n/languages";
import { useBusyAction } from "@/hooks/useBusyAction";

interface Props {
  /** Who receives the invitations: a class (inviteToClass) or the platform (inviteToPlatform). */
  invite: InviteSender;
  roles: Role[];
  onDone?: () => void;
}

/** Bulk invite by e-mail. Shows registration links when SMTP is not configured. */
const InviteForm = ({ invite, roles, onDone }: Props) => {
  const { t, i18n } = useTranslation();
  const { config } = useAuth();
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<Role>(roles[0]);
  const [locale, setLocale] = useState(i18n.language.slice(0, 2));
  const { busy, run } = useBusyAction();
  const [results, setResults] = useState<InviteResult[]>([]);

  const submit = () =>
    run(async () => {
      const res = await invite({ emails: [emails], role, locale });
      setResults(res);
      const ok = res.filter((r) => r.status !== "error").length;
      toast.success(t("platform.invite.done", { count: ok }));
      setEmails("");
      onDone?.();
    });

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="emails">{t("platform.invite.emails")}</Label>
        <Textarea id="emails" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder={"mario.rossi@scuola.it\nanna.bianchi@scuola.it"} className="min-h-[100px] font-mono text-sm" />
        <p className="text-xs text-muted-foreground">{t("platform.invite.emailsHint")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {roles.length > 1 && (
          <div className="space-y-2">
            <Label>{t("platform.invite.role")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{t(`platform.roles.${r}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label>{t("platform.invite.emailLanguage")}</Label>
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{LOCALES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {!config?.mailConfigured && <p className="rounded-md bg-amber-400/10 p-2 text-xs text-amber-300">{t("platform.invite.noSmtp")}</p>}
      <Button onClick={submit} disabled={busy || !emails.trim()}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />} {t("platform.invite.send")}
      </Button>

      {results.length > 0 && (
        <ul className="space-y-1 text-sm">
          {results.map((r) => (
            <li key={r.email} className="flex flex-wrap items-center gap-2 rounded border border-border p-2">
              {r.status === "error" ? <span className="text-destructive">✕</span> : <Check className="h-4 w-4 text-primary" />}
              <span className="font-mono">{r.email}</span>
              <span className="text-muted-foreground">{t(`platform.invite.status.${r.status}`)}{r.error ? `: ${r.error}` : ""}</span>
              {r.link && !r.emailSent && (
                <Button size="sm" variant="ghost" onClick={() => copy(r.link!, t("platform.common.copied"))}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> {t("platform.invite.copyLink")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default InviteForm;
