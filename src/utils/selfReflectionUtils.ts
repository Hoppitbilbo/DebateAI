
import { Message } from "@/types/conversation";
import { ReflectionData } from "@/types/reflection";
// import { generateGeminiEvaluation } from "./geminiUtils"; // No longer using direct GeminiUtils here
import { conversationToString } from "./characterDialogueUtils";
import { getResponse, isAiServiceAvailable } from '@/services/aiService';

export interface SessionData {
  characterName: string;
  topic: string;
  objective: string;
  messages: Message[];
  // Add characterSnippet if available and useful for evaluation context
  characterSnippet?: string; 
}

/**
 * Prepares a detailed prompt for evaluating a student's reflection.
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
 * Generates an AI evaluation for a student's reflection using the Firebase Vertex AI model.
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
 * Legacy function, might be deprecated or refactored if ConvinciTuInterface directly uses 
 * generateReflectionEvaluation via evaluationUtils.ts. 
 * For now, keeping its structure but it calls the new generateReflectionEvaluation logic.
 */
export const processReflection = async (
  reflection: string,
  messages: Message[],
  activityType: string, // Used to form parts of SessionData like 'objective'
  characterName: string,
  topic: string,
  characterSnippet?: string
): Promise<ReflectionData> => {
  
  const sessionData: SessionData = {
    characterName,
    topic,
    objective: activityType, // Or be more specific e.g. `Convincere ${characterName} su ${topic}`
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
    // Error is already handled and logged in generateReflectionEvaluation
    // This function will return the error message as aiEvaluation
    return {
      userReflection: reflection,
      aiEvaluation: error instanceof Error ? error.message : "Errore durante l'elaborazione della riflessione.",
      timestamp: new Date().toISOString()
    };
  }
};
