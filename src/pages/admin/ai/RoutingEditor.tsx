import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AiSettings, JevSettings, Provider, RouteTarget, Routing, saveRouting } from "@/features/admin/aiAdminApi";
import { VOICES } from "@/features/admin/aiPresets";
import { Panel } from "../../dashboard/common";
import TaskTargets from "./TaskTargets";

const RoutingEditor = ({ providers, settings, onSaved }: { providers: Provider[]; settings: AiSettings; onSaved: () => void }) => {
  const { t } = useTranslation();
  const [routing, setRouting] = useState<Routing>(settings.routing);
  const [jev, setJev] = useState<JevSettings>(settings.jev);
  useEffect(() => { setRouting(settings.routing); setJev(settings.jev); }, [settings]);

  const update = (task: string, list: RouteTarget[]) => setRouting({ ...routing, tasks: { ...routing.tasks, [task]: list } });

  const save = async () => {
    try {
      await saveRouting(routing, jev);
      toast.success(t("platform.common.saved"));
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <Panel title={t("platform.admin.ai.routingTitle")} actions={<Button onClick={save}>{t("platform.common.save")}</Button>}>
        <p className="mb-4 text-sm text-muted-foreground">{t("platform.admin.ai.routingHint")}</p>
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("platform.admin.ai.strategy")}</Label>
            <Select value={routing.strategy} onValueChange={(v) => setRouting({ ...routing, strategy: v as Routing["strategy"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["ordered", "free_first", "cheapest"] as const).map((s) => <SelectItem key={s} value={s}>{t(`platform.admin.ai.strategies.${s}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("platform.admin.ai.defaultVoice")}</Label>
            <Select value={routing.defaultVoice || "Aoede"} onValueChange={(v) => setRouting({ ...routing, defaultVoice: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VOICES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-5">
          {settings.tasks.map((task) => (
            <TaskTargets key={task} task={task} list={routing.tasks[task] ?? []} providers={providers} onChange={(list) => update(task, list)} />
          ))}
        </div>
      </Panel>

      <Panel title={t("platform.admin.ai.jevTitle")} actions={<Button onClick={save}>{t("platform.common.save")}</Button>}>
        <p className="mb-4 text-sm text-muted-foreground">{t("platform.admin.ai.jevHint")}</p>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3 md:col-span-3">
            <span className="text-sm font-medium">{t("platform.admin.ai.jevEnabled")}</span>
            <Switch checked={jev.enabled} onCheckedChange={(v) => setJev({ ...jev, enabled: v })} />
          </label>
          <div className="space-y-2">
            <Label htmlFor="jev-th">{t("platform.admin.ai.jevThreshold")}</Label>
            <Input id="jev-th" type="number" step="0.05" min="0.3" max="0.99" value={jev.threshold} onChange={(e) => setJev({ ...jev, threshold: Number(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jev-ev">{t("platform.admin.ai.jevEvery")}</Label>
            <Input id="jev-ev" type="number" min="1" max="10" value={jev.evaluateEvery} onChange={(e) => setJev({ ...jev, evaluateEvery: Number(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jev-mx">{t("platform.admin.ai.jevMaxChars")}</Label>
            <Input id="jev-mx" type="number" min="2000" step="1000" value={jev.maxStateChars} onChange={(e) => setJev({ ...jev, maxStateChars: Number(e.target.value) })} />
          </div>
        </div>
      </Panel>
    </div>
  );
};

export default RoutingEditor;
