import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, KeyRound, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBusyAction } from "@/hooks/useBusyAction";
import { roomApi, RoomGuest } from "@/features/room/roomApi";
import { avatarUrl } from "@/features/room/avatars";
import { StatusBadge } from "../../dashboard/common";
import ConfirmButton from "../../dashboard/ConfirmButton";

/** One guest in the lobby, with the teacher's actions: read, re-entry PIN, remove. */
const GuestCard = ({ roomId, guest, onChanged, onRead }: { roomId: number; guest: RoomGuest; onChanged: () => void; onRead: () => void }) => {
  const { t } = useTranslation();
  const { busy, run } = useBusyAction();
  const [pin, setPin] = useState<string | null>(null);

  const givePIN = () => run(async () => {
    setPin((await roomApi.pin(roomId, guest.userId)).pin);
    onChanged();
  });
  const remove = () => run(async () => {
    await roomApi.removeGuest(roomId, guest.userId);
    onChanged();
  });

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <img src={avatarUrl(guest.avatar)} alt="" width={40} height={40} className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{guest.nickname}</p>
          <p className="text-xs text-muted-foreground">{t("room.host.guestStats", { turns: guest.turns, attempts: guest.sessions })}</p>
        </div>
        {guest.status && <StatusBadge status={guest.status} />}
      </div>
      {guest.bestProgress > 0 && <Progress value={guest.bestProgress} aria-label={t("platform.assignment.progress")} />}
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={onRead} disabled={guest.sessions === 0}><Eye className="mr-1 h-4 w-4" />{t("room.host.read")}</Button>
        <Button size="sm" variant="ghost" onClick={() => void givePIN()} disabled={busy} title={t("room.host.pinHint")}><KeyRound className="mr-1 h-4 w-4" />{t("room.host.pin")}</Button>
        <span className="ml-auto">
          <ConfirmButton title={t("room.host.removeTitle", { nickname: guest.nickname })} description={t("room.host.removeText")} icon={<UserMinus className="h-4 w-4" />} onConfirm={() => void remove()} />
        </span>
      </div>
      <Dialog open={!!pin} onOpenChange={(o) => !o && setPin(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("room.host.pinTitle", { nickname: guest.nickname })}</DialogTitle>
            <DialogDescription>{t("room.host.pinText")}</DialogDescription>
          </DialogHeader>
          <p className="text-center font-mono text-6xl font-bold tracking-[0.3em]">{pin}</p>
        </DialogContent>
      </Dialog>
    </li>
  );
};

export default GuestCard;
