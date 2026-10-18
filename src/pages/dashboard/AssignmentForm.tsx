import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AppType, Assignment, AssignmentConfig, WikiRef } from "@/lib/api";
import { saveAssignment } from "@/features/teacher/teacherApi";
import { useAiClient } from "@/services/aiClient";
import { CharacterPicker } from "@/features/activity/components/SetupCard";
import { uiLanguage } from "@/features/activity/prompts";
import { APP_TYPES, AppName } from "./common";

interface Props {
  classId: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Assignment | null;
  onSaved: (a: Assignment) => void;
}

const toLocalInput = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const ToggleRow = ({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
    <span>
      <span className="block text-sm font-medium">{label}</span>
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </span>
    <Switch checked={checked} onCheckedChange={onChange} />
  </label>
);

/** Create / edit an assignment: app, presets, teacher instructions and JEV goals. */
const AssignmentForm = ({ classId, open, onOpenChange, initial, onSaved }: Props) => {
  const ai = useAiClient();
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [appType, setAppType] = useState<AppType>("wiki-chatbot");
  const [instructions, setInstructions] = useState("");
  const [goals, setGoals] = useState<string[]>([""]);
  const [config, setConfig] = useState<AssignmentConfig>({});
  const [minTurns, setMinTurns] = useState(0);
  const [maxTurns, setMaxTurns] = useState(0);
  const [autoEnd, setAutoEnd] = useState(true);
  const [requireReflection, setRequireReflection] = useState(true);
  const [allowLive, setAllowLive] = useState(true);
  const [published, setPublished] = useState(true);
  const [notify, setNotify] = useState(true);
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setAppType(initial?.appType ?? "wiki-chatbot");
    setInstructions(initial?.instructions ?? "");
    setGoals(initial?.goals.length ? initial.goals : [""]);
    setConfig(initial?.config ?? {});
    setMinTurns(initial?.minTurns ?? 0);
    setMaxTurns(initial?.maxTurns ?? 0);
    setAutoEnd(initial?.autoEnd ?? true);
    setRequireReflection(initial?.requireReflection ?? true);
    setAllowLive(initial?.allowLive ?? true);
    setPublished(initial?.published ?? true);
    setNotify(!initial);
    setDueAt(toLocalInput(initial?.dueAt));
  }, [open, initial]);

  const setRef = (key: keyof AssignmentConfig) => (v: WikiRef | null) => setConfig((c) => ({ ...c, [key]: v ?? undefined }));
  const setPair = (i: 0 | 1) => (v: WikiRef | null) =>
    setConfig((c) => {
      const pair = [...(c.characters ?? [])];
      pair[i] = v as WikiRef;
      const clean = pair.filter(Boolean);
      return { ...c, characters: clean.length ? pair : undefined };
    });

  const suggestGoals = async () => {
    if (!instructions.trim()) return toast.error(t("platform.teacher.form.writeInstructionsFirst"));
    setSuggesting(true);
    try {
      const res = await ai.generateJSON<{ goals: string[] }>({
        task: "utility",
        system: `You help teachers. From the assignment, write 2-5 short, observable goals that a judge can verify in a student's conversation with AI characters (e.g. "Asks why X happened", "Gives at least two arguments about Y"). Write them in ${uiLanguage()}. Answer with JSON: {"goals": ["..."]}`,
        messages: [{ role: "user", content: `App: ${t(`platform.appNames.${appType}`)}\nTitle: ${title}\nInstructions: ${instructions}` }],
      });
      if (res.goals?.length) setGoals(res.goals.slice(0, 8));
    } catch (e) {
      toast.error(ai.formatError(e));
    } finally {
      setSuggesting(false);
    }
  };

  const save = async () => {
    if (!title.trim()) return toast.error(t("platform.teacher.form.titleRequired"));
    setSaving(true);
    const pair = config.characters?.filter(Boolean);
    const body = {
      title,
      appType,
      instructions,
      goals: goals.map((g) => g.trim()).filter(Boolean),
      config: { ...config, characters: pair && pair.length === 2 ? pair : undefined },
      minTurns,
      maxTurns,
      autoEnd,
      requireReflection,
      allowLive,
      published,
      notify,
      dueAt: dueAt ? new Date(dueAt).toISOString() : "",
    };
    try {
      const a = await saveAssignment(classId, initial, body);
      toast.success(t("platform.common.saved"));
      onSaved(a);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const needsPair = appType === "doppia-intervista" || appType === "you-moderate";
  const needsTopic = appType === "convinci-tu" || appType === "impersona-tu" || appType === "you-moderate";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? t("platform.teacher.form.editTitle") : t("platform.teacher.form.newTitle")}</DialogTitle>
          <DialogDescription>{t("platform.teacher.form.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="a-title">{t("platform.teacher.form.title")}</Label>
              <Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("platform.teacher.form.app")}</Label>
              <Select value={appType} onValueChange={(v) => { setAppType(v as AppType); setConfig({}); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APP_TYPES.map((a) => <SelectItem key={a} value={a}><AppName type={a} /></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="a-instr">{t("platform.teacher.form.instructions")}</Label>
            <Textarea id="a-instr" value={instructions} onChange={(e) => setInstructions(e.target.value)} className="min-h-[110px]" placeholder={t("platform.teacher.form.instructionsPlaceholder")} />
          </div>

          <div className="space-y-2 rounded-md border border-primary/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label>{t("platform.teacher.form.goals")}</Label>
                <p className="text-xs text-muted-foreground">{t("platform.teacher.form.goalsHint")}</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={suggestGoals} disabled={suggesting}>
                {suggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {t("platform.teacher.form.suggestGoals")}
              </Button>
            </div>
            {goals.map((g, i) => (
              <div key={i} className="flex gap-2">
                <Input value={g} onChange={(e) => setGoals(goals.map((x, j) => (j === i ? e.target.value : x)))} placeholder={t("platform.teacher.form.goalPlaceholder", { n: i + 1 })} />
                <Button type="button" variant="ghost" size="icon" onClick={() => setGoals(goals.filter((_, j) => j !== i))} aria-label={t("platform.common.delete")}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {goals.length < 12 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setGoals([...goals, ""])}>
                <Plus className="mr-2 h-4 w-4" /> {t("platform.teacher.form.addGoal")}
              </Button>
            )}
          </div>

          <div className="space-y-3 rounded-md border border-border p-3">
            <p className="text-sm font-medium">{t("platform.teacher.form.presets")}</p>
            <p className="text-xs text-muted-foreground">{t("platform.teacher.form.presetsHint")}</p>
            {(appType === "convinci-tu" || appType === "wiki-chatbot" || appType === "personaggio-misterioso") && (
              <CharacterPicker label={appType === "wiki-chatbot" ? t("platform.apps.wikiChatbot.topicLabel") : t("platform.apps.common.character")} value={config.character ?? null} onChange={setRef("character")} />
            )}
            {appType === "impersona-tu" && (
              <div className="grid gap-3 md:grid-cols-2">
                <CharacterPicker label={t("platform.apps.impersonaTu.yourCharacter")} value={config.userCharacter ?? null} onChange={setRef("userCharacter")} />
                <CharacterPicker label={t("platform.apps.impersonaTu.aiCharacter")} value={config.aiCharacter ?? null} onChange={setRef("aiCharacter")} />
              </div>
            )}
            {needsPair && (
              <div className="grid gap-3 md:grid-cols-2">
                <CharacterPicker label={t("platform.apps.common.characterN", { n: 1 })} value={config.characters?.[0] ?? null} onChange={setPair(0)} />
                <CharacterPicker label={t("platform.apps.common.characterN", { n: 2 })} value={config.characters?.[1] ?? null} onChange={setPair(1)} />
              </div>
            )}
            {needsTopic && (
              <div className="space-y-2">
                <Label htmlFor="a-topic">{t("platform.teacher.form.topic")}</Label>
                <Input id="a-topic" value={config.topic ?? ""} onChange={(e) => setConfig({ ...config, topic: e.target.value || undefined })} />
              </div>
            )}
            {appType === "personaggio-misterioso" && (
              <div className="space-y-2">
                <Label htmlFor="a-q">{t("platform.teacher.form.questions")}</Label>
                <Input id="a-q" type="number" min={3} max={20} value={config.questions ?? ""} onChange={(e) => setConfig({ ...config, questions: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="a-min">{t("platform.teacher.form.minTurns")}</Label>
              <Input id="a-min" type="number" min={0} max={100} value={minTurns} onChange={(e) => setMinTurns(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-max">{t("platform.teacher.form.maxTurns")}</Label>
              <Input id="a-max" type="number" min={0} max={200} value={maxTurns} onChange={(e) => setMaxTurns(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground">{t("platform.teacher.form.zeroUnlimited")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-due">{t("platform.teacher.form.dueAt")}</Label>
              <Input id="a-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <ToggleRow label={t("platform.teacher.form.autoEnd")} hint={t("platform.teacher.form.autoEndHint")} checked={autoEnd} onChange={setAutoEnd} />
            <ToggleRow label={t("platform.teacher.form.requireReflection")} checked={requireReflection} onChange={setRequireReflection} />
            <ToggleRow label={t("platform.teacher.form.allowLive")} hint={t("platform.teacher.form.allowLiveHint")} checked={allowLive} onChange={setAllowLive} />
            <ToggleRow label={t("platform.teacher.form.published")} hint={t("platform.teacher.form.publishedHint")} checked={published} onChange={setPublished} />
            {published && (!initial || !initial.published) && (
              <ToggleRow label={t("platform.teacher.form.notify")} hint={t("platform.teacher.form.notifyHint")} checked={notify} onChange={setNotify} />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("platform.common.cancel")}</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("platform.common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignmentForm;
