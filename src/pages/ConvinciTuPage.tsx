import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WikiRef } from "@/lib/api";
import ActivityShell from "@/features/activity/components/ActivityShell";
import ChatPanel from "@/features/activity/components/ChatPanel";
import ReflectionStep from "@/features/activity/components/ReflectionStep";
import FeedbackStep from "@/features/activity/components/FeedbackStep";
import { CharacterPicker, SetupCard } from "@/features/activity/components/SetupCard";
import { useActivitySession, EndReason } from "@/features/activity/useActivitySession";
import { useChatEngine } from "@/features/activity/useChatEngine";
import { useEvaluationFlow } from "@/features/activity/useEvaluationFlow";
import { bioOf, useWikiSummaries } from "@/features/activity/wiki";
import { prompts } from "@/features/activity/prompts";
import { APPS, ActivityPhase } from "@/features/activity/types";

const app = APPS["convinci-tu"];

const ConvinciTuPage = () => {
  const { t } = useTranslation();
  const session = useActivitySession(app.type);
  const preset = session.assignment?.config ?? {};
  const [phase, setPhase] = useState<ActivityPhase>("setup");
  const [character, setCharacter] = useState<WikiRef | null>(null);
  const [topic, setTopic] = useState("");

  useEffect(() => {
    if (preset.character) setCharacter(preset.character);
    if (preset.topic) setTopic(preset.topic);
  }, [preset.character, preset.topic]);

  const { summaries, loading } = useWikiSummaries([character]);
  const bio = bioOf(character, summaries);
  const system = character ? prompts.convinciTu(character.title, bio, topic, session.assignment) : "";

  const onEnded = useCallback((reason: EndReason) => {
    toast.success(reason === "goal_reached" ? t("platform.activity.goalReachedToast") : t("platform.activity.turnLimitToast"));
    setPhase("reflection");
  }, [t]);

  const engine = useChatEngine({
    session,
    live: phase === "chat" && character ? { systemInstruction: system, characterName: character.title, characterBio: bio } : null,
    context: { character: character?.title, topic },
    onEnded,
  });
  const evaluation = useEvaluationFlow(session);

  const start = async () => {
    if (!character || !topic.trim()) return;
    await session.begin(`${character.title}: ${topic}`, { character, topic });
    engine.reset([{ id: "intro", role: "system", content: t("platform.apps.convinciTu.intro", { name: character.title, topic }) }]);
    setPhase("chat");
  };

  const send = (text: string) =>
    engine.runTurn(text, () => engine.respond({ system, name: character?.title }));

  const finishChat = () => {
    session.markManualEnd();
    engine.live.stopLive();
    setPhase("reflection");
  };

  const submitReflection = (reflection: string) => {
    setPhase("feedback");
    void evaluation.run({
      activity: `${t("apps.convinciTu.title")}: ${t("platform.apps.convinciTu.evalActivity", { name: character?.title, topic })}`,
      characters: character?.title ?? "",
      topic,
      messages: engine.messagesRef.current,
      reflection,
    });
  };

  const restart = () => {
    engine.reset();
    evaluation.reset();
    if (!preset.character) setCharacter(null);
    if (!preset.topic) setTopic("");
    setPhase("setup");
  };

  const minTurns = Math.max(2, session.minTurns);

  return (
    <ActivityShell app={app} phase={phase} session={session} onReset={restart}>
      {phase === "setup" && (
        <SetupCard
          title={t("platform.apps.convinciTu.setupTitle")}
          description={t("platform.apps.convinciTu.setupDescription")}
          onStart={start}
          canStart={!!character && !!topic.trim() && !loading}
          starting={loading}
        >
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
        </SetupCard>
      )}

      {phase === "chat" && character && (
        <ChatPanel
          messages={engine.messages}
          onSend={send}
          busy={engine.busy}
          disabled={engine.ended}
          disabledReason={t("platform.activity.ended")}
          placeholder={t("platform.apps.convinciTu.placeholder", { name: character.title })}
          live={engine.live}
          onEnd={finishChat}
          canEnd={session.turns >= minTurns}
          footerNote={session.turns < minTurns ? t("platform.activity.minTurnsNote", { count: minTurns - session.turns }) : null}
        />
      )}

      {phase === "reflection" && (
        <ReflectionStep
          prompt={t("platform.apps.convinciTu.reflectionPrompt", { name: character?.title })}
          onSubmit={submitReflection}
          optional={!session.requireReflection}
          endReason={session.endReason}
        />
      )}

      {phase === "feedback" && (
        <FeedbackStep
          title={`${t("apps.convinciTu.title")} - ${character?.title ?? ""}`}
          evaluation={evaluation.evaluation}
          partial={evaluation.partial}
          loading={evaluation.loading}
          error={evaluation.error}
          reflection={evaluation.reflection}
          messages={engine.messages}
          facts={[
            { label: t("platform.apps.common.character"), value: character?.title },
            { label: t("platform.apps.convinciTu.topicShort"), value: topic },
          ]}
          onRestart={restart}
          isAssignment={!!session.assignment}
        />
      )}
    </ActivityShell>
  );
};

export default ConvinciTuPage;
