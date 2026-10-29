import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Assignment, WikiRef } from "@/lib/api";
import ActivityRunner from "@/features/activity/components/ActivityRunner";
import { CharacterPicker } from "@/features/activity/components/SetupCard";
import { useActivityFlow } from "@/features/activity/useActivityFlow";
import { bioOf, useWikiSummaries } from "@/features/activity/wiki";
import { openings, prompts } from "@/features/activity/prompts";
import { APPS } from "@/features/activity/types";
import { Difficulty, difficultyOf } from "@/features/activity/difficulty";
import DifficultyPicker from "@/features/activity/components/DifficultyPicker";

const app = APPS["convinci-tu"];

/** The student tries to convince a historical character about a topic. */
const ConvinciTuPage = () => {
  const { t } = useTranslation();
  const [character, setCharacter] = useState<WikiRef | null>(null);
  const [topic, setTopic] = useState("");
  const [chosenLevel, setChosenLevel] = useState<Difficulty>();

  const { summaries, loading } = useWikiSummaries([character]);
  const bio = bioOf(character, summaries);
  const levelFor = (assignment: Assignment | null) => difficultyOf(assignment?.config.difficulty, chosenLevel);
  const systemFor = (assignment: Assignment | null) => (character ? prompts.convinciTu(character.title, bio, topic, assignment, levelFor(assignment)) : "");

  const flow = useActivityFlow(app.type, {
    live: (phase, assignment) =>
      phase === "chat" && character ? { systemInstruction: systemFor(assignment), characterName: character.title, characterBio: bio } : null,
    context: (assignment) => ({ character: character?.title, topic, difficulty: levelFor(assignment) }),
  });
  const { preset, engine } = flow;
  const system = systemFor(flow.session.assignment);
  const level = levelFor(flow.session.assignment);

  useEffect(() => {
    if (preset.character) setCharacter(preset.character);
    if (preset.topic) setTopic(preset.topic);
  }, [preset.character, preset.topic]);

  const start = async () => {
    if (!character || !topic.trim()) return;
    if (!(await flow.begin(`${character.title}: ${topic}`, { character, topic, difficulty: level }, []))) return;
    await engine.open({
      system,
      cue: openings.convinciTu(topic),
      name: character.title,
      fallback: { role: "system", content: t("platform.apps.convinciTu.intro", { name: character.title, topic }) },
    });
  };

  const restart = () =>
    flow.restart(() => {
      if (!preset.character) setCharacter(null);
      if (!preset.topic) setTopic("");
    });

  return (
    <ActivityRunner
      app={app}
      flow={flow}
      onRestart={restart}
      setup={{
        title: t("platform.apps.convinciTu.setupTitle"),
        description: t("platform.apps.convinciTu.setupDescription"),
        canStart: !!character && !!topic.trim() && !loading,
        starting: loading,
        onStart: start,
        children: (
          <>
            <CharacterPicker label={t("platform.apps.common.character")} value={character} onChange={setCharacter} locked={!!preset.character} />
            <div className="space-y-2">
              <Label htmlFor="topic">{t("platform.apps.convinciTu.topicLabel")}</Label>
              <Input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t("platform.apps.convinciTu.topicPlaceholder")}
                disabled={!!preset.topic}
              />
            </div>
            <DifficultyPicker app="convinciTu" value={level} onChange={(v) => setChosenLevel(v)} locked={!!preset.difficulty} />
          </>
        ),
      }}
      chat={{
        ready: !!character,
        onSend: (text) => engine.runTurn(text, () => engine.respond({ system, name: character?.title })),
        placeholder: t("platform.apps.convinciTu.placeholder", { name: character?.title }),
        live: engine.live,
      }}
      reflection={{
        prompt: t("platform.apps.convinciTu.reflectionPrompt", { name: character?.title }),
        brief: () => ({
          activity: `${t("apps.convinciTu.title")}: ${t("platform.apps.convinciTu.evalActivity", { name: character?.title, topic })}`,
          characters: character?.title ?? "",
          topic,
        }),
      }}
      feedback={{
        title: `${t("apps.convinciTu.title")} - ${character?.title ?? ""}`,
        facts: [
          { label: t("platform.apps.common.character"), value: character?.title },
          { label: t("platform.apps.convinciTu.topicShort"), value: topic },
          { label: t("platform.difficulty.label"), value: t(`platform.difficulty.levels.${level}`) },
        ],
      }}
    />
  );
};

export default ConvinciTuPage;
