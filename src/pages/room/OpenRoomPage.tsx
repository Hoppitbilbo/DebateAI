import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, LogIn, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, AppType, Assignment } from "@/lib/api";
import { useAuth } from "@/context/auth";
import { useBusyAction } from "@/hooks/useBusyAction";
import { APP_TYPES } from "@/features/activity/appCatalog";
import { useMyClasses } from "@/features/teacher/teacherApi";
import { hostKeys, ROOM_LIMITS, roomApi } from "@/features/room/roomApi";
import { AppName, DashboardLayout, EmptyState, Panel, Spinner } from "../dashboard/common";

const DURATIONS = [30, 60, 90, 120];
const FREE_ACTIVITY = "free";

/** The teacher's assignments, to open a room on one of them (optional). */
const AssignmentPicker = ({ value, onChange }: { value: string; onChange: (id: string, a?: Assignment) => void }) => {
  const { t } = useTranslation();
  const { classes } = useMyClasses();
  const all = useQuery({
    queryKey: ["room-assignments", classes.data?.map((c) => c.id)],
    enabled: !!classes.data,
    queryFn: async () => (await Promise.all((classes.data ?? []).filter((c) => !c.archived).map((c) => api.get<Assignment[]>(`/api/classes/${c.id}/assignments`)))).flat(),
  });
  if (!all.data?.length) return null;
  return (
    <div className="space-y-2">
      <Label>{t("room.open.assignmentLabel")}</Label>
      <Select value={value} onValueChange={(v) => onChange(v, all.data?.find((a) => String(a.id) === v))}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={FREE_ACTIVITY}>{t("room.open.freeActivity")}</SelectItem>
          {all.data.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.className ? `${a.className} · ` : ""}{a.title}</SelectItem>)}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t("room.open.assignmentHint")}</p>
    </div>
  );
};

/** Opens a temporary room: with an account, or without one when the admin allows it. */
const OpenRoomPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, config, loading } = useAuth();
  const maxMinutes = config?.roomMaxMinutes ?? 120;
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [appType, setAppType] = useState<AppType>("wiki-chatbot");
  const [assignment, setAssignment] = useState(FREE_ACTIVITY);
  const [minutes, setMinutes] = useState(Math.min(60, maxMinutes));
  const { busy, run } = useBusyAction();

  if (loading) return <Spinner />;
  const isTeacher = user && user.role !== "student";
  const canOpen = config?.roomsEnabled && (isTeacher || (!user && config.anonymousRooms));

  const open = () => run(async () => {
    const assignmentId = assignment === FREE_ACTIVITY ? undefined : Number(assignment);
    const { room, hostKey } = await roomApi.open({ title, instructions, appType, assignmentId, minutes });
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
          <Panel className="space-y-4 lg:col-span-2">
            {isTeacher && (
              <AssignmentPicker
                value={assignment}
                onChange={(id, a) => {
                  setAssignment(id);
                  if (a) {
                    setAppType(a.appType);
                    setTitle(a.title);
                  }
                }}
              />
            )}
            {assignment === FREE_ACTIVITY && (
              <div className="space-y-2">
                <Label>{t("room.open.appLabel")}</Label>
                <Select value={appType} onValueChange={(v) => setAppType(v as AppType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{APP_TYPES.map((a) => <SelectItem key={a} value={a}><AppName type={a} /></SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="room-title">{t("room.open.titleLabel")}</Label>
              <Input id="room-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={ROOM_LIMITS.title} placeholder={t("room.open.titlePlaceholder")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="room-instructions">{t("room.open.instructionsLabel")}</Label>
              <Textarea id="room-instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} maxLength={ROOM_LIMITS.instructions} placeholder={t("room.open.instructionsPlaceholder")} />
            </div>
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
