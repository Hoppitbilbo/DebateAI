import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, LogIn, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, Assignment } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useBusyAction } from "@/hooks/useBusyAction";
import { useMyClasses } from "@/features/teacher/teacherApi";
import { AssignmentDraft, draftBody, draftOf } from "@/features/teacher/assignmentDraft";
import { hostKeys, roomApi, RoomRequest } from "@/features/room/roomApi";
import { DashboardLayout, EmptyState, Panel, Spinner } from "../dashboard/common";
import AssignmentFields from "../dashboard/AssignmentFields";

const DURATIONS = [30, 60, 90, 120];

/** How the room gets its activity: prepared here, or an assignment of one of the teacher's classes. */
type Mode = "prepare" | "existing";

/** The assignments of the teacher's active classes. */
const useMyAssignments = (enabled: boolean) => {
  const { classes } = useMyClasses();
  return useQuery({
    queryKey: ["room-assignments", classes.data?.map((c) => c.id)],
    enabled: enabled && !!classes.data,
    queryFn: async () => (await Promise.all((classes.data ?? []).filter((c) => !c.archived).map((c) => api.get<Assignment[]>(`/api/classes/${c.id}/assignments`)))).flat(),
  });
};

/**
 * Opens a temporary room, with an account or without one when the admin
 * allows it. The teacher prepares the activity like an assignment: what is
 * fixed here is locked for the students, what is left empty they choose.
 */
const OpenRoomPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, config, loading } = useAuth();
  const isTeacher = !!user && user.role !== "student";
  const maxMinutes = config?.roomMaxMinutes ?? 120;
  const [mode, setMode] = useState<Mode>("prepare");
  const [draft, setDraft] = useState<AssignmentDraft>(() => ({ ...draftOf(), allowLive: false }));
  const [assignmentId, setAssignmentId] = useState("");
  const [minutes, setMinutes] = useState(Math.min(60, maxMinutes));
  const { busy, run } = useBusyAction();
  const mine = useMyAssignments(isTeacher);

  if (loading) return <Spinner />;
  const canOpen = config?.roomsEnabled && (isTeacher || (!user && config.anonymousRooms));
  const hasAssignments = isTeacher && !!mine.data?.length;

  const request = (): RoomRequest | null => {
    if (mode === "existing") return assignmentId ? { assignmentId: Number(assignmentId), minutes } : null;
    return draft.title.trim() ? { assignment: draftBody(draft), minutes } : null;
  };

  const open = () => run(async () => {
    const r = request();
    if (!r) return void toast.error(mode === "existing" ? t("room.open.pickAssignment") : t("platform.teacher.form.titleRequired"));
    const { room, hostKey } = await roomApi.open(r);
    hostKeys.save(room.id, hostKey);
    navigate(`/aula/gestisci/${room.id}#k=${encodeURIComponent(hostKey)}`);
  });

  return (
    <DashboardLayout title={t("room.open.title")} subtitle={t("room.open.subtitle", { hours: maxMinutes / 60 })}>
      {!canOpen ? (
        <EmptyState>
          {config?.roomsEnabled ? t("room.open.loginNeeded") : t("room.open.disabled")}
          {config?.roomsEnabled && <Button asChild variant="outline" className="ml-3"><Link to="/login?next=/aula/nuova"><LogIn className="mr-2 h-4 w-4" />{t("platform.auth.login")}</Link></Button>}
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel className="space-y-5 lg:col-span-2">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              {hasAssignments && (
                <TabsList className="mb-4">
                  <TabsTrigger value="prepare">{t("room.open.modePrepare")}</TabsTrigger>
                  <TabsTrigger value="existing">{t("room.open.modeExisting")}</TabsTrigger>
                </TabsList>
              )}
              <TabsContent value="prepare" className="mt-0">
                <p className="mb-4 rounded-md bg-secondary p-3 text-sm">{t("room.open.prepareHint")}</p>
                <AssignmentFields draft={draft} onChange={setDraft} showLive={false} idPrefix="room" />
              </TabsContent>
              <TabsContent value="existing" className="mt-0 space-y-2">
                <Label>{t("room.open.assignmentLabel")}</Label>
                <Select value={assignmentId} onValueChange={setAssignmentId}>
                  <SelectTrigger><SelectValue placeholder={t("room.open.pickAssignment")} /></SelectTrigger>
                  <SelectContent>
                    {(mine.data ?? []).map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.className ? `${a.className} · ` : ""}{a.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("room.open.assignmentHint")}</p>
              </TabsContent>
            </Tabs>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("room.open.durationLabel")}</legend>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.filter((d) => d <= maxMinutes).map((d) => (
                  <Button key={d} type="button" variant={minutes === d ? "default" : "outline"} aria-pressed={minutes === d} onClick={() => setMinutes(d)}>
                    {t("room.open.minutes", { count: d })}
                  </Button>
                ))}
              </div>
            </fieldset>
            <Button size="lg" onClick={() => void open()} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}{t("room.open.submit")}
            </Button>
          </Panel>
          <Panel title={t("room.open.howTitle")}>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>{t("room.open.how1")}</li>
              <li>{t("room.open.how2")}</li>
              <li>{t("room.open.how3")}</li>
              <li>{t("room.open.how4", { hours: maxMinutes / 60 })}</li>
            </ol>
            {!user && <p className="mt-4 rounded-md bg-secondary p-3 text-xs">{t("room.open.anonymousNote")}</p>}
          </Panel>
        </div>
      )}
    </DashboardLayout>
  );
};

export default OpenRoomPage;
