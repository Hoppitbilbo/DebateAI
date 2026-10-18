import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AiSettings, JevSettings, Provider, RouteTarget, Routing, saveRouting } from "@/features/admin/aiAdminApi";
import { TASK_KINDS, VOICES } from "@/features/admin/aiPresets";
import { Panel } from "../../dashboard/common";
import ModelInput from "./ModelInput";

const RoutingEditor = ({ providers, settings, onSaved }: { providers: Provider[]; settings: AiSettings; onSaved: () => void }) => {
  const { t } = useTranslation();
  const [routing, setRouting] = useState<Routing>(settings.routing);
  const [jev, setJev] = useState<JevSettings>(settings.jev);
  useEffect(() => { setRouting(settings.routing); setJev(settings.jev); }, [settings]);

  const byId = useMemo(() => Object.fromEntries(providers.map((p) => [p.id, p])), [providers]);
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
          {settings.tasks.map((task) => {
            const list = routing.tasks[task] ?? [];
            const allowed = providers.filter((p) => TASK_KINDS[task]?.includes(p.kind));
            return (
              <div key={task} className="rounded-md border border-border p-3">
                <div className="mb-2">
                  <h3 className="font-medium">{t(`platform.admin.tasks.${task}`)}</h3>
                  <p className="text-xs text-muted-foreground">{t(`platform.admin.taskHints.${task}`)}</p>
                </div>
                {list.length === 0 && <p className="mb-2 text-xs text-amber-400">{t("platform.admin.ai.noTargets")}</p>}
                <ol className="space-y-2">
                  {list.map((target, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2">
                      <span className="w-5 text-xs text-muted-foreground">{i + 1}.</span>
                      <Select value={String(target.providerId)} onValueChange={(v) => update(task, list.map((x, j) => (j === i ? { providerId: Number(v), model: byId[Number(v)]?.models[0]?.id ?? "" } : x)))}>
                        <SelectTrigger className="h-9 w-48"><SelectValue placeholder={t("platform.admin.ai.provider")} /></SelectTrigger>
                        <SelectContent>{allowed.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <ModelInput provider={byId[target.providerId]} value={target.model} onChange={(m) => update(task, list.map((x, j) => (j === i ? { ...x, model: m } : x)))} className="w-72" liveOnly={task === "live"} />
                      <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => { const c = [...list]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; update(task, c); }} aria-label="up"><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" disabled={i === list.length - 1} onClick={() => { const c = [...list]; [c[i + 1], c[i]] = [c[i], c[i + 1]]; update(task, c); }} aria-label="down"><ArrowDown className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => update(task, list.filter((_, j) => j !== i))} aria-label={t("platform.common.delete")}><Trash2 className="h-4 w-4" /></Button>
                    </li>
                  ))}
                </ol>
                {allowed.length > 0 && (
                  <Button size="sm" variant="ghost" className="mt-2" onClick={() => update(task, [...list, { providerId: allowed[0].id, model: allowed[0].models[0]?.id ?? "" }])}>
                    <Plus className="mr-1 h-4 w-4" /> {t("platform.admin.ai.addFallback")}
                  </Button>
                )}
              </div>
            );
          })}
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
