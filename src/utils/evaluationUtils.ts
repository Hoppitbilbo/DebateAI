import i18n from "@/i18n";
import type { Assignment, JudgeResult } from "@/lib/api";
import { AiClient, httpAiClient } from "@/services/aiClient";
import type { ActivityMessage } from "@/features/activity/types";

export interface EvaluationInput {
  activity: string; // e.g. "Convince YOU: persuade Napoleon about ..."
  characters: string; // AI characters involved
  studentRole?: string; // who the student plays, if any
  topic?: string;
  messages: ActivityMessage[];
  reflection: string;
  extraFacts?: string[]; // e.g. "Final guess: Cleopatra (correct)"
  assignment?: Assignment | null;
  jev?: JudgeResult | null;
  sessionId?: number | null;
}

export interface EvaluationResult {
  markdown: string;
  scoreConversation?: number;
  scoreReflection?: number;
}

const LANGUAGES: Record<string, string> = { it: "Italian", en: "English", es: "Spanish", fr: "French", de: "German" };

const SCORE_RE = /SCORE_(CONVERSATION|REFLECTION)\s*[:=]\s*(\d{1,2})(?:\s*\/\s*10)?/gi;

export const parseEvaluation = (text: string): EvaluationResult => {
  const res: EvaluationResult = { markdown: text };
  for (const m of text.matchAll(SCORE_RE)) {
    const v = Math.max(0, Math.min(10, parseInt(m[2], 10)));
    if (m[1].toUpperCase() === "CONVERSATION") res.scoreConversation = v;
    else res.scoreReflection = v;
  }
  res.markdown = text.replace(SCORE_RE, "").replace(/\n{3,}/g, "\n\n").trim();
  return res;
};

const buildPrompt = (input: EvaluationInput) => {
  const lang = LANGUAGES[(i18n.language || "it").slice(0, 2)] ?? "Italian";
  const student = i18n.t("platform.common.student");
  const transcript = input.messages
    .filter((m) => m.content.trim() && !m.error)
    .map((m) => `${m.role === "user" ? (input.studentRole ? `${student} (${input.studentRole})` : student) : m.role === "system" ? "SYSTEM" : m.name || "AI"}: ${m.content}`)
    .join("\n");

  const system = `You are an experienced, encouraging teacher evaluating a learning activity in which a student talked with AI characters, followed by a written self-reflection.
Write the whole evaluation in ${lang}, in Markdown, addressed directly to the student ("you").
Structure:
## <a short title>
A 2-3 sentence overall judgement.
### ${lang === "Italian" ? "Punti di forza" : "Strengths"} (bullet list, quote concrete moments of the conversation)
### ${lang === "Italian" ? "Cosa migliorare" : "What to improve"} (bullet list, concrete and actionable)
### ${lang === "Italian" ? "Sulla tua riflessione" : "About your reflection"}
If a teacher assignment is given, add a section that checks each goal explicitly (✅ / ⚠️).
Optionally a small Markdown table summarising the criteria.
Finish with EXACTLY these two lines (integers from 0 to 10, no other text on them):
SCORE_CONVERSATION: <n>
SCORE_REFLECTION: <n>
Be fair: short or superficial work gets low scores; never invent things the student did not do.`;

  const parts: string[] = [`ACTIVITY: ${input.activity}`, `AI CHARACTERS: ${input.characters}`];
  if (input.studentRole) parts.push(`STUDENT ROLE: ${input.studentRole}`);
  if (input.topic) parts.push(`TOPIC: ${input.topic}`);
  if (input.assignment) {
    parts.push(`TEACHER ASSIGNMENT: ${input.assignment.title}\n${input.assignment.instructions}`);
    if (input.assignment.goals.length) parts.push(`GOALS:\n${input.assignment.goals.map((g, i) => `${i + 1}. ${g}`).join("\n")}`);
  }
  if (input.jev?.goals?.length) {
    parts.push(`AUTOMATIC JUDGE (JEV) RESULT: progress ${input.jev.progress}%\n${input.jev.goals.map((g) => `- ${g.met ? "met" : "not met"} (${Math.round(g.score * 100)}%): ${g.text}`).join("\n")}`);
  }
  for (const f of input.extraFacts ?? []) parts.push(f);
  parts.push(`CONVERSATION:\n${transcript || "(empty)"}`);
  parts.push(`STUDENT SELF-REFLECTION:\n${input.reflection || "(none)"}`);
  return { system, prompt: parts.join("\n\n") };
};

/** Streams the final evaluation through the gateway ("evaluation" task). */
export const evaluateActivity = async (
  input: EvaluationInput,
  onPartial?: (markdown: string) => void,
  ai: Pick<AiClient, "generateStream"> = httpAiClient,
): Promise<EvaluationResult> => {
  const { system, prompt } = buildPrompt(input);
  const text = await ai.generateStream(
    { task: "evaluation", system, messages: [{ role: "user", content: prompt }], sessionId: input.sessionId, maxTokens: 2500 },
    (_d, full) => onPartial?.(parseEvaluation(full).markdown),
  );
  return parseEvaluation(text);
};
