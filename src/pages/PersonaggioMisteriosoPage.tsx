import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CheckCircle2, Dices, HelpCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
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

const app = APPS["personaggio-misterioso"];

// Titles that resolve on it/en/es/fr/de Wikipedia (redirects are followed).
const RANDOM_CHARACTERS = [
  "Leonardo da Vinci", "Galileo Galilei", "Marie Curie", "Albert Einstein", "Isaac Newton", "Charles Darwin",
  "Wolfgang Amadeus Mozart", "Ludwig van Beethoven", "Dante Alighieri", "William Shakespeare", "Mahatma Gandhi",
  "Nelson Mandela", "Frida Kahlo", "Pablo Picasso", "Ada Lovelace", "Nikola Tesla", "Michelangelo",
  "Giuseppe Garibaldi", "Rita Levi-Montalcini", "Vincent van Gogh", "Johann Sebastian Bach", "Cleopatra",
  "Giulio Cesare", "Marco Polo", "Alessandro Volta", "Maria Montessori", "Napoleone Bonaparte",
];

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\(.*?\)/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Lenient name match: full containment or a shared significant surname. */
export const isCorrectGuess = (guess: string, answer: string) => {
  const g = normalize(guess);
  const a = normalize(answer);
  if (!g) return false;
  if (a.includes(g) || g.includes(a)) return true;
  const sig = (s: string) => s.split(" ").filter((w) => w.length > 3);
  return sig(a).some((w) => sig(g).includes(w));
};

