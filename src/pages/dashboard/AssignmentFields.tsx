import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AppType } from "@/lib/api";
import { useAiClient } from "@/services/aiClient";
import { uiLanguage } from "@/features/activity/prompts";
import { APP_TYPES } from "@/features/activity/appCatalog";
import LanguagePicker from "@/features/activity/components/LanguagePicker";
import { TURN_BOUNDS } from "@/features/teacher/assignmentLimits";
import { AssignmentDraft, draftLimits } from "@/features/teacher/assignmentDraft";
import { AppName } from "./common";
import PresetFields from "./PresetFields";

/** Goals a judge can check at most (as on the server). */
const MAX_GOALS = 12;

export const ToggleRow = ({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
    <span>
      <span className="block text-sm font-medium">{label}</span>
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </span>
    <Switch checked={checked} onCheckedChange={onChange} />
  </label>
);

type DraftProps = { draft: AssignmentDraft; onChange: (d: AssignmentDraft) => void; idPrefix?: string };

/** Goals the judge checks, with AI suggestions from the instructions. */
export const GoalsEditor = ({ draft, onChange }: DraftProps) => {
  const ai = useAiClient();
  const { t } = useTranslation();
  const [suggesting, setSuggesting] = useState(false);
  const { appType, goals } = draft;
  const set = (patch: Partial<AssignmentDraft>) => onChange({ ...draft, ...patch });

  const suggestGoals = async () => {
    if (!draft.instructions.trim()) return toast.error(t("platform.teacher.form.writeInstructionsFirst"));
    setSuggesting(true);
    try {
      const res = await ai.generateJSON<{ goals: string[] }>({
        task: "utility",
        system: `You help teachers. From the assignment, write 2-5 short, observable goals that a judge can verify in a student's conversation with AI characters (e.g. "Asks why X happened", "Gives at least two arguments about Y"). Write them in ${uiLanguage()}. Answer with JSON: {"goals": ["..."]}`,
        messages: [{ role: "user", content: `App: ${t(`platform.appNames.${appType}`)}\nTitle: ${draft.title}\nInstructions: ${draft.instructions}` }],
      });
      if (res.goals?.length) set({ goals: res.goals.slice(0, 8) });
    } catch (e) {
      toast.error(ai.formatError(e));
    } finally {
      setSuggesting(false);
    }
  };

  return (
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
          <Input value={g} onChange={(e) => set({ goals: goals.map((x, j) => (j === i ? e.target.value : x)) })} placeholder={t("platform.teacher.form.goalPlaceholder", { n: i + 1 })} />
          <Button type="button" variant="ghost" size="icon" onClick={() => set({ goals: goals.filter((_, j) => j !== i) })} aria-label={t("platform.common.delete")}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {goals.length < MAX_GOALS && (
        <Button type="button" variant="ghost" size="sm" onClick={() => set({ goals: [...goals, ""] })}>
          <Plus className="mr-2 h-4 w-4" /> {t("platform.teacher.form.addGoal")}
        </Button>
      )}
    </div>
  );
};

/** Minimum and maximum turns, with the notes on what saving will adapt. */
export const LimitFields = ({ draft, onChange, idPrefix = "a" }: DraftProps) => {
  const { t } = useTranslation();
  const set = (patch: Partial<AssignmentDraft>) => onChange({ ...draft, ...patch });
  const id = (name: string) => `${idPrefix}-${name}`;
  const limits = draftLimits(draft);
  const turnsFromQuestions = draft.appType === "personaggio-misterioso" && limits.questions !== undefined;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={id("min")}>{t("platform.teacher.form.minTurns")}</Label>
          <Input id={id("min")} type="number" min={0} max={TURN_BOUNDS.minTurns} value={draft.minTurns} onChange={(e) => set({ minTurns: Number(e.target.value) })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("max")}>{t("platform.teacher.form.maxTurns")}</Label>
          <Input
            id={id("max")}
            type="number"
            min={0}
            max={TURN_BOUNDS.maxTurns}
            value={turnsFromQuestions ? limits.maxTurns : draft.maxTurns}
            onChange={(e) => set({ maxTurns: Number(e.target.value) })}
            disabled={turnsFromQuestions}
          />
          <p className="text-xs text-muted-foreground">
            {turnsFromQuestions ? t("platform.teacher.form.maxTurnsIsQuestions") : t("platform.teacher.form.zeroUnlimited")}
          </p>
        </div>
      </div>

      {limits.notes.length > 0 && (
        <div role="status" className="space-y-1 rounded-md border border-amber-400/50 bg-amber-400/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-warning" /> {t("platform.teacher.form.limitsAdapted")}</p>
          <ul className="list-disc space-y-0.5 pl-6 text-muted-foreground">
            {limits.notes.map((n) => <li key={n.key}>{t(`platform.teacher.form.limitNotes.${n.key}`, n.values)}</li>)}
          </ul>
        </div>
      )}
    </>
  );
};

