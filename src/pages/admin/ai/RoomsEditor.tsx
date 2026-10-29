import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle } from "lucide-react";
import { AiSettings, Provider, RoomSettings, RouteTarget, saveRooms } from "@/features/admin/aiAdminApi";
import { Panel } from "../../dashboard/common";
import TaskTargets from "./TaskTargets";

const LIMITS = ["maxMinutes", "maxGuests", "requestsPerGuestPerHour", "maxRequestsPerRoom", "maxOpenAnonymousRooms"] as const;
const SWITCHES = ["enabled", "allowAnonymousTeachers", "freeOnly"] as const;

/** Admin → AI → temporary rooms: who may open them, their limits and their models. */
const RoomsEditor = ({ providers, settings, onSaved }: { providers: Provider[]; settings: AiSettings; onSaved: () => void }) => {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<RoomSettings>(settings.rooms);
  useEffect(() => setRooms(settings.rooms), [settings]);
  // What the server will really use, as last saved: shown only while the form is unchanged.
  const saved = JSON.stringify(rooms) === JSON.stringify(settings.rooms);
  const used = settings.roomTargets ?? {};
  const isUsed = (task: string, target: RouteTarget) =>
    (used[task] ?? []).some((u) => u.providerId === target.providerId && u.model === target.model);
  const noChat = saved && (used.chat ?? []).length === 0;

  const save = async () => {
    try {
      await saveRooms(rooms);
      toast.success(t("platform.common.saved"));
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Panel title={t("room.admin.title")} actions={<Button onClick={save}>{t("platform.common.save")}</Button>}>
      <p className="mb-4 text-sm text-muted-foreground">{t("room.admin.hint")}</p>
      <div className="grid gap-3 md:grid-cols-3">
        {SWITCHES.map((k) => (
          <label key={k} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <span className="text-sm">
              <span className="block font-medium">{t(`room.admin.${k}`)}</span>
              <span className="block text-xs text-muted-foreground">{t(`room.admin.${k}Hint`)}</span>
            </span>
            <Switch checked={rooms[k]} onCheckedChange={(v) => setRooms({ ...rooms, [k]: v })} />
          </label>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {LIMITS.map((k) => (
          <div key={k} className="space-y-2">
            <Label htmlFor={`room-${k}`}>{t(`room.admin.${k}`)}</Label>
            <Input id={`room-${k}`} type="number" min={0} max={k === "maxMinutes" ? 120 : undefined} value={rooms[k]} onChange={(e) => setRooms({ ...rooms, [k]: Number(e.target.value) })} />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("room.admin.limitsHint")}</p>

      {rooms.enabled && noChat && (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{t("room.admin.noChatModel")}
        </p>
      )}

      <h3 className="mb-2 mt-6 font-semibold">{t("room.admin.modelsTitle")}</h3>
      <p className="mb-3 text-sm text-muted-foreground">{t("room.admin.modelsHint")}</p>
      <div className="space-y-4">
        {settings.roomTasks.map((task) => (
          <TaskTargets
            key={task}
            task={task}
            list={rooms.tasks[task] ?? []}
            providers={providers}
            emptyHint={t("room.admin.useMain")}
            unusedReason={(target) => (saved && !isUsed(task, target) ? t("room.admin.ignoredNotFree") : null)}
            onChange={(list) => setRooms({ ...rooms, tasks: { ...rooms.tasks, [task]: list } })}
          />
        ))}
      </div>
    </Panel>
  );
};

export default RoomsEditor;
