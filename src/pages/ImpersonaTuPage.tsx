import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Assignment, WikiRef } from "@/lib/api";
import ActivityRunner from "@/features/activity/components/ActivityRunner";
import { CharacterPicker } from "@/features/activity/components/SetupCard";
import { useActivityFlow } from "@/features/activity/useActivityFlow";
import { bioOf, useWikiSummaries } from "@/features/activity/wiki";
import { prompts } from "@/features/activity/prompts";
import { APPS } from "@/features/activity/types";

const app = APPS["impersona-tu"];

/** The student plays a historical character and debates with another one. */
const ImpersonaTuPage = () => {
  const { t } = useTranslation();
  const [aiChar, setAiChar] = useState<WikiRef | null>(null);
  const [userChar, setUserChar] = useState<WikiRef | null>(null);
  const [topic, setTopic] = useState("");

  const { summaries, loading } = useWikiSummaries([aiChar, userChar]);
  const aiBio = bioOf(aiChar, summaries);
  const systemFor = (assignment: Assignment | null) =>
    aiChar && userChar ? prompts.impersona(aiChar.title, aiBio, userChar.title, bioOf(userChar, summaries), topic, assignment) : "";

  const flow = useActivityFlow(app.type, {
    live: (phase, assignment) =>
      phase === "chat" && aiChar ? { systemInstruction: systemFor(assignment), characterName: aiChar.title, characterBio: aiBio } : null,
    context: { aiCharacter: aiChar?.title, userCharacter: userChar?.title, topic },
  });
  const { preset, engine } = flow;
  const system = systemFor(flow.session.assignment);

  useEffect(() => {
    if (preset.aiCharacter) setAiChar(preset.aiCharacter);
    if (preset.userCharacter) setUserChar(preset.userCharacter);
    if (preset.topic) setTopic(preset.topic);
  }, [preset.aiCharacter, preset.userCharacter, preset.topic]);

  const sameCharacter = !!aiChar && !!userChar && aiChar.title === userChar.title;

  const start = async () => {
    if (!aiChar || !userChar) return;
    await flow.begin(`${userChar.title} ↔ ${aiChar.title}`, { aiCharacter: aiChar, userCharacter: userChar, topic }, [
      { id: "role", role: "system", content: t("platform.apps.impersonaTu.roleNotice", { user: userChar.title, ai: aiChar.title, topic }) },
      { id: "greet", role: "assistant", name: aiChar.title, content: t("platform.apps.impersonaTu.greeting", { ai: aiChar.title, user: userChar.title, topic }) },
    ]);
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
              <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("platform.apps.impersonaTu.topicPlaceholder")} disabled={!!preset.topic} />
            </div>
          </>
        ),
      }}
      chat={{
        ready: !!aiChar && !!userChar,
        onSend: (text) => engine.runTurn(text, () => engine.respond({ system, name: aiChar?.title }), userChar?.title),
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
        ],
      }}
    />
  );
};

export default ImpersonaTuPage;
