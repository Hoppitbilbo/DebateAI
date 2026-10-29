import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CheckCircle2, Dices, HelpCircle, Lightbulb, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type { Assignment, WikiRef } from "@/lib/api";
import ActivityRunner from "@/features/activity/components/ActivityRunner";
import { CharacterPicker, SetupCard } from "@/features/activity/components/SetupCard";
import { useActivityFlow } from "@/features/activity/useActivityFlow";
import type { EndReason } from "@/features/activity/useActivitySession";
import { bioOf, useWikiSummaries } from "@/features/activity/wiki";
import { recipeFor } from "@/features/activity/recipe";
import { APPS } from "@/features/activity/types";
import { availableQuestions, isCorrectGuess, nextTeacherHint, QUESTIONS, RANDOM_CHARACTERS } from "@/features/activity/mystery";
import { characterOrder, mysteryCharacters, mysteryRounds } from "@/features/activity/characterOrder";
import { Difficulty, difficultyOf } from "@/features/activity/difficulty";
import DifficultyPicker from "@/features/activity/components/DifficultyPicker";
import RoundDots from "@/features/activity/components/RoundDots";

const app = APPS["personaggio-misterioso"];

/** Largest number of questions the student can pick on the slider. */
const SLIDER_MAX_QUESTIONS = 15;

