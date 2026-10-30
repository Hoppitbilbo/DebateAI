import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import { Link2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copy } from "@/lib/clipboard";
import { apiErrorText } from "@/lib/apiErrorText";
import { enrollLink } from "@/features/teacher/teacherApi";
import { useBusyAction } from "@/hooks/useBusyAction";
import { Panel } from "../common";
import ConfirmButton from "../ConfirmButton";

interface ClassEnrollLinkProps {
  joinCode: string;
  onRegenerate: () => Promise<void>;
}

/**
 * The sign-up link of a username class, to share or show as a QR. The long
 * code inside it is not meant to be typed, so it is never shown on its own.
 */
const ClassEnrollLink = ({ joinCode, onRegenerate }: ClassEnrollLinkProps) => {
  const { t } = useTranslation();
  const { busy, run, error } = useBusyAction((e) => apiErrorText(e, t), { inline: true });
  const link = enrollLink(joinCode);
  return (
    <Panel title={t("platform.teacher.enrollLink.title")}>
      <p className="mb-3 text-sm text-muted-foreground">{t("platform.teacher.enrollLink.hint")}</p>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="enroll-link" className="sr-only">{t("platform.teacher.enrollLink.title")}</Label>
          <Input id="enroll-link" readOnly value={link} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        </div>
        <Button className="w-full" onClick={() => void copy(link, t("platform.common.copied"))} disabled={busy}>
          <Link2 className="mr-2 h-4 w-4" aria-hidden />{t("platform.teacher.enrollLink.copy")}
        </Button>
        <figure className="mx-auto w-fit rounded-md bg-white p-3">
          <QRCodeSVG value={link} size={180} role="img" aria-label={t("platform.teacher.enrollLink.qr")} />
        </figure>
        <ConfirmButton
          variant="outline"
          label={t("platform.teacher.enrollLink.regenerate")}
          title={t("platform.teacher.enrollLink.regenerateTitle")}
          description={t("platform.teacher.enrollLink.regenerateText")}
          icon={busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          disabled={busy}
          onConfirm={() => void run(onRegenerate)}
        />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </Panel>
  );
};

export default ClassEnrollLink;
