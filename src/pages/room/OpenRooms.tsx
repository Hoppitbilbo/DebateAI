import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Clock, Users, Zap } from "lucide-react";
import { REFRESH_MS, roomApi } from "@/features/room/roomApi";
import { formatCountdown, useCountdown } from "@/features/room/useCountdown";
import type { Room } from "@/features/room/roomApi";
import { Panel } from "../dashboard/common";

const RoomLink = ({ room }: { room: Room }) => {
  const { t } = useTranslation();
  const left = useCountdown(room.expiresAt);
  return (
    <li>
      <Link to={`/aula/gestisci/${room.id}`} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3 hover:border-primary">
        <Zap className="h-4 w-4 text-primary" />
        <span className="font-medium">{room.title || t(`platform.appNames.${room.appType}`)}</span>
        <span className="font-mono text-sm">{room.code}</span>
        <span className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-4 w-4" />{room.guestCount}</span>
          {left !== null && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{formatCountdown(left)}</span>}
        </span>
      </Link>
    </li>
  );
};

/** The teacher's rooms that are still open, on top of the dashboard. */
const OpenRooms = () => {
  const { t } = useTranslation();
  const rooms = useQuery({ queryKey: ["rooms", "mine"], queryFn: roomApi.listMine, refetchInterval: REFRESH_MS.openRooms });
  if (!rooms.data?.length) return null;
  return (
    <Panel title={t("room.dashboard.openRooms")}>
      <ul className="space-y-2">{rooms.data.map((r) => <RoomLink key={r.id} room={r} />)}</ul>
    </Panel>
  );
};

export default OpenRooms;
