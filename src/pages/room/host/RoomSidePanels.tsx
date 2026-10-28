import { useTranslation } from "react-i18next";
import { Copy, FileDown, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/clipboard";
import { formatDate } from "@/lib/format";
import { useBusyAction } from "@/hooks/useBusyAction";
import { hostLink, Room, roomApi } from "@/features/room/roomApi";
import { AppName, Panel } from "../../dashboard/common";

/** Saving the work before the room closes: Excel, the encrypted file, or an import. */
export const ResultsPanel = ({ room, canImport, onImport }: { room: Room; canImport: boolean; onImport: () => void }) => {
  const { t, i18n } = useTranslation();
  const { busy, run } = useBusyAction();
  return (
    <Panel title={t("room.host.resultsTitle")}>
      <p className="mb-3 text-sm text-muted-foreground">{t("room.host.resultsText")}</p>
      <div className="flex flex-col gap-2">
        <Button variant="outline" disabled={busy} onClick={() => void run(() => roomApi.downloadXLSX(room.id, i18n.language))}><FileSpreadsheet className="mr-2 h-4 w-4" />{t("room.host.downloadXlsx")}</Button>
        <Button variant="outline" disabled={busy} onClick={() => void run(() => roomApi.downloadFile(room.id))}><FileDown className="mr-2 h-4 w-4" />{t("room.host.downloadFile")}</Button>
        {canImport && <Button onClick={onImport} disabled={room.guestCount === 0}>{t("room.host.importIntoClass")}</Button>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{canImport ? t("room.host.fileNote") : t("room.host.fileNoteAnonymous")}</p>
    </Panel>
  );
};

/** The room's activity and closing time, and the secret link to manage it elsewhere. */
export const DetailsPanel = ({ room, hostKey }: { room: Room; hostKey: string | null }) => {
  const { t, i18n } = useTranslation();
  return (
    <Panel title={t("room.host.detailsTitle")}>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("platform.common.activity")}</dt><dd><AppName type={room.appType} /></dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("room.host.endsAt")}</dt><dd>{formatDate(room.expiresAt, i18n.language)}</dd></div>
      </dl>
      {hostKey && (
        <div className="mt-4 rounded-md bg-secondary p-3 text-xs">
          <p className="mb-2">{t("room.host.keyNote")}</p>
          <Button size="sm" variant="outline" onClick={() => void copy(hostLink(room.id, hostKey), t("room.host.copied"))}>
            <Copy className="mr-2 h-4 w-4" />{t("room.host.copyLink")}
          </Button>
        </div>
      )}
    </Panel>
  );
};
