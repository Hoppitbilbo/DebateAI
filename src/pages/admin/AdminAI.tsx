import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ExternalLink, FlaskConical, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { resetAiStatus } from "@/services/aiService";
import { EmptyState, Panel, Spinner } from "../dashboard/common";
import { ConfirmButton } from "../dashboard/TeacherPages";
import ModelPicker, { ModelInfo } from "./ModelPicker";

type Kind = "gemini" | "openai" | "anthropic" | "jev";
export interface Provider { id: number; name: string; kind: Kind; baseUrl: string; hasKey: boolean; keyHint?: string; models: ModelInfo[]; enabled: boolean }
interface RouteTarget { providerId: number; model: string }
interface Routing { strategy: "ordered" | "free_first" | "cheapest"; tasks: Record<string, RouteTarget[]>; defaultVoice: string }
interface JevSettings { enabled: boolean; threshold: number; evaluateEvery: number; maxStateChars: number }
interface Settings { routing: Routing; jev: JevSettings; tasks: string[] }
interface PriceRow { providerId: number; providerName: string; model: string; inputPerM: number; outputPerM: number }

interface Preset {
  id: string; name: string; kind: Kind; baseUrl: string; keyUrl?: string; noKey?: boolean; free?: boolean; models?: string[]; note?: string;
}

/** Ready-made providers. Free / local ones first. */
export const PRESETS: Preset[] = [
  { id: "gemini", name: "Google Gemini (AI Studio)", kind: "gemini", baseUrl: "", keyUrl: "https://aistudio.google.com/apikey", free: true, note: "presetNotes.gemini" },
  { id: "opencode", name: "OpenCode Zen", kind: "openai", baseUrl: "https://opencode.ai/inference/openai/v1", keyUrl: "https://opencode.ai/", free: true,
    models: ["big-pickle", "glm-5.3-flash-free", "deepseek-v4.1-flash-free", "mimo-v2.6-flash-free", "nemotron-3.5-super-vl-free", "nemotron-3-ultra-free", "longcat-2.5-preview-free"], note: "presetNotes.opencode" },
  { id: "typesafe", name: "TypeSafe Jev (JEV judge)", kind: "jev", baseUrl: "https://api.typesafe.ai/v1", keyUrl: "https://console.typesafe.ai/", models: ["jev-latest"], note: "presetNotes.typesafe" },
  { id: "jev-openrouter", name: "Jev via OpenRouter (JEV judge)", kind: "jev", baseUrl: "https://openrouter.ai/api/v1", keyUrl: "https://openrouter.ai/keys", models: ["jev-latest", "jev-1.13"], note: "presetNotes.jevOpenrouter" },
  { id: "jev", name: "OpenCode Jev (JEV judge)", kind: "jev", baseUrl: "https://opencode.ai/inference/systemone/v1/systemone", keyUrl: "https://opencode.ai/", free: true, models: ["jev-1.13-free", "jev-1.13"], note: "presetNotes.jev" },
  { id: "openrouter", name: "OpenRouter", kind: "openai", baseUrl: "https://openrouter.ai/api/v1", keyUrl: "https://openrouter.ai/keys", free: true, note: "presetNotes.openrouter" },
  { id: "groq", name: "Groq", kind: "openai", baseUrl: "https://api.groq.com/openai/v1", keyUrl: "https://console.groq.com/keys", free: true },
  { id: "cerebras", name: "Cerebras", kind: "openai", baseUrl: "https://api.cerebras.ai/v1", keyUrl: "https://cloud.cerebras.ai/", free: true },
  { id: "mistral", name: "Mistral AI", kind: "openai", baseUrl: "https://api.mistral.ai/v1", keyUrl: "https://console.mistral.ai/api-keys" },
  { id: "ollama", name: "Ollama (local)", kind: "openai", baseUrl: "http://localhost:11434/v1", noKey: true, free: true, note: "presetNotes.local" },
  { id: "lmstudio", name: "LM Studio (local)", kind: "openai", baseUrl: "http://localhost:1234/v1", noKey: true, free: true, note: "presetNotes.local" },
  { id: "openai", name: "OpenAI", kind: "openai", baseUrl: "https://api.openai.com/v1", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "anthropic", name: "Anthropic Claude", kind: "anthropic", baseUrl: "https://api.anthropic.com/v1", keyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "deepseek", name: "DeepSeek", kind: "openai", baseUrl: "https://api.deepseek.com/v1", keyUrl: "https://platform.deepseek.com/api_keys" },
  { id: "custom", name: "Custom (OpenAI-compatible)", kind: "openai", baseUrl: "" },
];

