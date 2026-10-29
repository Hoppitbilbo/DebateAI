import { useTranslation } from "react-i18next";
import { Shuffle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import WikiSearchSelect from "@/components/WikiSearchSelect";
import type { AssignmentConfig, WikiRef } from "@/lib/api";
import { CharacterPicker } from "@/features/activity/components/SetupCard";
import DifficultyPicker from "@/features/activity/components/DifficultyPicker";
import { hasDifficulty } from "@/features/activity/difficulty";
import { MAX_TEACHER_HINTS, QUESTIONS } from "@/features/activity/mystery";
import { MAX_MYSTERY_CHARACTERS } from "@/features/teacher/assignmentDraft";
import type { AssignmentDraft } from "@/features/teacher/assignmentDraft";

const DIFFICULTY_KEY = { "personaggio-misterioso": "personaggioMisterioso", "convinci-tu": "convinciTu", "impersona-tu": "impersonaTu" } as const;

/**
 * The mystery characters: one or more, played in turn by each student; with
 * two or more, "shuffle" gives every student a different order.
 */
const MysteryCharacters = ({ config, onChange }: { config: AssignmentConfig; onChange: (c: AssignmentConfig) => void }) => {
  const { t } = useTranslation();
  const list = config.characters ?? [];
  const set = (characters: WikiRef[]) =>
    onChange({ ...config, characters: characters.length ? characters : undefined, shuffle: characters.length > 1 ? config.shuffle : undefined });

  return (
    <div className="space-y-2">
      <Label>{t("platform.teacher.form.mysteryCharacters")}</Label>
      <p className="text-xs text-muted-foreground">{t("platform.teacher.form.mysteryCharactersHint")}</p>
      {list.length > 0 && (
        <ol className="flex flex-wrap gap-2">
          {list.map((c, i) => (
            <li key={c.title} className="story-pop inline-flex items-center gap-1 rounded-full border-2 border-foreground bg-card py-1 pl-3 pr-1 text-sm font-medium">
              <span className="text-muted-foreground">{i + 1}.</span> {c.title}
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => set(list.filter((_, j) => j !== i))} aria-label={t("platform.common.delete")}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ol>
      )}
      {list.length < MAX_MYSTERY_CHARACTERS && (
        <WikiSearchSelect onSelect={(r) => !list.some((c) => c.title === r.title) && set([...list, { title: r.title, snippet: r.snippet }])} />
      )}
      {list.length > 1 && (
        <label className="flex items-center justify-between gap-4 rounded-md border border-border p-3">
          <span className="flex items-start gap-2">
            <Shuffle className="mt-0.5 h-4 w-4 text-primary" />
            <span>
              <span className="block text-sm font-medium">{t("platform.teacher.form.shuffle")}</span>
              <span className="block text-xs text-muted-foreground">{t("platform.teacher.form.shuffleHint")}</span>
            </span>
          </span>
          <Switch checked={!!config.shuffle} onCheckedChange={(v) => onChange({ ...config, shuffle: v || undefined })} />
        </label>
      )}
    </div>
  );
};

/** The teacher's hints for a single mystery character, vaguest first. */
const TeacherHints = ({ config, onChange }: { config: AssignmentConfig; onChange: (c: AssignmentConfig) => void }) => {
  const { t } = useTranslation();
  const single = config.characters?.length === 1;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t("platform.teacher.form.hints")}</legend>
      <p className="text-xs text-muted-foreground">{single ? t("platform.teacher.form.hintsHint") : t("platform.teacher.form.hintsNeedCharacter")}</p>
      {single && Array.from({ length: MAX_TEACHER_HINTS }, (_, i) => (
        <Input
          key={i}
          aria-label={t("platform.teacher.form.hintN", { n: i + 1 })}
          placeholder={t("platform.teacher.form.hintN", { n: i + 1 })}
          value={config.hints?.[i] ?? ""}
          onChange={(e) => {
            const hints = Array.from({ length: MAX_TEACHER_HINTS }, (_, j) => (j === i ? e.target.value : config.hints?.[j] ?? ""));
            onChange({ ...config, hints: hints.some((h) => h.trim()) ? hints : undefined });
          }}
        />
      ))}
    </fieldset>
  );
};

/**
 * The choices a teacher fixes for the students of an activity: characters,
 * topic, the mystery game's list and hints, questions and difficulty. What
 * is left empty the students choose.
 */
const PresetFields = ({ draft, onChange, idPrefix = "a", showQuestions = true }: {
  draft: AssignmentDraft;
  onChange: (c: AssignmentConfig) => void;
  idPrefix?: string;
  showQuestions?: boolean;
}) => {
  const { t } = useTranslation();
  const { appType, config } = draft;
  const setRef = (key: keyof AssignmentConfig) => (v: WikiRef | null) => onChange({ ...config, [key]: v ?? undefined });
  const setPair = (i: 0 | 1) => (v: WikiRef | null) => {
    const pair = [...(config.characters ?? [])];
    pair[i] = v as WikiRef;
    onChange({ ...config, characters: pair.filter(Boolean).length ? pair : undefined });
  };
  const id = (name: string) => `${idPrefix}-${name}`;
  const needsPair = appType === "doppia-intervista" || appType === "you-moderate";
  const needsTopic = appType === "convinci-tu" || appType === "impersona-tu" || appType === "you-moderate";

  return (
    <div className="space-y-4">
      {(appType === "convinci-tu" || appType === "wiki-chatbot") && (
        <CharacterPicker label={appType === "wiki-chatbot" ? t("platform.apps.wikiChatbot.topicLabel") : t("platform.apps.common.character")} value={config.character ?? null} onChange={setRef("character")} />
      )}
      {appType === "personaggio-misterioso" && <MysteryCharacters config={config} onChange={onChange} />}
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
          <Label htmlFor={id("topic")}>{t("platform.teacher.form.topic")}</Label>
          <Input id={id("topic")} value={config.topic ?? ""} onChange={(e) => onChange({ ...config, topic: e.target.value || undefined })} />
        </div>
      )}
      {hasDifficulty(appType) && (
        <DifficultyPicker
          app={DIFFICULTY_KEY[appType as keyof typeof DIFFICULTY_KEY]}
          value={config.difficulty}
          onChange={(v) => onChange({ ...config, difficulty: v })}
          allowFree
        />
      )}
      {appType === "personaggio-misterioso" && <TeacherHints config={config} onChange={onChange} />}
      {appType === "personaggio-misterioso" && showQuestions && (
        <div className="space-y-2">
          <Label htmlFor={id("q")}>{t("platform.teacher.form.questions")}</Label>
          <Input id={id("q")} type="number" min={QUESTIONS.min} max={QUESTIONS.max} value={config.questions ?? ""} onChange={(e) => onChange({ ...config, questions: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
      )}
    </div>
  );
};

export default PresetFields;
