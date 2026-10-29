import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Provider, RouteTarget } from "@/features/admin/aiAdminApi";
import { TASK_KINDS } from "@/features/admin/aiPresets";
import ModelInput from "./ModelInput";

/** The ordered provider/model fallback list of one task. */
const TaskTargets = ({ task, list, providers, onChange, emptyHint, unusedReason }: {
  task: string;
  list: RouteTarget[];
  providers: Provider[];
  onChange: (list: RouteTarget[]) => void;
  /** Shown when the list is empty; defaults to the "no targets" warning. */
  emptyHint?: string;
  /** Why a target will not be used, or null when it will (e.g. not free while only free models are allowed). */
  unusedReason?: (t: RouteTarget) => string | null;
}) => {
  const { t } = useTranslation();
  const byId = useMemo(() => Object.fromEntries(providers.map((p) => [p.id, p])), [providers]);
  const allowed = providers.filter((p) => TASK_KINDS[task]?.includes(p.kind));
  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-2">
        <h3 className="font-medium">{t(`platform.admin.tasks.${task}`)}</h3>
        <p className="text-xs text-muted-foreground">{t(`platform.admin.taskHints.${task}`)}</p>
      </div>
      {list.length === 0 && <p className="mb-2 text-xs text-amber-400">{emptyHint ?? t("platform.admin.ai.noTargets")}</p>}
      <ol className="space-y-2">
        {list.map((target, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <span className="w-5 text-xs text-muted-foreground">{i + 1}.</span>
            <Select value={String(target.providerId)} onValueChange={(v) => onChange(list.map((x, j) => (j === i ? { providerId: Number(v), model: byId[Number(v)]?.models[0]?.id ?? "" } : x)))}>
              <SelectTrigger className="h-9 w-48"><SelectValue placeholder={t("platform.admin.ai.provider")} /></SelectTrigger>
              <SelectContent>{allowed.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <ModelInput provider={byId[target.providerId]} value={target.model} onChange={(m) => onChange(list.map((x, j) => (j === i ? { ...x, model: m } : x)))} className="w-72" liveOnly={task === "live"} />
            <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => { const c = [...list]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; onChange(c); }} aria-label="up"><ArrowUp className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" disabled={i === list.length - 1} onClick={() => { const c = [...list]; [c[i + 1], c[i]] = [c[i], c[i + 1]]; onChange(c); }} aria-label="down"><ArrowDown className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => onChange(list.filter((_, j) => j !== i))} aria-label={t("platform.common.delete")}><Trash2 className="h-4 w-4" /></Button>
            {unusedReason?.(target) && <span className="w-full pl-7 text-xs text-amber-700">{unusedReason(target)}</span>}
          </li>
        ))}
      </ol>
      {allowed.length > 0 && (
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => onChange([...list, { providerId: allowed[0].id, model: allowed[0].models[0]?.id ?? "" }])}>
          <Plus className="mr-1 h-4 w-4" /> {t("platform.admin.ai.addFallback")}
        </Button>
      )}
    </div>
  );
};

export default TaskTargets;