/** Guess who: the student asks a limited number of questions, then guesses the character. */
const PersonaggioMisteriosoPage = () => {
  const { t } = useTranslation();
  const [character, setCharacter] = useState<WikiRef | null>(null);
  const [concealed, setConcealed] = useState(false);
  const [chosenQuestions, setChosenQuestions] = useState<number>(QUESTIONS.default);
  const [guessing, setGuessing] = useState(false);
  // The questions are over (count used up, turn limit or JEV): the chat stays
  // readable and the student moves on to the guess when ready.
  const [questionsOver, setQuestionsOver] = useState(false);
  const [guess, setGuess] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [endedByJudge, setEndedByJudge] = useState(false);
  // The student named the character in the chat and the character confirmed
  // it: the game is won, there is no separate guess.
  const [foundInChat, setFoundInChat] = useState(false);
  const [chosenLevel, setChosenLevel] = useState<Difficulty>();

  const { summaries, loading } = useWikiSummaries([character]);
  const bio = bioOf(character, summaries);
  const levelFor = (assignment: Assignment | null) => difficultyOf(assignment?.config.difficulty, chosenLevel);
  // The server writes the character's instructions from this recipe.
  const recipeOf = (assignment: Assignment | null) =>
    character
      ? recipeFor(app.type, {
          character: character.title,
          bio,
          difficulty: levelFor(assignment),
          questions: availableQuestions(chosenQuestions, assignment?.maxTurns),
        })
      : undefined;

  // When the server ends the questions (turn limit, or JEV judging the goal
  // reached) no more questions can be asked; the student then makes the guess.
  const onEnded = useCallback((reason: EndReason) => {
    if (reason === "identified") {
      foundRef.current?.();
      return;
    }
    if (reason === "goal_reached") {
      setEndedByJudge(true);
      toast.success(t("platform.apps.personaggioMisterioso.judgeEnded"));
    }
    if (reason === "turn_limit" || reason === "goal_reached") setQuestionsOver(true);
  }, [t]);

  // Set below, once the round is known; called when the judge says the
  // character was found.
  const foundRef = useRef<(() => void) | null>(null);
  const lastQuestion = useRef("");

  const flow = useActivityFlow(app.type, {
    live: (phase, assignment) =>
      phase === "chat" && character && !guessing ? { recipe: recipeOf(assignment), characterName: character.title, characterBio: bio } : null,
    context: (assignment) => ({ questions: availableQuestions(chosenQuestions, assignment?.maxTurns), difficulty: levelFor(assignment) }),
    onEnded,
  });
  const { preset, engine, session, phase } = flow;
  const { user } = session;
  const level = levelFor(session.assignment);
  const [hintsUsed, setHintsUsed] = useState(0);

  // The teacher's characters, in this student's order (shuffled per student
  // when the teacher asked), played one per round.
  const fixed = mysteryCharacters(preset);
  const orderSeed = `${session.assignment?.id ?? 0}:${user?.id ?? 0}`;
  const order = characterOrder(fixed, !!preset.shuffle, orderSeed);
  const [round, setRound] = useState(0);
  const roundCharacter = order.length ? order[round % order.length] : null;
  const moreRounds = order.length > 1 && round + 1 < order.length;
  const recipe = recipeOf(session.assignment);
  // Never more questions than the assignment's turn limit, so the game ends when it says it does.
  const turnCap = session.assignment?.maxTurns ?? 0;
  const maxQuestions = availableQuestions(chosenQuestions, turnCap);
  const questionsLeft = Math.max(0, maxQuestions - session.turns);

  // Where this student left the teacher's list (kept in this browser).
  const assignmentId = session.assignment?.id;
  useEffect(() => {
    if (assignmentId && user) setRound(mysteryRounds.get(assignmentId, user.id));
  }, [assignmentId, user]);

  const roundTitle = roundCharacter?.title;
  useEffect(() => {
    if (roundTitle) {
      setCharacter({ title: roundTitle });
      setConcealed(true); // the teacher chose it: the student must not see it
    }
  }, [roundTitle]);

  useEffect(() => {
    if (preset.questions) setChosenQuestions(preset.questions);
  }, [preset.questions]);

  useEffect(() => {
    if (phase === "chat" && session.turns >= maxQuestions && !guessing && !questionsOver) {
      engine.live.finishLive(); // the voice still says the last answer
      setQuestionsOver(true);
      toast.info(t("platform.apps.personaggioMisterioso.noQuestionsLeft"));
    }
  }, [session.turns, maxQuestions, phase, guessing, questionsOver, engine.live, t]);

  const pickRandom = () => {
    setCharacter({ title: RANDOM_CHARACTERS[Math.floor(Math.random() * RANDOM_CHARACTERS.length)] });
    setConcealed(true);
  };

  const start = async () => {
    if (!character) return;
    setGuessing(false);
    setQuestionsOver(false);
    setEndedByJudge(false);
    setFoundInChat(false);
    setResult(null);
    setGuess("");
    setReasoning("");
    setHintsUsed(0);
    if (!(await flow.begin(t("apps.personaggioMisterioso.title"), { character: character.title, questions: maxQuestions }, []))) return;
    await engine.open({
      recipe,
      name: "???",
      fallback: { role: "assistant", content: t("platform.apps.personaggioMisterioso.intro", { count: maxQuestions }) },
    });
  };

  /**
   * A hint costs a question: the request is a message of the student. The
   * teacher's hints come first, in order; then the character makes one up.
   */
  const askHint = () => {
    // The teacher's hints describe the one character the teacher chose: with
    // a list, or a character picked by the student, they would mislead.
    const teacherHint = fixed.length === 1 ? nextTeacherHint(preset.hints, hintsUsed) : null;
    setHintsUsed((n) => n + 1);
    void engine.runTurn(t("platform.apps.personaggioMisterioso.hintRequest"), async () => {
      if (teacherHint) engine.addMessage({ role: "assistant", name: "???", content: t("platform.apps.personaggioMisterioso.teacherHint", { hint: teacherHint }) });
      else await engine.respond({ recipe, name: "???" });
    });
  };

  /** The game is won in the chat: the character confirmed the name the student said. */
  const found = () => {
    if (!character || foundInChat) return;
    setGuess(lastQuestion.current || character.title); // by voice there is no typed question
    setResult(true);
    setFoundInChat(true);
    setQuestionsOver(true);
    engine.live.finishLive(); // the voice still says the congratulations
    session.markManualEnd();
    if (assignmentId && user && order.length > 1) mysteryRounds.set(assignmentId, user.id, round + 1);
    toast.success(t("platform.apps.personaggioMisterioso.correct", { name: character.title }));
  };
  foundRef.current = found;

  /**
   * A question. One that names the character is judged at once: the judge
   * (for an assignment) decides whether the game is won; without a judge the
   * strict name match does.
   */
  const ask = async (text: string) => {
    if (!character) return;
    const named = isCorrectGuess(text, character.title);
    lastQuestion.current = text;
    await engine.runTurn(text, () => engine.respond({ recipe, name: "???" }), undefined, undefined, named ? { judge: true } : {});
    if (named && !session.judgedLastTurn()) found();
  };

  const submitGuess = () => {
    if (!character) return;
    const ok = isCorrectGuess(guess, character.title);
    setResult(ok);
    engine.addMessage({ role: "system", content: t("platform.apps.personaggioMisterioso.guessLog", { guess, answer: character.title }) });
    void engine.afterTurn({ judge: true }); // the guess may complete the goal after the last question
    session.markManualEnd();
    if (assignmentId && user && order.length > 1) mysteryRounds.set(assignmentId, user.id, round + 1);
    if (ok) toast.success(t("platform.apps.personaggioMisterioso.correct", { name: character.title }));
    else toast.error(t("platform.apps.personaggioMisterioso.wrong", { name: character.title }));
    flow.setPhase("reflection");
  };

  const restart = () =>
    flow.restart(() => {
      if (order.length > 1) setRound((r) => r + 1); // the next character of the list
      if (!fixed.length) {
        setCharacter(null);
        setConcealed(false);
      }
      setGuessing(false);
      setQuestionsOver(false);
      setEndedByJudge(false);
      setFoundInChat(false);
    });

  const guessForm = (
    <SetupCard
      title={t("platform.apps.personaggioMisterioso.finalGuessTitle")}
      description={
        endedByJudge
          ? `${t("platform.apps.personaggioMisterioso.judgeEnded")} ${t("platform.apps.personaggioMisterioso.finalGuessDescription")}`
          : t("platform.apps.personaggioMisterioso.finalGuessDescription")
      }
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
  );

  const startGuess = () => {
    engine.live.stopLive();
    setGuessing(true);
  };
  const chatEndMessage = foundInChat
    ? t("platform.apps.personaggioMisterioso.foundInChat", { name: character?.title })
    : endedByJudge
      ? t("platform.apps.personaggioMisterioso.judgeEndedChat")
      : t("platform.apps.personaggioMisterioso.readLastAnswer");
  // Found in the chat: straight to the reflection; otherwise the guess comes first.
  const afterChat = foundInChat
    ? { label: t("platform.activity.continueToReflection"), go: () => flow.setPhase("reflection") }
    : { label: t("platform.apps.personaggioMisterioso.guessNow"), go: startGuess };

  return (
    <ActivityRunner
      app={app}
      flow={flow}
      onRestart={restart}
      phaseLabels={{ chat: t("platform.apps.personaggioMisterioso.gamePhase") }}
      setup={{
        title: t("platform.apps.personaggioMisterioso.setupTitle"),
        description: t("platform.apps.personaggioMisterioso.setupDescription"),
        canStart: !!character && !loading,
        starting: loading,
        onStart: start,
        children: (
          <>
            {order.length > 1 && (
              <RoundDots
                total={order.length}
                current={round % order.length}
                done={Math.min(round, order.length)}
                label={t("platform.apps.personaggioMisterioso.roundOf", { n: (round % order.length) + 1, total: order.length })}
              />
            )}
            <CharacterPicker
              label={t("platform.apps.personaggioMisterioso.characterLabel")}
              value={character}
              onChange={(v) => {
                setCharacter(v);
                setConcealed(false);
              }}
              locked={fixed.length > 0}
              conceal={concealed}
              hint={t("platform.apps.personaggioMisterioso.characterHint")}
            />
            {!fixed.length && (
              <Button variant="outline" onClick={pickRandom} className="w-full">
                <Dices className="mr-2 h-4 w-4" /> {t("platform.apps.personaggioMisterioso.random")}
              </Button>
            )}
            <div className="space-y-3">
              <Label>{t("platform.apps.personaggioMisterioso.questionsLabel", { count: maxQuestions })}</Label>
              <Slider
                value={[maxQuestions]}
                min={Math.min(QUESTIONS.min, maxQuestions)}
                max={availableQuestions(SLIDER_MAX_QUESTIONS, turnCap)}
                step={1}
                onValueChange={(v) => setChosenQuestions(v[0])}
                disabled={!!preset.questions}
              />
            </div>
            <DifficultyPicker app="personaggioMisterioso" value={level} onChange={(v) => setChosenLevel(v)} locked={!!preset.difficulty} />
          </>
        ),
      }}
      chat={{
        ready: !!character,
        replacement: guessing ? guessForm : undefined,
        onSend: (text) => void ask(text),
        placeholder: t("platform.apps.personaggioMisterioso.placeholder"),
        live: engine.live,
        disabled: questionsOver || questionsLeft === 0 || engine.ended,
        disabledReason: chatEndMessage,
        onEnd: startGuess,
        endLabel: t("platform.apps.personaggioMisterioso.guessNow"),
        // Out of questions: read the last answer, then guess (never straight to the reflection).
        ended: questionsOver || engine.ended
          ? { message: chatEndMessage, continueLabel: afterChat.label, onContinue: afterChat.go }
          : null,
        canEnd: session.turns >= 1 || questionsOver,
        toolbar: !questionsOver && questionsLeft > 0 && !engine.ended ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{t("platform.apps.personaggioMisterioso.hintCost")}</span>
            <Button type="button" variant="outline" size="sm" onClick={askHint} disabled={engine.busy}>
              <Lightbulb className="mr-2 h-4 w-4" />{t("platform.apps.personaggioMisterioso.askHint")}
            </Button>
          </div>
        ) : undefined,
        footerNote: (
          <span className="inline-flex items-center gap-1">
            <HelpCircle className="h-3.5 w-3.5" /> {t("platform.apps.personaggioMisterioso.questionsLeft", { count: questionsLeft })}
          </span>
        ),
      }}
      reflection={{
        prompt: t("platform.apps.personaggioMisterioso.reflectionPrompt"),
        showEndReason: false,
        summary: (
          <div className="story-pop flex items-center gap-3 rounded-md border border-border bg-background/50 p-4">
            {result ? <CheckCircle2 className="h-8 w-8 text-primary" /> : <XCircle className="h-8 w-8 text-destructive" />}
            <div>
              <p className="font-semibold">{result ? t("platform.apps.personaggioMisterioso.correctShort") : t("platform.apps.personaggioMisterioso.wrongShort")}</p>
              <p className="text-sm text-muted-foreground">{t("platform.apps.personaggioMisterioso.answerWas", { name: character?.title, guess })}</p>
            </div>
          </div>
        ),
        brief: () => ({
          activity: `${t("apps.personaggioMisterioso.title")}: ${t("platform.apps.personaggioMisterioso.evalActivity")}`,
          characters: character?.title ?? "",
          extraFacts: [
            foundInChat
              ? `IDENTIFIED IN THE CONVERSATION: the student named the character ("${guess}") and the character confirmed it (answer: ${character?.title})`
              : `FINAL GUESS: ${guess} — ${result ? "CORRECT" : "WRONG"} (answer: ${character?.title})`,
            ...(foundInChat ? [] : [`STUDENT REASONING: ${reasoning}`]),
            `QUESTIONS USED: ${session.turns}/${maxQuestions} (of which hints asked: ${hintsUsed})`,
          ],
        }),
      }}
      feedback={{
        title: `${t("apps.personaggioMisterioso.title")} - ${character?.title ?? ""}`,
        facts: [
          { label: t("platform.apps.common.character"), value: character?.title },
          { label: t("platform.apps.personaggioMisterioso.guessLabel"), value: `${guess} ${result ? "✅" : "❌"}` },
          { label: t("platform.apps.personaggioMisterioso.questionsUsed"), value: `${session.turns}/${maxQuestions}` },
          { label: t("platform.apps.personaggioMisterioso.hintsUsed"), value: String(hintsUsed) },
          { label: t("platform.difficulty.label"), value: t(`platform.difficulty.levels.${level}`) },
        ],
        restartLabel: moreRounds ? t("platform.apps.personaggioMisterioso.nextCharacter", { n: round + 2, total: order.length }) : undefined,
      }}
    />
  );
};

export default PersonaggioMisteriosoPage;
