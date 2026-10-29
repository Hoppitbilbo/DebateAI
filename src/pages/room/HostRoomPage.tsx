import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, Lock, LockOpen, Trash2 } from "lucide-react";
import { appIconSrc } from "@/lib/appArt";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth";
import { useBusyAction } from "@/hooks/useBusyAction";
import { hostKeys, roomApi, roomIsGone, RoomGuest, useRoomView } from "@/features/room/roomApi";
import { useHostKey } from "@/features/room/useHostKey";
import { formatCountdown, useCountdown } from "@/features/room/useCountdown";
import { DashboardLayout, EmptyState, Panel, Spinner } from "../dashboard/common";
import ConfirmButton from "../dashboard/ConfirmButton";
import RoomImportDialog from "./RoomImportDialog";
import GuestCard from "./host/GuestCard";
import GuestConversations from "./host/GuestConversations";
import ProjectorPanel from "./host/ProjectorPanel";
import { DetailsPanel, ResultsPanel } from "./host/RoomSidePanels";

/** Seconds before the end when the teacher is reminded to save the results. */
const SAVE_REMINDER_SECONDS = 15 * 60;

/** The teacher's screen of a room: what to project, who is in, the results. */
const HostRoomPage = () => {
  const { id } = useParams();
  const roomId = Number(id);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const key = useHostKey(roomId);
  const { view, refresh } = useRoomView(roomId);
  const left = useCountdown(view.data?.room.expiresAt, view.data?.now);
  const { busy, run } = useBusyAction();
  const [reading, setReading] = useState<RoomGuest | null>(null);
  const [importing, setImporting] = useState(false);

  if (view.isLoading) return <DashboardLayout title="…"><Spinner /></DashboardLayout>;
  // "Closed" only when the server says so (or time is up); a network
  // problem keeps the last view and keeps retrying.
  if (!view.data && !roomIsGone(view.error)) {
    return (
      <DashboardLayout title="…">
        <EmptyState>
          {t("room.host.loadFailed")}{" "}
          <Button variant="outline" size="sm" onClick={refresh}>{t("platform.activity.retry")}</Button>
        </EmptyState>
      </DashboardLayout>
    );
  }
  if (roomIsGone(view.error) || !view.data || left === 0) {
    return (
      <DashboardLayout title={t("room.host.closedTitle")}>
        <EmptyState>{t("room.host.closedText")} <Link to="/aula/nuova" className="text-primary underline">{t("room.host.openAnother")}</Link></EmptyState>
      </DashboardLayout>
    );
  }
  const { room, guests } = view.data;
  const isTeacher = !!user && user.role !== "student";
  const toggleLock = () => run(async () => {
    await roomApi.setLocked(roomId, !room.locked);
    refresh();
  });
  const end = () => run(async () => {
    await roomApi.end(roomId);
    hostKeys.forget(roomId);
    navigate("/aula/nuova", { replace: true });
  });

  return (
    <DashboardLayout
      title={room.title || t(`platform.appNames.${room.appType}`)}
      subtitle={t("room.host.subtitle")}
      actions={
        <>
          <Button variant="outline" onClick={() => void toggleLock()} disabled={busy}>
            {room.locked ? <LockOpen className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}{room.locked ? t("room.host.unlock") : t("room.host.lock")}
          </Button>
          <ConfirmButton variant="destructive" label={t("room.host.end")} title={t("room.host.endTitle")} description={t("room.host.endText")} icon={<Trash2 className="h-4 w-4" />} onConfirm={() => void end()} />
        </>
      }
    >
      {view.isError && (
        <p role="status" className="flex items-center gap-2 rounded-md border border-border bg-muted p-3 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0" />{t("room.host.connectionLost")}
        </p>
      )}

      {left !== null && left <= SAVE_REMINDER_SECONDS && (
        <p role="status" className="flex items-center gap-2 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />{t("room.host.saveReminder", { time: formatCountdown(left) })}
        </p>
      )}

      {!view.data.aiReady && (
        <p role="alert" className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />{t("room.host.aiMissing")}
        </p>
      )}

      <ProjectorPanel room={room} guests={guests.length} secondsLeft={left} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title={t("room.host.lobby")} className="lg:col-span-2">
          {guests.length === 0 ? <EmptyState>{t("room.host.empty")}</EmptyState> : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {guests.map((g) => <GuestCard key={g.userId} roomId={roomId} guest={g} onChanged={refresh} onRead={() => setReading(g)} />)}
            </ul>
          )}
        </Panel>
        <div className="space-y-6">
          {view.data.activities?.length > 1 && (
            <Panel title={t("room.host.pathTitle", { count: view.data.activities.length })}>
              <ol className="space-y-2">
                {view.data.activities.map((a, i) => (
                  <li key={a.assignmentId} className="flex items-center gap-2 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-foreground bg-sun text-xs font-bold">{i + 1}</span>
                    <img src={appIconSrc(a.appType)} alt="" width={24} height={24} className="h-6 w-6" />
                    <span className="min-w-0 truncate">{a.title}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          )}
          <ResultsPanel room={room} canImport={isTeacher} onImport={() => setImporting(true)} />
          <DetailsPanel room={room} hostKey={key} />
        </div>
      </div>

      {reading && <GuestConversations roomId={roomId} guest={reading} onClose={() => setReading(null)} />}
      {isTeacher && (
        <RoomImportDialog
          open={importing}
          onOpenChange={setImporting}
          source={{ kind: "room", roomId, hostKey: key ?? undefined, guests: guests.map((g) => ({ nickname: g.nickname, avatar: g.avatar, sessions: g.sessions })) }}
          onDone={(classId, r) => {
            toast.success(t("room.import.done", { sessions: r.sessions, students: r.students }));
            hostKeys.forget(roomId);
            navigate(`/teacher/classes/${classId}?tab=progress`);
          }}
        />
      )}
    </DashboardLayout>
  );
};

export default HostRoomPage;
