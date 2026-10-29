import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Clock, LogOut, Play } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import { activityPath, REFRESH_MS, RoomActivity, roomApi } from "@/features/room/roomApi";
import { appIconSrc } from "@/lib/appArt";
import { cn } from "@/lib/utils";
import { avatarUrl } from "@/features/room/avatars";
import { formatCountdown, useCountdown } from "@/features/room/useCountdown";
import { Spinner } from "../dashboard/common";
import ConfirmButton from "../dashboard/ConfirmButton";

const FINISHED = new Set(["goal_reached", "turn_limit", "completed"]);
const isDone = (a: RoomActivity) => !!a.status && FINISHED.has(a.status);

/**
 * The room's path as a trail of stops: done ones ticked, the next one
 * pulsing with a big start button, every stop open at any time.
 */
const GuestPath = ({ activities }: { activities: RoomActivity[] }) => {
  const { t } = useTranslation();
  const next = activities.findIndex((a) => !isDone(a));
  const done = activities.filter(isDone).length;
  return (
    <section className="w-full space-y-3 text-left" aria-labelledby="guest-path-title">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="guest-path-title" className="font-heading text-2xl font-semibold">{t("room.guest.pathTitle")}</h2>
        <span className="text-sm text-muted-foreground">{t("room.guest.pathDone", { done, total: activities.length })}</span>
      </div>
      <ol className="path-list space-y-3">
        {activities.map((a, i) => {
          const finished = isDone(a);
          const current = i === next;
          return (
            <li key={a.assignmentId} className="story-pop" style={{ animationDelay: `${i * 70}ms` }}>
              <div className={cn("path-stop flex items-center gap-3 p-3", current && "path-stop--open")}>
                <span className={cn("path-stop__number", finished && "bg-primary text-primary-foreground", current && "attention-pulse")} aria-hidden="true">
                  {finished ? <CheckCircle2 className="h-5 w-5" /> : i + 1}
                </span>
                <img src={appIconSrc(a.appType)} alt="" width={40} height={40} className="h-10 w-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t(`platform.appNames.${a.appType}`)}</p>
                  <p className="truncate font-semibold">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {finished ? t("room.guest.stepDone") : a.status === "active" ? t("room.guest.stepActive") : t("room.guest.stepTodo")}
                  </p>
                </div>
                <Button size={current ? "default" : "sm"} variant={current ? "default" : "outline"} asChild>
                  <Link to={activityPath(a)}>
                    {current && <Play className="mr-2 h-4 w-4" />}
                    {finished ? t("room.guest.again") : current ? t("room.guest.go") : t("room.guest.open")}
                  </Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
      {next === -1 && <p className="story-pop rounded-lg border-2 border-foreground bg-sun p-3 text-center font-semibold">{t("room.guest.allDone")}</p>}
    </section>
  );
};

/** A guest's home inside a room: who they are, what to do, how long is left. */
const GuestRoomPage = () => {
  const { t } = useTranslation();
  const { user, loading, logout } = useAuth();
  const room = useQuery({ queryKey: ["guest-room"], queryFn: roomApi.myRoom, enabled: !!user?.roomId, retry: false, refetchInterval: REFRESH_MS.guestRoom });
  const left = useCountdown(room.data?.expiresAt);

  if (loading) return <Spinner />;
  // A guest whose room ended is logged out: say so on the join page.
  if (!user?.roomId) return <Navigate to="/entra?fine=1" replace />;

  const closed = room.isError || left === 0;
  const start = room.data ? activityPath(room.data) : "#";
  const path = room.data?.activities ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 py-10 text-center">
        {room.isLoading ? <Spinner /> : closed ? (
          <>
            <h1 className="font-heading text-3xl font-bold">{t("room.guest.closedTitle")}</h1>
            <p className="text-muted-foreground">{t("room.guest.closedText")}</p>
            <Button onClick={() => void logout()} asChild><Link to="/entra">{t("room.guest.joinAnother")}</Link></Button>
          </>
        ) : room.data && (
          <>
            <img src={avatarUrl(room.data.avatar)} alt="" width={112} height={112} className="h-28 w-28" />
            <div>
              <p className="text-sm text-muted-foreground">{t("room.guest.hello")}</p>
              <h1 className="font-heading text-4xl font-bold">{room.data.nickname}</h1>
            </div>
            {path.length > 1 ? (
              <>
                {room.data.instructions && <p className="whitespace-pre-wrap">{room.data.instructions}</p>}
                <GuestPath activities={path} />
              </>
            ) : (
              <>
                <section className="w-full rounded-lg border border-border bg-card p-5 text-left shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t(`platform.appNames.${room.data.appType}`)}</p>
                  <h2 className="mt-1 font-heading text-2xl font-semibold">{room.data.title || t(`platform.appNames.${room.data.appType}`)}</h2>
                  {room.data.instructions && <p className="mt-3 whitespace-pre-wrap">{room.data.instructions}</p>}
                </section>
                <Button size="lg" asChild>
                  <Link to={start}><Play className="mr-2 h-5 w-5" />{t("room.guest.start")}</Link>
                </Button>
              </>
            )}
            {left !== null && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="off">
                <Clock className="h-4 w-4" />{t("room.guest.timeLeft", { time: formatCountdown(left) })}
              </p>
            )}
            <p className="max-w-md text-xs text-muted-foreground">{t("room.guest.dataNote")}</p>
            <ConfirmButton label={t("room.guest.leave")} title={t("room.guest.leaveTitle")} description={t("room.guest.leaveText")} icon={<LogOut className="h-4 w-4" />} onConfirm={() => void logout()} />
          </>
        )}
      </main>
    </div>
  );
};

export default GuestRoomPage;
