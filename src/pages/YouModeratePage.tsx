import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FastForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { WikiRef } from "@/lib/api";
import type { ChatMessage } from "@/services/aiService";
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
import { APPS, ActivityMessage, ActivityPhase } from "@/features/activity/types";

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

const YouModeratePage = () => {
  const { t } = useTranslation();
  const session = useActivitySession(app.type);
  const preset = session.assignment?.config ?? {};
  const [phase, setPhase] = useState<ActivityPhase>("setup");
  const [chars, setChars] = useState<[WikiRef | null, WikiRef | null]>([null, null]);
  const [theme, setTheme] = useState("");
  const [target, setTarget] = useState<"next" | Key>("next");
  const [nextSpeaker, setNextSpeaker] = useState<Key>("a");

  useEffect(() => {
    if (preset.characters?.length === 2) setChars([preset.characters[0], preset.characters[1]]);
    if (preset.topic) setTheme(preset.topic);
  }, [preset.characters, preset.topic]);

  const [a, b] = chars;
  const { summaries, loading } = useWikiSummaries(chars);
  const moderator = t("platform.apps.youModerate.moderator");

  const onEnded = useCallback((reason: EndReason) => {
    toast.success(reason === "goal_reached" ? t("platform.activity.goalReachedToast") : t("platform.activity.turnLimitToast"));
    setPhase("reflection");
  }, [t]);

  const engine = useChatEngine({ session, context: { characters: [a?.title, b?.title], theme }, onEnded });
  const evaluation = useEvaluationFlow(session);

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

  const start = async () => {
    if (!a || !b) return;
    await session.begin(`${a.title} vs ${b.title}: ${theme}`, { characters: [a, b], theme });
    engine.reset([{ id: "intro", role: "system", content: t("platform.apps.youModerate.intro", { a: a.title, b: b.title, theme }) }]);
    setNextSpeaker("a");
    setPhase("chat");
    engine.setBusy(true);
    try {
      await speak("a");
    } finally {
      engine.setBusy(false);
    }
  };

  const send = (text: string) => {
    const key: Key = target === "next" ? nextSpeaker : target;
    return engine.runTurn(text, () => speak(key), moderator);
  };

  const continueDebate = async () => {
    if (engine.busy || engine.ended) return;
    engine.setBusy(true);
    try {
      await speak(nextSpeaker);
    } finally {
      engine.setBusy(false);
    }
  };

  const restart = () => {
    engine.reset();
    evaluation.reset();
    if (!preset.characters) setChars([null, null]);
    if (!preset.topic) setTheme("");
    setPhase("setup");
  };

  const minTurns = Math.max(2, session.minTurns);
  const canStart = !!a && !!b && a.title !== b.title && !!theme.trim() && !loading;

  return (
    <ActivityShell app={app} phase={phase} session={session} onReset={restart}>
      {phase === "setup" && (
        <SetupCard
          title={t("platform.apps.youModerate.setupTitle")}
          description={t("platform.apps.youModerate.setupDescription")}
          onStart={start}
          canStart={canStart}
          starting={loading}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <CharacterPicker label={t("platform.apps.common.characterN", { n: 1 })} value={a} onChange={(v) => setChars([v, b])} locked={!!preset.characters} />
            <CharacterPicker label={t("platform.apps.common.characterN", { n: 2 })} value={b} onChange={(v) => setChars([a, v])} locked={!!preset.characters} />
          </div>
          {a && b && a.title === b.title && <p className="text-sm text-destructive">{t("platform.apps.common.differentCharacters")}</p>}
          <div className="space-y-2">
            <Label htmlFor="theme">{t("platform.apps.youModerate.themeLabel")}</Label>
            <Input id="theme" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder={t("platform.apps.youModerate.themePlaceholder")} disabled={!!preset.topic} />
          </div>
        </SetupCard>
      )}

      {phase === "chat" && a && b && (
        <ChatPanel
          messages={engine.messages}
          onSend={send}
          busy={engine.busy}
          disabled={engine.ended}
          disabledReason={t("platform.activity.ended")}
          userLabel={moderator}
          speakerStyles={SPEAKER_STYLES}
          placeholder={t("platform.apps.youModerate.placeholder")}
          toolbar={
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
          }
          onEnd={() => {
            session.markManualEnd();
            setPhase("reflection");
          }}
          canEnd={session.turns >= minTurns}
          footerNote={session.turns < minTurns ? t("platform.activity.minTurnsNote", { count: minTurns - session.turns }) : null}
        />
      )}

      {phase === "reflection" && (
        <ReflectionStep
          prompt={t("platform.apps.youModerate.reflectionPrompt", { a: a?.title, b: b?.title })}
          onSubmit={(reflection) => {
            setPhase("feedback");
            void evaluation.run({
              activity: `${t("apps.youModerate.title")}: ${t("platform.apps.youModerate.evalActivity", { a: a?.title, b: b?.title })}`,
              characters: `${a?.title} & ${b?.title}`,
              studentRole: moderator,
              topic: theme,
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
          title={`${t("apps.youModerate.title")} - ${theme}`}
          evaluation={evaluation.evaluation}
          partial={evaluation.partial}
          loading={evaluation.loading}
          error={evaluation.error}
          reflection={evaluation.reflection}
          messages={engine.messages}
          facts={[
            { label: t("platform.apps.common.characters"), value: `${a?.title} & ${b?.title}` },
            { label: t("platform.apps.youModerate.themeLabel"), value: theme },
          ]}
          onRestart={restart}
          isAssignment={!!session.assignment}
        />
      )}
    </ActivityShell>
  );
};

export default YouModeratePage;
