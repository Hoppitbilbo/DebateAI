/**
 * @file Utility functions for handling the self-reflection process.
 * @remarks This file includes functions to prepare evaluation prompts and generate AI-driven
 * feedback on a user's self-reflection based on their performance in an activity.
 */

import { Message } from "@/types/conversation";
import { ReflectionData } from "@/types/reflection";
import { conversationToString } from "./characterDialogueUtils";
import { getResponse, isAiServiceAvailable } from '@/services/aiService';

/**
 * @interface SessionData
 * @description Defines the data required for a reflection evaluation session.
 * @property {string} characterName - The name of the character involved in the activity.
 * @property {string} topic - The topic of the activity.
 * @property {string} objective - The objective of the activity.
 * @property {Message[]} messages - The conversation history.
 * @property {string} [characterSnippet] - An optional snippet of the character's bio for context.
 */
export interface SessionData {
  characterName: string;
  topic: string;
  objective: string;
  messages: Message[];
  characterSnippet?: string; 
}

/**
 * @function prepareReflectionEvaluationPrompt
 * @description Prepares a detailed system instruction and data prompt for evaluating a student's reflection.
 * @param {object} params - The parameters for preparing the prompt.
 * @param {SessionData} params.sessionData - The data from the user's session.
 * @param {string} params.userReflection - The user's written reflection.
 * @returns {{ systemInstruction: string, dataPrompt: string }} An object containing the system instruction and the data prompt.
 */
export const prepareReflectionEvaluationPrompt = (
  { sessionData, userReflection }: { sessionData: SessionData; userReflection: string }
): {
  systemInstruction: string;
  dataPrompt: string;
} => {
  const messagesText = conversationToString(sessionData.messages);

  const systemInstruction = `Sei un assistente educativo esperto. Il tuo compito è valutare la riflessione di uno studente sull'attività "${sessionData.objective || 'ConvinciTu'}".
Durante l'attività, lo studente ha cercato di convincere il personaggio ${sessionData.characterName} riguardo al tema "${sessionData.topic}".
Analizza la riflessione dello studente basandoti sulla trascrizione della conversazione fornita, sul profilo del personaggio e sulla riflessione stessa.

Valuta in particolare:
1. Profondità di analisi e comprensione del punto di vista del personaggio.
2. Qualità delle argomentazioni usate dallo studente durante la conversazione.
3. Capacità dello studente di riflettere criticamente sulla propria strategia di persuasione.
4. Auto-consapevolezza sui punti di forza e sulle aree di miglioramento nella propria argomentazione e riflessione.
5. Chiarezza e coerenza della riflessione.

Fornisci un feedback costruttivo e dettagliato. Mantieni un tono incoraggiante e di supporto.
Formatta la tua risposta in Markdown, usando sezioni chiare come "Analisi della Conversazione e Strategia", "Valutazione della Riflessione", "Punti di Forza", "Aree di Miglioramento" e "Feedback Generale".`;

  const dataPrompt = `CONTESTO DELL'ATTIVITÀ:
Personaggio: ${sessionData.characterName} ${sessionData.characterSnippet ? `(Profilo: "${sessionData.characterSnippet}")` : ''}
Tema della persuasione: ${sessionData.topic}
Obiettivo dello studente: ${sessionData.objective}

TRASCRIZIONE DELLA CONVERSAZIONE:
${messagesText}

RIFLESSIONE DELLO STUDENTE:
${userReflection}

Valuta la riflessione dello studente in base a tutti questi elementi, seguendo le direttive fornite.`;

  return { systemInstruction, dataPrompt };
};

/**
 * @function generateReflectionEvaluation
 * @description Generates an AI evaluation for a student's reflection using the AI service.
 * @param {SessionData} sessionData - The data from the user's session.
 * @param {string} userReflection - The user's written reflection.
 * @returns {Promise<string>} A promise that resolves to the AI's textual evaluation.
 */
export const generateReflectionEvaluation = async (
  sessionData: SessionData,
  userReflection: string
): Promise<string> => {
  if (!isAiServiceAvailable()) {
    return 'Servizio AI non disponibile. Impossibile generare la valutazione.';
  }

  const { systemInstruction, dataPrompt } = prepareReflectionEvaluationPrompt({
    sessionData,
    userReflection,
  });

  try {
    const evaluation = await getResponse(dataPrompt, systemInstruction);
    return evaluation.trim() !== ''
      ? evaluation.trim()
      : 'La valutazione AI non ha prodotto un risultato valido.';
  } catch (error) {
    console.error('Error generating AI reflection evaluation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
    return `Non è stato possibile generare una valutazione AI della riflessione. Dettagli: ${errorMessage}`;
  }
};


/**
 * @function processReflection
 * @description A legacy function to process a reflection, now acting as a wrapper around `generateReflectionEvaluation`.
 * @deprecated This function may be refactored or removed in the future.
 * @param {string} reflection - The user's reflection text.
 * @param {Message[]} messages - The conversation history.
 * @param {string} activityType - The type of activity.
 * @param {string} characterName - The name of the character.
 * @param {string} topic - The topic of the activity.
 * @param {string} [characterSnippet] - An optional character snippet.
 * @returns {Promise<ReflectionData>} A promise that resolves to the reflection data, including the AI evaluation.
 */
export const processReflection = async (
  reflection: string,
  messages: Message[],
  activityType: string,
  characterName: string,
  topic: string,
  characterSnippet?: string
): Promise<ReflectionData> => {
  
  const sessionData: SessionData = {
    characterName,
    topic,
    objective: activityType,
    messages,
    characterSnippet
  };

  try {
    const evaluation = await generateReflectionEvaluation(sessionData, reflection);
    
    return {
      userReflection: reflection,
      aiEvaluation: evaluation,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      userReflection: reflection,
      aiEvaluation: error instanceof Error ? error.message : "Errore durante l'elaborazione della riflessione.",
      timestamp: new Date().toISOString()
    };
  }
};
