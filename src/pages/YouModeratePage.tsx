import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FastForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { WikiRef } from "@/lib/api";
import type { ChatMessage } from "@/services/aiService";
import ActivityRunner from "@/features/activity/components/ActivityRunner";
import { CharacterPicker } from "@/features/activity/components/SetupCard";
import { titleOf, useActivityFlow } from "@/features/activity/useActivityFlow";
import { bioOf, useWikiSummaries } from "@/features/activity/wiki";
import { MAX_TOPIC_CHARS, recipeFor } from "@/features/activity/recipe";
import { APPS, ActivityMessage } from "@/features/activity/types";

const app = APPS["you-moderate"];
type Key = "a" | "b";
const SPEAKER_STYLES = { a: "border-l-4 border-l-sky-400", b: "border-l-4 border-l-amber-400" };

/** The debate seen from one debater: own lines = assistant, everything else = user. */
const debateHistory = (messages: ActivityMessage[], me: Key, moderator: string): ChatMessage[] =>
  messages
    .filter((m) => m.content.trim() && !m.error && !m.streaming)
    .map((m) =>
      m.speakerKey === me && m.role === "assistant"
        ? { role: "assistant" as const, content: m.content }
        : { role: "user" as const, content: `${m.role === "user" ? moderator : m.role === "system" ? "[!]" : m.name}: ${m.content}` },
    );

