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

const app = APPS["impersona-tu"];

const ImpersonaTuPage = () => {
  const { t } = useTranslation();
  const session = useActivitySession(app.type);
  const preset = session.assignment?.config ?? {};
  const [phase, setPhase] = useState<ActivityPhase>("setup");
  const [aiChar, setAiChar] = useState<WikiRef | null>(null);
  const [userChar, setUserChar] = useState<WikiRef | null>(null);
  const [topic, setTopic] = useState("");

  useEffect(() => {
    if (preset.aiCharacter) setAiChar(preset.aiCharacter);
    if (preset.userCharacter) setUserChar(preset.userCharacter);
    if (preset.topic) setTopic(preset.topic);
  }, [preset.aiCharacter, preset.userCharacter, preset.topic]);

  const { summaries, loading } = useWikiSummaries([aiChar, userChar]);
  const aiBio = bioOf(aiChar, summaries);
  const system = aiChar && userChar ? prompts.impersona(aiChar.title, aiBio, userChar.title, bioOf(userChar, summaries), topic, session.assignment) : "";

  const onEnded = useCallback((reason: EndReason) => {
    toast.success(reason === "goal_reached" ? t("platform.activity.goalReachedToast") : t("platform.activity.turnLimitToast"));
    setPhase("reflection");
  }, [t]);

  const engine = useChatEngine({
    session,
    live: phase === "chat" && aiChar ? { systemInstruction: system, characterName: aiChar.title, characterBio: aiBio } : null,
    context: { aiCharacter: aiChar?.title, userCharacter: userChar?.title, topic },
    onEnded,
  });
  const evaluation = useEvaluationFlow(session);

  const canStart = !!aiChar && !!userChar && aiChar.title !== userChar.title && !!topic.trim() && !loading;

  const start = async () => {
    if (!aiChar || !userChar) return;
    await session.begin(`${userChar.title} ↔ ${aiChar.title}`, { aiCharacter: aiChar, userCharacter: userChar, topic });
    engine.reset([
      { id: "role", role: "system", content: t("platform.apps.impersonaTu.roleNotice", { user: userChar.title, ai: aiChar.title, topic }) },
      { id: "greet", role: "assistant", name: aiChar.title, content: t("platform.apps.impersonaTu.greeting", { ai: aiChar.title, user: userChar.title, topic }) },
    ]);
    setPhase("chat");
  };

  const send = (text: string) => engine.runTurn(text, () => engine.respond({ system, name: aiChar?.title }), userChar?.title);

  const restart = () => {
    engine.reset();
    evaluation.reset();
    if (!preset.aiCharacter) setAiChar(null);
    if (!preset.userCharacter) setUserChar(null);
    if (!preset.topic) setTopic("");
    setPhase("setup");
  };

  const minTurns = Math.max(2, session.minTurns);

  return (
    <ActivityShell app={app} phase={phase} session={session} onReset={restart}>
      {phase === "setup" && (
        <SetupCard
          title={t("platform.apps.impersonaTu.setupTitle")}
          description={t("platform.apps.impersonaTu.setupDescription")}
          onStart={start}
          canStart={canStart}
          starting={loading}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <CharacterPicker label={t("platform.apps.impersonaTu.yourCharacter")} value={userChar} onChange={setUserChar} locked={!!preset.userCharacter} />
            <CharacterPicker label={t("platform.apps.impersonaTu.aiCharacter")} value={aiChar} onChange={setAiChar} locked={!!preset.aiCharacter} />
          </div>
          {aiChar && userChar && aiChar.title === userChar.title && <p className="text-sm text-destructive">{t("platform.apps.common.differentCharacters")}</p>}
          <div className="space-y-2">
            <Label htmlFor="topic">{t("platform.apps.impersonaTu.topicLabel")}</Label>
            <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("platform.apps.impersonaTu.topicPlaceholder")} disabled={!!preset.topic} />
          </div>
        </SetupCard>
      )}

      {phase === "chat" && aiChar && userChar && (
        <ChatPanel
          messages={engine.messages}
          onSend={send}
          busy={engine.busy}
          disabled={engine.ended}
          disabledReason={t("platform.activity.ended")}
          userLabel={userChar.title}
          placeholder={t("platform.apps.impersonaTu.placeholder", { name: userChar.title })}
          live={engine.live}
          onEnd={() => {
            session.markManualEnd();
            engine.live.stopLive();
            setPhase("reflection");
          }}
          canEnd={session.turns >= minTurns}
          footerNote={session.turns < minTurns ? t("platform.activity.minTurnsNote", { count: minTurns - session.turns }) : null}
        />
      )}

      {phase === "reflection" && (
        <ReflectionStep
          prompt={t("platform.apps.impersonaTu.reflectionPrompt", { user: userChar?.title, ai: aiChar?.title })}
          onSubmit={(reflection) => {
            setPhase("feedback");
            void evaluation.run({
              activity: `${t("apps.impersonaTu.title")}: ${t("platform.apps.impersonaTu.evalActivity", { user: userChar?.title, ai: aiChar?.title })}`,
              characters: aiChar?.title ?? "",
              studentRole: userChar?.title,
              topic,
              messages: engine.messagesRef.current,
              reflection,
            });
          }}
          optional={!session.requireReflection}
          endReason={session.endReason}
        />
      )}

      {phase === "feedback" && (
        <FeedbackStep
          title={`${t("apps.impersonaTu.title")} - ${userChar?.title ?? ""}`}
          evaluation={evaluation.evaluation}
          partial={evaluation.partial}
          loading={evaluation.loading}
          error={evaluation.error}
          reflection={evaluation.reflection}
          messages={engine.messages}
          facts={[
            { label: t("platform.apps.impersonaTu.yourCharacter"), value: userChar?.title },
            { label: t("platform.apps.impersonaTu.aiCharacter"), value: aiChar?.title },
            { label: t("platform.apps.impersonaTu.topicLabel"), value: topic },
          ]}
          onRestart={restart}
          isAssignment={!!session.assignment}
        />
      )}
    </ActivityShell>
  );
};

export default ImpersonaTuPage;