/** Ending, reflection and (for classes) live voice. */
export const OptionToggles = ({ draft, onChange, showLive = true }: DraftProps & { showLive?: boolean }) => {
  const { t } = useTranslation();
  const set = (patch: Partial<AssignmentDraft>) => onChange({ ...draft, ...patch });
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <ToggleRow label={t("platform.teacher.form.autoEnd")} hint={t("platform.teacher.form.autoEndHint")} checked={draft.autoEnd} onChange={(v) => set({ autoEnd: v })} />
      <ToggleRow label={t("platform.teacher.form.requireReflection")} checked={draft.requireReflection} onChange={(v) => set({ requireReflection: v })} />
      {showLive && <ToggleRow label={t("platform.teacher.form.allowLive")} hint={t("platform.teacher.form.allowLiveHint")} checked={draft.allowLive} onChange={(v) => set({ allowLive: v })} />}
    </div>
  );
};

/**
 * The fields of an activity a teacher sets: app, title, instructions, goals
 * (with AI suggestions), the choices fixed for the students, the language
 * the characters speak, limits and options. Used by class assignments.
 */
const AssignmentFields = ({ draft, onChange, showLive = true, idPrefix = "a" }: DraftProps & {
  /** Rooms hide the live-voice option: their guests never get it. */
  showLive?: boolean;
}) => {
  const { t } = useTranslation();
  const { appType, config } = draft;
  const set = (patch: Partial<AssignmentDraft>) => onChange({ ...draft, ...patch });
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={id("title")}>{t("platform.teacher.form.title")}</Label>
          <Input id={id("title")} value={draft.title} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>{t("platform.teacher.form.app")}</Label>
          <Select value={appType} onValueChange={(v) => set({ appType: v as AppType, config: config.language ? { language: config.language } : {} })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {APP_TYPES.map((a) => <SelectItem key={a} value={a}><AppName type={a} /></SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("instr")}>{t("platform.teacher.form.instructions")}</Label>
        <Textarea id={id("instr")} value={draft.instructions} onChange={(e) => set({ instructions: e.target.value })} className="min-h-[110px]" placeholder={t("platform.teacher.form.instructionsPlaceholder")} />
      </div>

      <GoalsEditor draft={draft} onChange={onChange} />

      <div className="space-y-3 rounded-md border border-border p-3">
        <p className="text-sm font-medium">{t("platform.teacher.form.presets")}</p>
        <p className="text-xs text-muted-foreground">{t("platform.teacher.form.presetsHint")}</p>
        <PresetFields draft={draft} onChange={(c) => set({ config: c })} idPrefix={idPrefix} />
      </div>

      <div className="rounded-md border border-border p-3">
        <LanguagePicker value={config.language} onChange={(language) => set({ config: { ...config, language } })} optional label={t("platform.language.assignmentLabel")} />
        <p className="mt-2 text-xs text-muted-foreground">{t("platform.language.assignmentHint")}</p>
      </div>

      <LimitFields draft={draft} onChange={onChange} idPrefix={idPrefix} />
      <OptionToggles draft={draft} onChange={onChange} showLive={showLive} />
    </div>
  );
};

export default AssignmentFields;