/** The student moderates a debate between two historical characters. */
const YouModeratePage = () => {
  const { t } = useTranslation();
  const [chars, setChars] = useState<[WikiRef | null, WikiRef | null]>([null, null]);
  const [theme, setTheme] = useState("");
  const [target, setTarget] = useState<"next" | Key>("next");
  const [nextSpeaker, setNextSpeaker] = useState<Key>("a");
  const [a, b] = chars;
  const { summaries, loading } = useWikiSummaries(chars);
  const moderator = t("platform.apps.youModerate.moderator");

  const flow = useActivityFlow(app.type, {
    context: { characters: [a?.title, b?.title], theme },
    restore: (saved, messages) => {
      const [x, y] = Array.isArray(saved.characters) ? saved.characters.map(titleOf) : [];
      if (x && y) setChars([{ title: x }, { title: y }]);
      if (typeof saved.theme === "string") setTheme(saved.theme);
      // The floor passes to the debater who did not speak last.
      const last = [...messages].reverse().find((m) => m.speakerKey === "a" || m.speakerKey === "b");
      setNextSpeaker(last?.speakerKey === "a" ? "b" : "a");
    },
  });
  const { preset, engine } = flow;

  useEffect(() => {
    if (preset.characters?.length === 2) setChars([preset.characters[0], preset.characters[1]]);
    if (preset.topic) setTheme(preset.topic);
  }, [preset.characters, preset.topic]);

  /** The recipe of one debater (its key is its speaking style); the server writes the instructions. */
  const recipeOf = (key: Key, me: WikiRef, other: WikiRef) =>
    recipeFor(app.type, { character: me.title, bio: bioOf(me, summaries), other: other.title, topic: theme, style: key });

  /** One debater speaks, then the floor passes to the other. */
  const speak = async (key: Key) => {
    if (!a || !b) return;
    const [me, other] = key === "a" ? [a, b] : [b, a];
    await engine.respond({
      recipe: recipeOf(key, me, other),
      history: debateHistory(engine.messagesRef.current, key, moderator),
      name: me.title,
      speakerKey: key,
    });
    setNextSpeaker(key === "a" ? "b" : "a");
  };

  /**
   * Lets a debater speak without a moderator message (the chat stays busy
   * meanwhile). The line is saved; no student turn, so no new judgement.
   */
  const speakAlone = async (key: Key) => {
    await engine.withBusy(() => speak(key));
    await engine.afterTurn({ judge: false });
  };

  /** The first debater opens, then the floor passes to the second. */
  const start = async () => {
    if (!a || !b) return;
    setNextSpeaker("a");
    if (!(await flow.begin(`${a.title} vs ${b.title}: ${theme}`, { characters: [a, b], theme }, []))) return;
    await engine.open({
      recipe: recipeOf("a", a, b),
      name: a.title,
      speakerKey: "a",
      fallback: { role: "system", content: t("platform.apps.youModerate.intro", { a: a.title, b: b.title, theme }) },
    });
    setNextSpeaker("b");
  };

  const send = (text: string) => engine.runTurn(text, () => speak(target === "next" ? nextSpeaker : target), moderator);

  const continueDebate = () => {
    if (!engine.busy && !engine.ended) void speakAlone(nextSpeaker);
  };

  const restart = () =>
    flow.restart(() => {
      if (!preset.characters) setChars([null, null]);
      if (!preset.topic) setTheme("");
    });

  const sameCharacter = !!a && !!b && a.title === b.title;
  const both = `${a?.title} & ${b?.title}`;

  return (
    <ActivityRunner
      app={app}
      flow={flow}
      onRestart={restart}
      setup={{
        title: t("platform.apps.youModerate.setupTitle"),
        description: t("platform.apps.youModerate.setupDescription"),
        canStart: !!a && !!b && !sameCharacter && !!theme.trim() && !loading,
        starting: loading,
        onStart: start,
        children: (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <CharacterPicker label={t("platform.apps.common.characterN", { n: 1 })} value={a} onChange={(v) => setChars([v, b])} locked={!!preset.characters} />
              <CharacterPicker label={t("platform.apps.common.characterN", { n: 2 })} value={b} onChange={(v) => setChars([a, v])} locked={!!preset.characters} />
            </div>
            {sameCharacter && <p className="text-sm text-destructive">{t("platform.apps.common.differentCharacters")}</p>}
            <div className="space-y-2">
              <Label htmlFor="theme">{t("platform.apps.youModerate.themeLabel")}</Label>
              <Input id="theme" value={theme} onChange={(e) => setTheme(e.target.value)} maxLength={MAX_TOPIC_CHARS} placeholder={t("platform.apps.youModerate.themePlaceholder")} disabled={!!preset.topic} />
            </div>
          </>
        ),
      }}
      chat={{
        ready: !!a && !!b,
        onSend: send,
        placeholder: t("platform.apps.youModerate.placeholder"),
        userLabel: moderator,
        speakerStyles: SPEAKER_STYLES,
        toolbar: a && b && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">{t("platform.apps.youModerate.addressTo")}</span>
              <ToggleGroup type="single" size="sm" value={target} onValueChange={(v) => v && setTarget(v as "next" | Key)}>
                <ToggleGroupItem value="next">{t("platform.apps.youModerate.nextSpeaker", { name: nextSpeaker === "a" ? a.title : b.title })}</ToggleGroupItem>
                <ToggleGroupItem value="a" className="data-[state=on]:text-info">{a.title}</ToggleGroupItem>
                <ToggleGroupItem value="b" className="data-[state=on]:text-warning">{b.title}</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <Button size="sm" variant="outline" onClick={continueDebate} disabled={engine.busy || engine.ended}>
              <FastForward className="mr-2 h-4 w-4" /> {t("platform.apps.youModerate.continue")}
            </Button>
          </div>
        ),
      }}
      reflection={{
        prompt: t("platform.apps.youModerate.reflectionPrompt", { a: a?.title, b: b?.title }),
        brief: () => ({
          activity: `${t("apps.youModerate.title")}: ${t("platform.apps.youModerate.evalActivity", { a: a?.title, b: b?.title })}`,
          characters: both,
          studentRole: moderator,
          topic: theme,
        }),
      }}
      feedback={{
        title: `${t("apps.youModerate.title")} - ${theme}`,
        facts: [
          { label: t("platform.apps.common.characters"), value: both },
          { label: t("platform.apps.youModerate.themeLabel"), value: theme },
        ],
      }}
    />
  );
};

export default YouModeratePage;
