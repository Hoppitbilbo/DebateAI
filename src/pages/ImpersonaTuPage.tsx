import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Assignment, WikiRef } from "@/lib/api";
import ActivityRunner from "@/features/activity/components/ActivityRunner";
import { CharacterPicker } from "@/features/activity/components/SetupCard";
import { useActivityFlow } from "@/features/activity/useActivityFlow";
import { bioOf, useWikiSummaries } from "@/features/activity/wiki";
import { MAX_TOPIC_CHARS, recipeFor } from "@/features/activity/recipe";
import { APPS } from "@/features/activity/types";
import { Difficulty, difficultyOf } from "@/features/activity/difficulty";
import DifficultyPicker from "@/features/activity/components/DifficultyPicker";

const app = APPS["impersona-tu"];

/** The student plays a historical character and debates with another one. */
const ImpersonaTuPage = () => {
  const { t } = useTranslation();
  const [aiChar, setAiChar] = useState<WikiRef | null>(null);
  const [userChar, setUserChar] = useState<WikiRef | null>(null);
  const [topic, setTopic] = useState("");
  const [chosenLevel, setChosenLevel] = useState<Difficulty>();

  const { summaries, loading } = useWikiSummaries([aiChar, userChar]);
  const aiBio = bioOf(aiChar, summaries);
  const levelFor = (assignment: Assignment | null) => difficultyOf(assignment?.config.difficulty, chosenLevel);
  // The server writes the character's instructions from this recipe.
  const recipeOf = (assignment: Assignment | null) =>
    aiChar && userChar
      ? recipeFor(app.type, {
          character: aiChar.title,
          bio: aiBio,
          userCharacter: userChar.title,
          userBio: bioOf(userChar, summaries),
          topic,
          difficulty: levelFor(assignment),
        })
      : undefined;

  const flow = useActivityFlow(app.type, {
    live: (phase, assignment) =>
      phase === "chat" && aiChar ? { recipe: recipeOf(assignment), characterName: aiChar.title, characterBio: aiBio } : null,
    context: (assignment) => ({ aiCharacter: aiChar?.title, userCharacter: userChar?.title, topic, difficulty: levelFor(assignment) }),
  });
  const { preset, engine } = flow;
  const recipe = recipeOf(flow.session.assignment);
  const level = levelFor(flow.session.assignment);

  useEffect(() => {
    if (preset.aiCharacter) setAiChar(preset.aiCharacter);
    if (preset.userCharacter) setUserChar(preset.userCharacter);
    if (preset.topic) setTopic(preset.topic);
  }, [preset.aiCharacter, preset.userCharacter, preset.topic]);

  const sameCharacter = !!aiChar && !!userChar && aiChar.title === userChar.title;

  const start = async () => {
    if (!aiChar || !userChar) return;
    if (!(await flow.begin(`${userChar.title} ↔ ${aiChar.title}`, { aiCharacter: aiChar, userCharacter: userChar, topic, difficulty: level }, []))) return;
    await engine.open({
      recipe,
      name: aiChar.title,
      fallback: { role: "assistant", content: t("platform.apps.impersonaTu.greeting", { ai: aiChar.title, user: userChar.title, topic }) },
    });
  };

  const restart = () =>
    flow.restart(() => {
      if (!preset.aiCharacter) setAiChar(null);
      if (!preset.userCharacter) setUserChar(null);
      if (!preset.topic) setTopic("");
    });

  return (
    <ActivityRunner
      app={app}
      flow={flow}
      onRestart={restart}
      setup={{
        title: t("platform.apps.impersonaTu.setupTitle"),
        description: t("platform.apps.impersonaTu.setupDescription"),
        canStart: !!aiChar && !!userChar && !sameCharacter && !!topic.trim() && !loading,
        starting: loading,
        onStart: start,
        children: (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <CharacterPicker label={t("platform.apps.impersonaTu.yourCharacter")} value={userChar} onChange={setUserChar} locked={!!preset.userCharacter} />
              <CharacterPicker label={t("platform.apps.impersonaTu.aiCharacter")} value={aiChar} onChange={setAiChar} locked={!!preset.aiCharacter} />
            </div>
            {sameCharacter && <p className="text-sm text-destructive">{t("platform.apps.common.differentCharacters")}</p>}
            <div className="space-y-2">
              <Label htmlFor="topic">{t("platform.apps.impersonaTu.topicLabel")}</Label>
              <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={MAX_TOPIC_CHARS} placeholder={t("platform.apps.impersonaTu.topicPlaceholder")} disabled={!!preset.topic} />
            </div>
            <DifficultyPicker app="impersonaTu" value={level} onChange={(v) => setChosenLevel(v)} locked={!!preset.difficulty} />
          </>
        ),
      }}
      chat={{
        ready: !!aiChar && !!userChar,
        onSend: (text) => engine.runTurn(text, () => engine.respond({ recipe, name: aiChar?.title }), userChar?.title),
        placeholder: t("platform.apps.impersonaTu.placeholder", { name: userChar?.title }),
        userLabel: userChar?.title,
        live: engine.live,
      }}
      reflection={{
        prompt: t("platform.apps.impersonaTu.reflectionPrompt", { user: userChar?.title, ai: aiChar?.title }),
        brief: () => ({
          activity: `${t("apps.impersonaTu.title")}: ${t("platform.apps.impersonaTu.evalActivity", { user: userChar?.title, ai: aiChar?.title })}`,
          characters: aiChar?.title ?? "",
          studentRole: userChar?.title,
          topic,
        }),
      }}
      feedback={{
        title: `${t("apps.impersonaTu.title")} - ${userChar?.title ?? ""}`,
        facts: [
          { label: t("platform.apps.impersonaTu.yourCharacter"), value: userChar?.title },
          { label: t("platform.apps.impersonaTu.aiCharacter"), value: aiChar?.title },
          { label: t("platform.apps.impersonaTu.topicLabel"), value: topic },
          { label: t("platform.difficulty.label"), value: t(`platform.difficulty.levels.${level}`) },
        ],
      }}
    />
  );
};

export default ImpersonaTuPage;