const VOICES = ["Aoede", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Zephyr", "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba", "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar", "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi", "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat"];

// ---------- add provider ----------
const AddProviderDialog = ({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (o: boolean) => void; onAdded: () => void }) => {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [name, setName] = useState(PRESETS[0].name);
  const [baseUrl, setBaseUrl] = useState(PRESETS[0].baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [kind, setKind] = useState<Kind>(PRESETS[0].kind);
  const [busy, setBusy] = useState(false);

  const choose = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!;
    setPreset(p);
    setName(p.name);
    setBaseUrl(p.baseUrl);
    setKind(p.kind);
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.post("/api/admin/providers", {
        name, kind, baseUrl, apiKey,
        models: preset.models?.map((id) => ({ id, free: id.endsWith("-free") || id === "big-pickle" })),
      });
      toast.success(t("platform.admin.ai.providerAdded"));
      setApiKey("");
      onAdded();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("platform.admin.ai.addProvider")}</DialogTitle>
          <DialogDescription>{t("platform.admin.ai.addProviderHint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("platform.admin.ai.preset")}</Label>
            <Select value={preset.id} onValueChange={choose}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}{p.free ? ` · ${t("platform.admin.ai.freeTier")}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {preset.note && <p className="text-xs text-muted-foreground">{t(`platform.admin.ai.${preset.note}`)}</p>}
          </div>
          <div className="space-y-2"><Label htmlFor="p-name">{t("platform.admin.ai.name")}</Label><Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          {preset.id === "custom" && (
            <div className="space-y-2">
              <Label>{t("platform.admin.ai.kind")}</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI-compatible</SelectItem>
                  <SelectItem value="anthropic">Anthropic Messages</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="jev">Jev / System One</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {kind !== "gemini" && (
            <div className="space-y-2"><Label htmlFor="p-url">{t("platform.admin.ai.baseUrl")}</Label><Input id="p-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://…/v1" /></div>
          )}
          {!preset.noKey && (
            <div className="space-y-2">
              <Label htmlFor="p-key" className="flex items-center justify-between">
                {t("platform.admin.ai.apiKey")}
                {preset.keyUrl && <a href={preset.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">{t("platform.admin.ai.getKey")} <ExternalLink className="h-3 w-3" /></a>}
              </Label>
              <Input id="p-key" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t("platform.admin.ai.keyEncrypted")}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={busy || !name.trim() || (!preset.noKey && !apiKey.trim() && preset.id !== "custom")}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("platform.common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------- provider card ----------
const ProviderCard = ({ p, onChanged }: { p: Provider; onChanged: () => void }) => {
  const { t } = useTranslation();
  const [testModel, setTestModel] = useState(p.models[0]?.id ?? "");
  const [testing, setTesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const refreshModels = async () => {
    setRefreshing(true);
    try {
      const m = await api.post<ModelInfo[]>(`/api/admin/providers/${p.id}/models`);
      toast.success(t("platform.admin.ai.modelsFound", { count: m.length }));
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const r = await api.post<{ output: string; latencyMs: number }>(`/api/admin/providers/${p.id}/test`, { model: testModel });
      setResult(`✅ ${r.latencyMs} ms — ${r.output.slice(0, 160)}`);
    } catch (e) {
      setResult(`❌ ${(e as Error).message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{p.name}</h3>
            <Badge variant="outline">{p.kind}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{p.baseUrl || "generativelanguage.googleapis.com"} · {p.hasKey ? `🔑 ${p.keyHint ?? "••••"}` : t("platform.admin.ai.noKey")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={p.enabled} onCheckedChange={async (v) => { await api.patch(`/api/admin/providers/${p.id}`, { enabled: v }); onChanged(); }} aria-label={t("platform.admin.ai.enabled")} />
          <ConfirmButton title={t("platform.admin.ai.deleteProvider", { name: p.name })} icon={<Trash2 className="h-4 w-4" />} onConfirm={async () => { await api.del(`/api/admin/providers/${p.id}`); onChanged(); }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">
          {t("platform.admin.ai.modelsCount", { count: p.models.length })} · {t("platform.admin.ai.freeCount", { count: p.models.filter((m) => m.free).length })}
        </span>
        <Button size="sm" variant="ghost" onClick={refreshModels} disabled={refreshing}>
          {refreshing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />} {t("platform.admin.ai.refreshModels")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <ModelInput provider={p} value={testModel} onChange={setTestModel} className="min-w-[220px] flex-1" />
        <Button size="sm" variant="outline" onClick={test} disabled={testing || !testModel}>
          {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />} {t("platform.admin.ai.test")}
        </Button>
      </div>
      {result && <p className="break-words rounded bg-background/60 p-2 font-mono text-xs">{result}</p>}

      <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); await api.patch(`/api/admin/providers/${p.id}`, { apiKey: newKey }); setNewKey(""); toast.success(t("platform.common.saved")); onChanged(); }}>
        <Input type="password" autoComplete="off" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder={t("platform.admin.ai.replaceKey")} className="h-8 text-xs" />
        <Button size="sm" variant="ghost" disabled={!newKey}>{t("platform.common.save")}</Button>
      </form>
    </div>
  );
};

/** Model selector bound to a provider's model list. */
const ModelInput = ({ provider, value, onChange, className, liveOnly }: { provider?: Provider; value: string; onChange: (v: string) => void; className?: string; liveOnly?: boolean }) => (
  <ModelPicker models={provider?.models ?? []} value={value} onChange={onChange} className={className} liveOnly={liveOnly} />
);

// ---------- routing ----------
const TASK_KINDS: Record<string, Kind[]> = {
  chat: ["gemini", "openai", "anthropic"],
  evaluation: ["gemini", "openai", "anthropic"],
  utility: ["gemini", "openai", "anthropic"],
  judge: ["jev", "gemini", "openai", "anthropic"],
  live: ["gemini"],
};

const RoutingEditor = ({ providers, settings, onSaved }: { providers: Provider[]; settings: Settings; onSaved: () => void }) => {
  const { t } = useTranslation();
  const [routing, setRouting] = useState<Routing>(settings.routing);
  const [jev, setJev] = useState<JevSettings>(settings.jev);
  useEffect(() => { setRouting(settings.routing); setJev(settings.jev); }, [settings]);

  const byId = useMemo(() => Object.fromEntries(providers.map((p) => [p.id, p])), [providers]);
  const update = (task: string, list: RouteTarget[]) => setRouting({ ...routing, tasks: { ...routing.tasks, [task]: list } });

  const save = async () => {
    try {
      await api.put("/api/admin/settings/routing", routing);
      await api.put("/api/admin/settings/jev", jev);
      resetAiStatus();
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

// ---------- prices ----------
const PricesEditor = ({ providers }: { providers: Provider[] }) => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const prices = useQuery({ queryKey: ["prices"], queryFn: () => api.get<PriceRow[]>("/api/admin/prices") });
  const [draft, setDraft] = useState<{ providerId: number; model: string; inputPerM: number; outputPerM: number }>({ providerId: providers[0]?.id ?? 0, model: "", inputPerM: 0, outputPerM: 0 });

  const put = async (body: object) => {
    await api.put("/api/admin/prices", body);
    void qc.invalidateQueries({ queryKey: ["prices"] });
  };

  return (
    <Panel title={t("platform.admin.ai.pricesTitle")}>
      <p className="mb-4 text-sm text-muted-foreground">{t("platform.admin.ai.pricesHint")}</p>
      {prices.isLoading ? <Spinner /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-2 pr-3">{t("platform.admin.ai.provider")}</th><th className="py-2 pr-3">{t("platform.admin.costs.model")}</th><th className="py-2 pr-3">{t("platform.admin.ai.inputPrice")}</th><th className="py-2 pr-3">{t("platform.admin.ai.outputPrice")}</th><th /></tr>
            </thead>
            <tbody>
              {(prices.data ?? []).map((r) => (
                <tr key={`${r.providerId}-${r.model}`} className="border-t border-border">
                  <td className="py-1.5 pr-3">{r.providerName}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs">{r.model}</td>
                  <td className="py-1.5 pr-3"><Input type="number" step="0.01" min="0" defaultValue={r.inputPerM} className="h-8 w-28" onBlur={(e) => Number(e.target.value) !== r.inputPerM && void put({ ...r, inputPerM: Number(e.target.value) })} /></td>
                  <td className="py-1.5 pr-3"><Input type="number" step="0.01" min="0" defaultValue={r.outputPerM} className="h-8 w-28" onBlur={(e) => Number(e.target.value) !== r.outputPerM && void put({ ...r, outputPerM: Number(e.target.value) })} /></td>
                  <td className="py-1.5 text-right"><Button size="icon" variant="ghost" onClick={() => void put({ ...r, delete: true })} aria-label={t("platform.common.delete")}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
              <tr className="border-t border-border">
                <td className="py-2 pr-3">
                  <Select value={String(draft.providerId)} onValueChange={(v) => setDraft({ ...draft, providerId: Number(v) })}>
                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{providers.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="py-2 pr-3"><ModelInput provider={providers.find((p) => p.id === draft.providerId)} value={draft.model} onChange={(m) => setDraft({ ...draft, model: m })} className="h-8 w-56" /></td>
                <td className="py-2 pr-3"><Input type="number" step="0.01" min="0" value={draft.inputPerM} onChange={(e) => setDraft({ ...draft, inputPerM: Number(e.target.value) })} className="h-8 w-28" /></td>
                <td className="py-2 pr-3"><Input type="number" step="0.01" min="0" value={draft.outputPerM} onChange={(e) => setDraft({ ...draft, outputPerM: Number(e.target.value) })} className="h-8 w-28" /></td>
                <td className="py-2 text-right"><Button size="sm" disabled={!draft.model} onClick={() => { void put(draft); setDraft({ ...draft, model: "" }); }}><Plus className="h-4 w-4" /></Button></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
};

/** Admin → AI: providers, routing (JEV router), JEV judge and prices. */
const AdminAI = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const providers = useQuery({ queryKey: ["providers"], queryFn: () => api.get<Provider[]>("/api/admin/providers") });
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api.get<Settings>("/api/admin/settings") });
  const refresh = () => {
    resetAiStatus();
    void qc.invalidateQueries({ queryKey: ["providers"] });
    void qc.invalidateQueries({ queryKey: ["settings"] });
  };

  if (providers.isLoading || settings.isLoading) return <Spinner />;
  const list = providers.data ?? [];

  return (
    <div className="space-y-6">
      <Panel title={t("platform.admin.ai.providers")} actions={<Button onClick={() => setAdding(true)}><Plus className="mr-2 h-4 w-4" />{t("platform.admin.ai.addProvider")}</Button>}>
        {list.length === 0 ? <EmptyState>{t("platform.admin.ai.noProviders")}</EmptyState> : (
          <div className="grid gap-4 xl:grid-cols-2">{list.map((p) => <ProviderCard key={p.id} p={p} onChanged={refresh} />)}</div>
        )}
      </Panel>
      {settings.data && <RoutingEditor providers={list} settings={settings.data} onSaved={refresh} />}
      {list.length > 0 && <PricesEditor providers={list} />}
      <AddProviderDialog open={adding} onOpenChange={setAdding} onAdded={refresh} />
    </div>
  );
};

export default AdminAI;
