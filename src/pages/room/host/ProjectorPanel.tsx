import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import { Clock, Link2, Lock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/clipboard";
import { joinLink, Room } from "@/features/room/roomApi";
import { formatCountdown } from "@/features/room/useCountdown";

/**
 * What the class sees on the projector: where to go, the code, the QR, the
 * time left; and the invite link (code included) to share in a chat or the
 * school platform.
 */
const ProjectorPanel = ({ room, guests, secondsLeft }: { room: Room; guests: number; secondsLeft: number | null }) => {
  const { t } = useTranslation();
  const joinUrl = joinLink(room.code);
  return (
    <section className="grid items-center gap-6 rounded-lg border-2 border-foreground bg-card p-6 shadow-[4px_4px_0_0_hsl(var(--foreground))] md:grid-cols-[1fr_auto]">
      <div className="space-y-3 text-center md:text-left">
        <p className="text-lg">{t("room.host.goTo")} <strong className="text-primary">{window.location.host}/entra</strong></p>
        <p className="text-lg">{t("room.host.typeCode")}</p>
        <p className="font-mono text-6xl font-bold tracking-[0.2em] sm:text-7xl" aria-label={room.code.split("").join(" ")}>{room.code}</p>
        <Button variant="outline" size="sm" onClick={() => void copy(joinUrl, t("room.host.inviteCopied"))}>
          <Link2 className="mr-2 h-4 w-4" />{t("room.host.copyInvite")}
        </Button>
        <div className="flex flex-wrap justify-center gap-4 text-muted-foreground md:justify-start">
          <span className="flex items-center gap-1"><Users className="h-4 w-4" />{t("room.host.guests", { count: guests, max: room.maxGuests })}</span>
          {secondsLeft !== null && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{formatCountdown(secondsLeft)}</span>}
          {room.locked && <span className="flex items-center gap-1 text-amber-700"><Lock className="h-4 w-4" />{t("room.host.locked")}</span>}
        </div>
      </div>
      <div className="mx-auto rounded-md bg-white p-3"><QRCodeSVG value={joinUrl} size={180} aria-label={joinUrl} /></div>
    </section>
  );
};

export default ProjectorPanel;