const PersonaggioMisteriosoPage = () => {
  const { t } = useTranslation();
  const session = useActivitySession(app.type);
  const preset = session.assignment?.config ?? {};
  const [phase, setPhase] = useState<ActivityPhase>("setup");
  const [character, setCharacter] = useState<WikiRef | null>(null);
  const [concealed, setConcealed] = useState(false);
  const [maxQuestions, setMaxQuestions] = useState(7);
  const [guessing, setGuessing] = useState(false);
  const [guess, setGuess] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [result, setResult] = useState<boolean | null>(null);

  useEffect(() => {
    if (preset.character) {
      setCharacter(preset.character);
      setConcealed(true); // the teacher chose it: the student must not see it
    }
    if (preset.questions) setMaxQuestions(preset.questions);
  }, [preset.character, preset.questions]);

  const { summaries, loading } = useWikiSummaries([character]);
  const bio = bioOf(character, summaries);
  const system = character ? prompts.mystery(character.title, bio, session.assignment) : "";
  const questionsLeft = Math.max(0, maxQuestions - session.turns);

  const onEnded = useCallback((reason: EndReason) => {
    if (reason === "turn_limit") setGuessing(true);
  }, []);

  const engine = useChatEngine({
    session,
    live: phase === "chat" && character && !guessing ? { systemInstruction: system, characterName: character.title, characterBio: bio } : null,
    context: { questions: maxQuestions },
    onEnded,
  });
  const evaluation = useEvaluationFlow(session);

  useEffect(() => {
    if (phase === "chat" && session.turns >= maxQuestions && !guessing) {
      engine.live.stopLive();
      setGuessing(true);
      toast.info(t("platform.apps.personaggioMisterioso.noQuestionsLeft"));
    }
  }, [session.turns, maxQuestions, phase, guessing, engine.live, t]);

  const pickRandom = () => {
    const title = RANDOM_CHARACTERS[Math.floor(Math.random() * RANDOM_CHARACTERS.length)];
    setCharacter({ title });
    setConcealed(true);
  };

  const start = async () => {
    if (!character) return;
    await session.begin(t("apps.personaggioMisterioso.title"), { character: character.title, questions: maxQuestions });
    engine.reset([{ id: "intro", role: "assistant", name: "???", content: t("platform.apps.personaggioMisterioso.intro", { count: maxQuestions }) }]);
    setGuessing(false);
    setResult(null);
    setGuess("");
    setReasoning("");
    setPhase("chat");
  };

  const send = (text: string) => engine.runTurn(text, () => engine.respond({ system, name: "???" }));

  const submitGuess = () => {
    if (!character) return;
    const ok = isCorrectGuess(guess, character.title);
    setResult(ok);
    engine.addMessage({ role: "system", content: t("platform.apps.personaggioMisterioso.guessLog", { guess, answer: character.title }) });
    void engine.afterTurn();
    session.markManualEnd();
    if (ok) toast.success(t("platform.apps.personaggioMisterioso.correct", { name: character.title }));
    else toast.error(t("platform.apps.personaggioMisterioso.wrong", { name: character.title }));
    setPhase("reflection");
  };

  const restart = () => {
    engine.reset();
    evaluation.reset();
    if (!preset.character) {
      setCharacter(null);
      setConcealed(false);
    }
    setGuessing(false);
    setPhase("setup");
  };

  return (
    <ActivityShell
      app={app}
      phase={phase}
      session={session}
      onReset={restart}
      phaseLabels={{ chat: t("platform.apps.personaggioMisterioso.gamePhase") }}
    >
      {phase === "setup" && (
        <SetupCard
          title={t("platform.apps.personaggioMisterioso.setupTitle")}
          description={t("platform.apps.personaggioMisterioso.setupDescription")}
          onStart={start}
          canStart={!!character && !loading}
          starting={loading}
        >
          <CharacterPicker
            label={t("platform.apps.personaggioMisterioso.characterLabel")}
            value={character}
            onChange={(v) => {
              setCharacter(v);
              setConcealed(false);
            }}
            locked={!!preset.character}
            conceal={concealed}
            hint={t("platform.apps.personaggioMisterioso.characterHint")}
          />
          {!preset.character && (
            <Button variant="outline" onClick={pickRandom} className="w-full">
              <Dices className="mr-2 h-4 w-4" /> {t("platform.apps.personaggioMisterioso.random")}
            </Button>
          )}
          <div className="space-y-3">
            <Label>{t("platform.apps.personaggioMisterioso.questionsLabel", { count: maxQuestions })}</Label>
            <Slider value={[maxQuestions]} min={3} max={15} step={1} onValueChange={(v) => setMaxQuestions(v[0])} disabled={!!preset.questions} />
          </div>
        </SetupCard>
      )}

      {phase === "chat" && character && !guessing && (
        <ChatPanel
          messages={engine.messages}
          onSend={send}
          busy={engine.busy}
          disabled={questionsLeft === 0}
          disabledReason={t("platform.apps.personaggioMisterioso.noQuestionsLeft")}
          placeholder={t("platform.apps.personaggioMisterioso.placeholder")}
          live={engine.live}
          onEnd={() => {
            engine.live.stopLive();
            setGuessing(true);
          }}
          endLabel={t("platform.apps.personaggioMisterioso.guessNow")}
          canEnd={session.turns >= 1}
          footerNote={
            <span className="inline-flex items-center gap-1">
              <HelpCircle className="h-3.5 w-3.5" /> {t("platform.apps.personaggioMisterioso.questionsLeft", { count: questionsLeft })}
            </span>
          }
        />
      )}

      {phase === "chat" && guessing && (
        <SetupCard
          title={t("platform.apps.personaggioMisterioso.finalGuessTitle")}
          description={t("platform.apps.personaggioMisterioso.finalGuessDescription")}
          onStart={submitGuess}
          canStart={!!guess.trim() && !!reasoning.trim()}
          startLabel={t("platform.apps.personaggioMisterioso.submitGuess")}
        >
          <div className="space-y-2">
            <Label htmlFor="guess">{t("platform.apps.personaggioMisterioso.guessLabel")}</Label>
            <Input id="guess" value={guess} onChange={(e) => setGuess(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="why">{t("platform.apps.personaggioMisterioso.reasoningLabel")}</Label>
            <Textarea id="why" value={reasoning} onChange={(e) => setReasoning(e.target.value)} className="min-h-[100px]" />
          </div>
        </SetupCard>
      )}

      {phase === "reflection" && (
        <ReflectionStep
          prompt={t("platform.apps.personaggioMisterioso.reflectionPrompt")}
          onSubmit={(reflection) => {
            setPhase("feedback");
            void evaluation.run({
              activity: `${t("apps.personaggioMisterioso.title")}: ${t("platform.apps.personaggioMisterioso.evalActivity")}`,
              characters: character?.title ?? "",
              messages: engine.messagesRef.current,
              reflection,
              extraFacts: [
                `FINAL GUESS: ${guess} — ${result ? "CORRECT" : "WRONG"} (answer: ${character?.title})`,
                `STUDENT REASONING: ${reasoning}`,
                `QUESTIONS USED: ${session.turns}/${maxQuestions}`,
              ],
            });
          }}
          optional={!session.requireReflection}
          summary={
            <div className="flex items-center gap-3 rounded-md border border-border bg-background/50 p-4">
              {result ? <CheckCircle2 className="h-8 w-8 text-primary" /> : <XCircle className="h-8 w-8 text-destructive" />}
              <div>
                <p className="font-semibold">{result ? t("platform.apps.personaggioMisterioso.correctShort") : t("platform.apps.personaggioMisterioso.wrongShort")}</p>
                <p className="text-sm text-muted-foreground">{t("platform.apps.personaggioMisterioso.answerWas", { name: character?.title, guess })}</p>
              </div>
            </div>
          }
        />
      )}

      {phase === "feedback" && (
        <FeedbackStep
          title={`${t("apps.personaggioMisterioso.title")} - ${character?.title ?? ""}`}
          evaluation={evaluation.evaluation}
          partial={evaluation.partial}
          loading={evaluation.loading}
          error={evaluation.error}
          reflection={evaluation.reflection}
          messages={engine.messages}
          facts={[
            { label: t("platform.apps.common.character"), value: character?.title },
            { label: t("platform.apps.personaggioMisterioso.guessLabel"), value: `${guess} ${result ? "✅" : "❌"}` },
            { label: t("platform.apps.personaggioMisterioso.questionsUsed"), value: `${session.turns}/${maxQuestions}` },
          ]}
          onRestart={restart}
          isAssignment={!!session.assignment}
        />
      )}
    </ActivityShell>
  );
};

export default PersonaggioMisteriosoPage;
