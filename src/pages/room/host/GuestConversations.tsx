import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { roomApi, RoomGuest } from "@/features/room/roomApi";
import { avatarUrl } from "@/features/room/avatars";
import { EmptyState, Panel, Spinner, StatusBadge } from "../../dashboard/common";
import Transcript from "../../dashboard/Transcript";

/** The attempts of one guest, opened from the lobby; the latest is shown first. */
const GuestConversations = ({ roomId, guest, onClose }: { roomId: number; guest: RoomGuest; onClose: () => void }) => {
  const { t, i18n } = useTranslation();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const list = useQuery({ queryKey: ["room-guest-sessions", roomId, guest.userId], queryFn: () => roomApi.guestSessions(roomId, guest.userId) });
  const detail = useQuery({ queryKey: ["room-session", roomId, sessionId], queryFn: () => roomApi.session(roomId, sessionId!), enabled: !!sessionId });
  useEffect(() => {
    if (list.data?.length && !sessionId) setSessionId(list.data[0].id);
  }, [list.data, sessionId]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><img src={avatarUrl(guest.avatar)} alt="" className="h-8 w-8" />{guest.nickname}</DialogTitle>
          <DialogDescription>{t("room.host.conversationsText")}</DialogDescription>
        </DialogHeader>
        {list.isLoading ? <Spinner /> : !list.data?.length ? <EmptyState>{t("room.host.noAttempts")}</EmptyState> : (
          <>
            {list.data.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {list.data.map((s, i) => (
                  <Button key={s.id} size="sm" variant={s.id === sessionId ? "default" : "outline"} onClick={() => setSessionId(s.id)}>
                    {t("room.host.attempt", { n: list.data.length - i })} · {formatDate(s.startedAt, i18n.language)}
                  </Button>
                ))}
              </div>
            )}
            {detail.data ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2"><StatusBadge status={detail.data.status} /><span className="text-sm text-muted-foreground">{t("platform.common.turns")}: {detail.data.turns}</span></div>
                <Transcript messages={detail.data.transcript} studentName={guest.nickname} />
                {detail.data.reflection && <Panel title={t("platform.feedback.yourReflection")}><p className="whitespace-pre-wrap text-sm">{detail.data.reflection}</p></Panel>}
              </div>
            ) : <Spinner />}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GuestConversations;
