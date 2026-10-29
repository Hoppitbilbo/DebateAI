import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { WikiRef } from "@/lib/api";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import ActivityRunner from "@/features/activity/components/ActivityRunner";
import { CharacterPicker } from "@/features/activity/components/SetupCard";
import { titleOf, useActivityFlow } from "@/features/activity/useActivityFlow";
import { toHistory } from "@/features/activity/useChatEngine";
import { bioOf, useWikiSummaries } from "@/features/activity/wiki";
import { recipeFor } from "@/features/activity/recipe";
import { APPS } from "@/features/activity/types";

const app = APPS["doppia-intervista"];
type Target = "both" | "a" | "b";

const SPEAKER_STYLES = {
  a: "border-l-4 border-l-sky-400",
  b: "border-l-4 border-l-amber-400",
};

/** The student interviews two historical characters at once. */
const DoppiaIntervistaPage = () => {
  const { t } = useTranslation();
  const [chars, setChars] = useState<[WikiRef | null, WikiRef | null]>([null, null]);
  const [target, setTarget] = useState<Target>("both");
  const [a, b] = chars;
  const { summaries, loading } = useWikiSummaries(chars);

  const flow = useActivityFlow(app.type, {
    context: { characters: [a?.title, b?.title] },
    restore: (saved) => {
      const [x, y] = Array.isArray(saved.characters) ? saved.characters.map(titleOf) : [];
      if (x && y) setChars([{ title: x }, { title: y }]);
    },
  });
  const { preset, engine } = flow;

  /** The recipe of one character's answers; the server writes the instructions. */
  const recipeOf = (me: WikiRef, other: WikiRef) =>
    recipeFor(app.type, { character: me.title, bio: bioOf(me, summaries), other: other.title });

  useEffect(() => {
    if (preset.characters?.length === 2) setChars([preset.characters[0], preset.characters[1]]);
  }, [preset.characters]);

  const sameCharacter = !!a && !!b && a.title === b.title;

  const start = async () => {
    if (!a || !b) return;
    if (!(await flow.begin(`${a.title} & ${b.title}`, { characters: [a, b] }, []))) return;
    // each character introduces itself in its own voice
    for (const [key, me, other] of [["a", a, b], ["b", b, a]] as const) {
      await engine.open({
        recipe: recipeOf(me, other),
        name: me.title,
        speakerKey: key,
        fallback: { role: "assistant", content: t("platform.apps.doppiaIntervista.greeting", { name: me.title }) },
      });
    }
  };

  /** Each addressed character answers in turn, seeing only what was said to them. */
  const send = (text: string) => {
    if (!a || !b) return;
    return engine.runTurn(
      text,
      async () => {
        const speakers = target === "both" ? (["a", "b"] as const) : ([target] as const);
        for (const key of speakers) {
          const me = key === "a" ? a : b;
          const other = key === "a" ? b : a;
          await engine.respond({
            recipe: recipeOf(me, other),
            history: toHistory(engine.messagesRef.current, key),
            name: me.title,
            speakerKey: key,
          });
        }
      },
      undefined,
      target === "both" ? undefined : target,
    );
  };

  const restart = () =>
    flow.restart(() => {
      if (!preset.characters) setChars([null, null]);
      setTarget("both");
    });

  const both = `${a?.title} & ${b?.title}`;

  return (
    <ActivityRunner
      app={app}
      flow={flow}
      onRestart={restart}
      setup={{
        title: t("platform.apps.doppiaIntervista.setupTitle"),
        description: t("platform.apps.doppiaIntervista.setupDescription"),
        canStart: !!a && !!b && !sameCharacter && !loading,
        starting: loading,
        onStart: start,
        children: (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <CharacterPicker label={t("platform.apps.common.characterN", { n: 1 })} value={a} onChange={(v) => setChars([v, b])} locked={!!preset.characters} />
              <CharacterPicker label={t("platform.apps.common.characterN", { n: 2 })} value={b} onChange={(v) => setChars([a, v])} locked={!!preset.characters} />
            </div>
            {sameCharacter && <p className="text-sm text-destructive">{t("platform.apps.common.differentCharacters")}</p>}
          </>
        ),
      }}
      chat={{
        ready: !!a && !!b,
        onSend: send,
        placeholder: t("platform.apps.doppiaIntervista.placeholder"),
        speakerStyles: SPEAKER_STYLES,
        toolbar: a && b && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("platform.apps.doppiaIntervista.askTo")}</span>
            <ToggleGroup type="single" size="sm" value={target} onValueChange={(v) => v && setTarget(v as Target)}>
              <ToggleGroupItem value="both">{t("platform.apps.doppiaIntervista.both")}</ToggleGroupItem>
              <ToggleGroupItem value="a" className="data-[state=on]:text-info">{a.title}</ToggleGroupItem>
              <ToggleGroupItem value="b" className="data-[state=on]:text-warning">{b.title}</ToggleGroupItem>
            </ToggleGroup>
          </div>
        ),
      }}
      reflection={{
        prompt: t("platform.apps.doppiaIntervista.reflectionPrompt", { a: a?.title, b: b?.title }),
        brief: () => ({
          activity: `${t("apps.doppiaIntervista.title")}: ${t("platform.apps.doppiaIntervista.evalActivity", { a: a?.title, b: b?.title })}`,
          characters: both,
        }),
      }}
      feedback={{
        title: `${t("apps.doppiaIntervista.title")} - ${both}`,
        facts: [{ label: t("platform.apps.common.characters"), value: both }],
      }}
    />
  );
};

export default DoppiaIntervistaPage;
