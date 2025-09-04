import i18n from '@/i18n';

export interface PromptTranslationParams {
  [key: string]: string | undefined;
  name?: string;
  bio?: string;
  style?: string;
  character?: string;
  theme?: string;
  content?: string;
  message?: string;
  error?: string;
  snippet?: string;
  topic?: string;
}

export const getTranslatedSystemInstruction = (
  type: 'character' | 'dialogue' | 'evaluation' | 'convinciTu',
  params: PromptTranslationParams = {}
): string => {
  const key = `ai.systemInstructions.${type}`;
  return i18n.t(key, params);
};

export const buildConvinciTuSystemInstruction = (
  characterName: string,
  prompt: string
): string => {
  return getTranslatedSystemInstruction('convinciTu', {
    name: characterName,
    prompt: prompt
  });
};

export const getTranslatedPrompt = (
  promptKey: string,
  params: PromptTranslationParams = {}
): string => {
  const key = `ai.prompts.${promptKey}`;
  return i18n.t(key, params);
};

export const getTranslatedLabel = (labelType: 'user' | 'student' | 'system' | 'moderator'): string => {
  return i18n.t(`ai.prompts.${labelType}Label`);
};

export const buildCharacterSystemInstruction = (
  characterName: string,
  characterBio: string
): string => {
  return getTranslatedSystemInstruction('character', {
    name: characterName,
    bio: characterBio
  });
};

export const buildDialogueSystemInstruction = (
  characterName: string,
  characterBio: string,
  dialogueStyle: string
): string => {
  return getTranslatedSystemInstruction('dialogue', {
    name: characterName,
    bio: characterBio,
    style: dialogueStyle
  });
};

export const buildDialoguePrompt = (
  characterName: string,
  targetCharacter: string,
  theme: string,
  recentMessages: Array<{role: string; character: string; content: string}>,
  userMessage?: string
): string => {
  const contextPrompt = getTranslatedPrompt('dialogueContext', {
    character: targetCharacter,
    theme: theme
  });

  let prompt = `${contextPrompt}\n\n${getTranslatedPrompt('recentMessages')}\n`;

  recentMessages.forEach(msg => {
    if (msg.role === "system") {
      prompt += `${getTranslatedPrompt('systemNotice', { content: msg.content })}\n`;
    } else {
      prompt += `${msg.character}: ${msg.content}\n`;
    }
  });

  if (userMessage) {
    prompt += `${getTranslatedPrompt('moderatorResponse', { message: userMessage })}\n`;
    prompt += `\n${getTranslatedPrompt('respondToModerator', { character: targetCharacter, name: characterName })}`;
  } else {
    prompt += `\n${getTranslatedPrompt('continueDiscussion', { character: targetCharacter, theme: theme, name: characterName })}`;
  }

  return prompt;
};

export const getErrorMessage = (type: 'noResponse' | 'apologeticError', error?: string): string => {
  if (type === 'noResponse') {
    return getTranslatedPrompt('noResponseMoment');
  } else {
    const baseMessage = getTranslatedPrompt('apologeticError');
    if (error) {
      return baseMessage + getTranslatedPrompt('errorDetails', { error });
    }
    return baseMessage;
  }
};

export const buildEvaluationSystemInstruction = (
  character: string,
  topic: string,
  characterSnippet?: string
): string => {
  const baseInstruction = getTranslatedSystemInstruction('evaluation');
  
  const contextSection = i18n.t('evaluation.context');
  const gameDescription = i18n.t('evaluation.gameDescription', { character });
  const snippetInfo = characterSnippet 
    ? i18n.t('evaluation.characterSnippet', { snippet: characterSnippet })
    : i18n.t('evaluation.characterSnippet', { snippet: 'Non fornito' });
  const themeInfo = i18n.t('evaluation.generalTheme', { topic });
  
  const analysisRequired = i18n.t('evaluation.analysisRequired');
  const analysisDescription = i18n.t('evaluation.analysisDescription');
  
  const conversationEval = i18n.t('evaluation.conversationEvaluation');
  const conversationCriteria = i18n.t('evaluation.conversationCriteria');
  const conversationScore = i18n.t('evaluation.conversationScore');
  const conversationRationale = i18n.t('evaluation.conversationRationale');
  
  const reflectionEval = i18n.t('evaluation.reflectionEvaluation');
  const reflectionCriteria = i18n.t('evaluation.reflectionCriteria');
  const reflectionScore = i18n.t('evaluation.reflectionScore');
  const reflectionRationale = i18n.t('evaluation.reflectionRationale');
  
  const overallFeedback = i18n.t('evaluation.overallFeedback');
  const feedbackFormat = i18n.t('evaluation.feedbackFormat');
  const feedbackIncludes = i18n.t('evaluation.feedbackIncludes');
  const strengths = i18n.t('evaluation.strengths');
  const improvements = i18n.t('evaluation.improvements');
  const additionalComments = i18n.t('evaluation.additionalComments');
  const constructiveTone = i18n.t('evaluation.constructiveTone');
  
  const responseFormat = i18n.t('evaluation.responseFormat');
  const placeholderInstructions = i18n.t('evaluation.placeholderInstructions');
  const importantNote = i18n.t('evaluation.importantNote');
  const exampleResponse = i18n.t('evaluation.exampleResponse');

  return `${baseInstruction}

${contextSection}
${gameDescription}
${snippetInfo}
${themeInfo}

${analysisRequired}
${analysisDescription}

1.  ${conversationEval}
    *   ${conversationCriteria}
    *   ${conversationScore}
    *   ${conversationRationale}

2.  ${reflectionEval}
    *   ${reflectionCriteria}
    *   ${reflectionScore}
    *   ${reflectionRationale}

3.  ${overallFeedback}
    *   ${feedbackFormat}
    *   ${feedbackIncludes}
        *   ${strengths}
        *   ${improvements}
        *   ${additionalComments}
    *   ${constructiveTone}

IMPORTANT: When creating tables in markdown, use proper table syntax:
- Use pipes (|) to separate columns
- Use a header row followed by a separator row with dashes (---)
- Example:
| Category | Score | Feedback |
|----------|-------|----------|
| Questioning Strategy | 7 | Good approach |
| Deduction Ability | 8 | Excellent reasoning |

${responseFormat}
${placeholderInstructions}
PUNTEGGIO_CONVERSAZIONE: [numero]
MOTIVAZIONE_CONVERSAZIONE: [testo della motivazione]
PUNTEGGIO_RIFLESSIONE: [numero]
MOTIVAZIONE_RIFLESSIONE: [testo della motivazione]

${importantNote}

${exampleResponse}
PUNTEGGIO_CONVERSAZIONE: 7
MOTIVAZIONE_CONVERSAZIONE: Lo studente ha posto domande pertinenti, mostrando una buona capacità di restringere il campo. Alcune domande avrebbero potuto essere più dirette per massimizzare le informazioni ottenute.
PUNTEGGIO_RIFLESSIONE: 8
MOTIVAZIONE_RIFLESSIONE: La riflessione dimostra una buona autoconsapevolezza e un'analisi critica del proprio operato. Lo studente ha identificato chiaramente cosa ha funzionato e cosa no.

**Punti di Forza Complessivi:**
*   Buona strategia di domande nel gioco.
*   Riflessione ben strutturata e onesta.

**Aree di Miglioramento Complessive:**
*   Potrebbe sfruttare meglio ogni domanda per ottenere più indizi.
*   Approfondire ulteriormente il collegamento tra il gioco e l'apprendimento storico nella riflessione.`;
};
