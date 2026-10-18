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
import { useActivityFlow } from "@/features/activity/useActivityFlow";
import { bioOf, useWikiSummaries } from "@/features/activity/wiki";
import { prompts } from "@/features/activity/prompts";
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

  const flow = useActivityFlow(app.type, { context: { characters: [a?.title, b?.title], theme } });
  const { preset, engine, session } = flow;

  useEffect(() => {
    if (preset.characters?.length === 2) setChars([preset.characters[0], preset.characters[1]]);
    if (preset.topic) setTheme(preset.topic);
  }, [preset.characters, preset.topic]);

  /** One debater speaks, then the floor passes to the other. */
  const speak = async (key: Key) => {
    if (!a || !b) return;
    const me = key === "a" ? a : b;
    const other = key === "a" ? b : a;
    const style = key === "a" ? t("platform.apps.youModerate.styleA") : t("platform.apps.youModerate.styleB");
    await engine.respond({
      system: prompts.moderated(me.title, bioOf(me, summaries), other.title, theme, style, session.assignment),
      history: debateHistory(engine.messagesRef.current, key, moderator),
      name: me.title,
      speakerKey: key,
    });
    setNextSpeaker(key === "a" ? "b" : "a");
  };

  /** Lets a debater speak without a moderator message (the chat stays busy meanwhile). */
  const speakAlone = async (key: Key) => {
    engine.setBusy(true);
    try {
      await speak(key);
    } finally {
      engine.setBusy(false);
    }
  };

  const start = async () => {
    if (!a || !b) return;
    setNextSpeaker("a");
    await flow.begin(`${a.title} vs ${b.title}: ${theme}`, { characters: [a, b], theme }, [
      { id: "intro", role: "system", content: t("platform.apps.youModerate.intro", { a: a.title, b: b.title, theme }) },
    ]);
    await speakAlone("a");
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
              <Input id="theme" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder={t("platform.apps.youModerate.themePlaceholder")} disabled={!!preset.topic} />
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
                <ToggleGroupItem value="a" className="data-[state=on]:text-sky-300">{a.title}</ToggleGroupItem>
                <ToggleGroupItem value="b" className="data-[state=on]:text-amber-300">{b.title}</ToggleGroupItem>
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
