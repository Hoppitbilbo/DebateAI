import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { AlertTriangle, Clock, Copy, Eye, FileDown, FileSpreadsheet, KeyRound, Lock, LockOpen, Trash2, UserMinus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/auth";
import { copy } from "@/lib/clipboard";
import { formatDate } from "@/lib/format";
import { hostKeys, hostLink, joinLink, roomApi, RoomGuest, useRoomView } from "@/features/room/roomApi";
import { avatarUrl } from "@/features/room/avatars";
import { formatCountdown, useCountdown } from "@/features/room/useCountdown";
import { AppName, DashboardLayout, EmptyState, Panel, Spinner, StatusBadge } from "../dashboard/common";
import ConfirmButton from "../dashboard/ConfirmButton";
import Transcript from "../dashboard/Transcript";
import RoomImportDialog from "./RoomImportDialog";

/** Minutes before the end when the teacher is reminded to save the results. */
const SAVE_REMINDER_SECONDS = 15 * 60;

/** Reads the host key from the link fragment (#k=…) and keeps it in this browser. */
const useHostKey = (roomId: number) => {
  const { hash } = useLocation();
  const [key, setKey] = useState(() => hostKeys.get(roomId));
  useEffect(() => {
    const fromLink = new URLSearchParams(hash.slice(1)).get("k");
    if (fromLink) {
      hostKeys.save(roomId, fromLink);
      setKey(fromLink);
    }
  }, [hash, roomId]);
  return key;
};

/** The attempts of one guest, opened from the lobby. */
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

/** One guest in the lobby, with the teacher's actions. */
const GuestCard = ({ roomId, guest, onChanged, onOpen }: { roomId: number; guest: RoomGuest; onChanged: () => void; onOpen: () => void }) => {
  const { t } = useTranslation();
  const [pin, setPin] = useState<string | null>(null);
  const givePIN = async () => {
    try {
      setPin((await roomApi.pin(roomId, guest.userId)).pin);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const remove = async () => {
    try {
      await roomApi.removeGuest(roomId, guest.userId);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
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
        <Button size="sm" variant="ghost" onClick={onOpen} disabled={guest.sessions === 0}><Eye className="mr-1 h-4 w-4" />{t("room.host.read")}</Button>
        <Button size="sm" variant="ghost" onClick={() => void givePIN()} title={t("room.host.pinHint")}><KeyRound className="mr-1 h-4 w-4" />{t("room.host.pin")}</Button>
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

/** The teacher's screen of a room: what to project, who is in, results. */
const HostRoomPage = () => {
  const { id } = useParams();
  const roomId = Number(id);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const key = useHostKey(roomId);
  const { view, refresh } = useRoomView(roomId);
  const left = useCountdown(view.data?.room.expiresAt, view.data?.now);
  const [reading, setReading] = useState<RoomGuest | null>(null);
  const [importing, setImporting] = useState(false);

  if (view.isLoading) return <DashboardLayout title="…"><Spinner /></DashboardLayout>;
  if (view.isError || !view.data || left === 0) {
    return (
      <DashboardLayout title={t("room.host.closedTitle")}>
        <EmptyState>{t("room.host.closedText")} <Link to="/aula/nuova" className="text-primary underline">{t("room.host.openAnother")}</Link></EmptyState>
      </DashboardLayout>
    );
  }
  const { room, guests } = view.data;
  const joinUrl = joinLink(room.code);
  const shortUrl = `${window.location.host}/entra`;
  const isTeacher = !!user && user.role !== "student";

  const run = (f: () => Promise<unknown>) => async () => {
    try {
      await f();
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const end = run(async () => {
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
          <Button variant="outline" onClick={run(() => roomApi.setLocked(roomId, !room.locked))}>
            {room.locked ? <LockOpen className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}{room.locked ? t("room.host.unlock") : t("room.host.lock")}
          </Button>
          <ConfirmButton variant="destructive" label={t("room.host.end")} title={t("room.host.endTitle")} description={t("room.host.endText")} icon={<Trash2 className="h-4 w-4" />} onConfirm={() => void end()} />
        </>
      }
    >
      {left !== null && left <= SAVE_REMINDER_SECONDS && (
        <p role="status" className="flex items-center gap-2 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />{t("room.host.saveReminder", { time: formatCountdown(left) })}
        </p>
      )}

      {/* What the class sees on the projector. */}
      <section className="grid items-center gap-6 rounded-lg border-2 border-foreground bg-card p-6 shadow-[4px_4px_0_0_hsl(var(--foreground))] md:grid-cols-[1fr_auto]">
        <div className="space-y-3 text-center md:text-left">
          <p className="text-lg">{t("room.host.goTo")} <strong className="text-primary">{shortUrl}</strong></p>
          <p className="text-lg">{t("room.host.typeCode")}</p>
          <p className="font-mono text-6xl font-bold tracking-[0.2em] sm:text-7xl" aria-label={room.code.split("").join(" ")}>{room.code}</p>
          <div className="flex flex-wrap justify-center gap-4 text-muted-foreground md:justify-start">
            <span className="flex items-center gap-1"><Users className="h-4 w-4" />{t("room.host.guests", { count: guests.length, max: room.maxGuests })}</span>
            {left !== null && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{formatCountdown(left)}</span>}
            {room.locked && <span className="flex items-center gap-1 text-amber-700"><Lock className="h-4 w-4" />{t("room.host.locked")}</span>}
          </div>
        </div>
        <div className="mx-auto rounded-md bg-white p-3"><QRCodeSVG value={joinUrl} size={180} aria-label={joinUrl} /></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title={t("room.host.lobby")} className="lg:col-span-2">
          {guests.length === 0 ? <EmptyState>{t("room.host.empty")}</EmptyState> : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {guests.map((g) => <GuestCard key={g.userId} roomId={roomId} guest={g} onChanged={refresh} onOpen={() => setReading(g)} />)}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title={t("room.host.resultsTitle")}>
            <p className="mb-3 text-sm text-muted-foreground">{t("room.host.resultsText")}</p>
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={run(() => roomApi.downloadXLSX(roomId, i18n.language))}><FileSpreadsheet className="mr-2 h-4 w-4" />{t("room.host.downloadXlsx")}</Button>
              <Button variant="outline" onClick={run(() => roomApi.downloadFile(roomId))}><FileDown className="mr-2 h-4 w-4" />{t("room.host.downloadFile")}</Button>
              {isTeacher && <Button onClick={() => setImporting(true)} disabled={guests.length === 0}>{t("room.host.importIntoClass")}</Button>}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{isTeacher ? t("room.host.fileNote") : t("room.host.fileNoteAnonymous")}</p>
          </Panel>

          <Panel title={t("room.host.detailsTitle")}>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("platform.common.activity")}</dt><dd><AppName type={room.appType} /></dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("room.host.endsAt")}</dt><dd>{formatDate(room.expiresAt, i18n.language)}</dd></div>
            </dl>
            {key && (
              <div className="mt-4 rounded-md bg-secondary p-3 text-xs">
                <p className="mb-2">{t("room.host.keyNote")}</p>
                <Button size="sm" variant="outline" onClick={() => void copy(hostLink(roomId, key), t("room.host.copied"))}>
                  <Copy className="mr-2 h-4 w-4" />{t("room.host.copyLink")}
                </Button>
              </div>
            )}
          </Panel>
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
