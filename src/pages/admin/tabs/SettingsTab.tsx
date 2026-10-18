import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { Budget, General, Smtp, useSettings, useSettingsActions } from "@/features/admin/adminApi";
import { Panel, Spinner } from "../../dashboard/common";
import { LOCALES } from "../../auth/AuthPages";

const SwitchRow = ({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
    <span><span className="block text-sm font-medium">{label}</span>{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span>
    <Switch checked={checked} onCheckedChange={onChange} />
  </label>
);

const SettingsTab = () => {
  const { t } = useTranslation();
  const { refresh: refreshAuth, user } = useAuth();
  const q = useSettings();
  const { save: saveSetting, sendTestMail } = useSettingsActions();
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
  const save = async (key: Parameters<typeof saveSetting>[0], value: Parameters<typeof saveSetting>[1]) => {
    try {
      await saveSetting(key, value);
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
                  await sendTestMail(testTo);
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

export default SettingsTab;
