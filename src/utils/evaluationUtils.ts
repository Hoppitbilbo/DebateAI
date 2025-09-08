/**
 * @file Utility functions for evaluating user performance in educational activities using AI.
 * @remarks This file contains functions for parsing AI responses, building evaluation prompts,
 * and generating structured feedback, including scores and rationales.
 */

import { Message } from "@/types/conversation";
import { model, generateContentStream } from "@/services/aiService";
import { getTranslatedSystemInstruction, getTranslatedPrompt } from "./aiPromptUtils";

/**
 * @interface ConversationData
 * @description Defines the data structure representing a completed conversation for evaluation.
 * @property {string} character - The name(s) of the character(s) involved.
 * @property {string} topic - The topic of the conversation.
 * @property {Message[]} messages - The full conversation history.
 * @property {string} [characterSnippet] - An optional snippet of the character's biography for context.
 */
export interface ConversationData {
  character: string;
  topic: string;
  messages: Message[];
  characterSnippet?: string;
}

/**
 * @interface AIScoreEvaluation
 * @description Defines the structure for a detailed AI evaluation, including scores and feedback.
 * @property {string} textualFeedback - The main textual feedback from the AI.
 * @property {number} [conversationScore] - An optional score for the conversation quality.
 * @property {string} [conversationRationale] - An optional rationale for the conversation score.
 * @property {number} [reflectionScore] - An optional score for the user's reflection.
 * @property {string} [reflectionRationale] - An optional rationale for the reflection score.
 */
export interface AIScoreEvaluation {
  textualFeedback: string;
  conversationScore?: number;
  conversationRationale?: string;
  reflectionScore?: number;
  reflectionRationale?: string;
}

/**
 * @function parseAIScoreResponse
 * @description Parses a raw text response from the AI to extract structured data like scores and rationales.
 * @param {string} responseText - The raw text response from the AI.
 * @returns {AIScoreEvaluation} A structured evaluation object.
 */
const parseAIScoreResponse = (responseText: string): AIScoreEvaluation => {
  const evaluation: AIScoreEvaluation = { textualFeedback: responseText };

  const extractValue = (regex: RegExp): string | undefined => {
    const match = responseText.match(regex);
    return match?.[1]?.trim();
  };

  const conversationScoreStr = extractValue(/PUNTEGGIO_CONVERSAZIONE:\s*(\d+)/);
  if (conversationScoreStr) {
    evaluation.conversationScore = parseInt(conversationScoreStr, 10);
  }

  evaluation.conversationRationale = extractValue(
    /MOTIVAZIONE_CONVERSAZIONE:\s*([\s\S]*?)(?:PUNTEGGIO_RIFLESSIONE:|MOTIVAZIONE_RIFLESSIONE:|$)/
  );

  const reflectionScoreStr = extractValue(/PUNTEGGIO_RIFLESSIONE:\s*(\d+)/);
  if (reflectionScoreStr) {
    evaluation.reflectionScore = parseInt(reflectionScoreStr, 10);
  }

  evaluation.reflectionRationale = extractValue(
    /MOTIVAZIONE_RIFLESSIONE:\s*([\s\S]*?)(?:PUNTEGGIO_CONVERSAZIONE:|MOTIVAZIONE_CONVERSAZIONE:|$)/
  );
  
  let cleanedText = responseText;
  const patternsToRemove = [
    /PUNTEGGIO_CONVERSAZIONE:\s*\d+\s*/gi,
    /MOTIVAZIONE_CONVERSAZIONE:\s*[\s\S]*?(?:PUNTEGGIO_RIFLESSIONE:|MOTIVAZIONE_RIFLESSIONE:|$)/gi,
    /PUNTEGGIO_RIFLESSIONE:\s*\d+\s*/gi,
    /MOTIVAZIONE_RIFLESSIONE:\s*[\s\S]*?(?:PUNTEGGIO_CONVERSAZIONE:|MOTIVAZIONE_CONVERSAZIONE:|$)/gi,
  ];

  patternsToRemove.forEach(pattern => {
    cleanedText = cleanedText.replace(pattern, '');
  });

  evaluation.textualFeedback = cleanedText.replace(/\n+/g, '\n').trim();

  if (evaluation.textualFeedback.startsWith("PUNTEGGIO_RIFLESSIONE:")) {
      evaluation.textualFeedback = "";
  }
   if (evaluation.textualFeedback.startsWith("MOTIVAZIONE_RIFLESSIONE:")) {
      evaluation.textualFeedback = evaluation.textualFeedback.substring("MOTIVAZIONE_RIFLESSIONE:".length).trim();
  }

  if (evaluation.textualFeedback.match(/^(PUNTEGGIO_|MOTIVAZIONE_)(CONVERSAZIONE|RIFLESSIONE):/i)) {
    evaluation.textualFeedback = "";
  }

  if (/^\d+$/.test(evaluation.textualFeedback)) {
    evaluation.textualFeedback = ""; 
  }

  return evaluation;
};

/**
 * @function buildSystemInstruction
 * @description Builds the system instruction for an evaluation request.
 * @param {ConversationData} conversationData - The data from the conversation.
 * @returns {string} The system instruction string.
 */
const buildSystemInstruction = (conversationData: ConversationData): string => {
  return getTranslatedSystemInstruction('evaluation', {
    character: conversationData.character,
    snippet: conversationData.characterSnippet || '',
    topic: conversationData.topic
  });
};

/**
 * @function getAIGameAndReflectionEvaluationStream
 * @description Generates a streaming evaluation of a game and reflection.
 * @param {ConversationData} conversationData - The data from the conversation.
 * @param {string} userReflection - The user's written reflection.
 * @returns {AsyncGenerator<{ partial: string; complete?: AIScoreEvaluation }, void, unknown>} An async generator that yields partial text and the final complete evaluation.
 */
export const getAIGameAndReflectionEvaluationStream = async function* (
  conversationData: ConversationData,
  userReflection: string
): AsyncGenerator<{ partial: string; complete?: AIScoreEvaluation }, void, unknown> {
  try {
    const conversationText = conversationData.messages
      .map((msg) => {
        const speaker = msg.role === "user" ? getTranslatedPrompt('studentLabel', {}) : conversationData.character;
        return `${speaker}: ${msg.content}`;
      })
      .join("\n\n");
    
    const systemInstruction = buildSystemInstruction(conversationData);
    
    const dataPrompt = getTranslatedPrompt('evaluation', {
      conversationText,
      userReflection
    });
    
    let accumulatedText = "";
    
    for await (const chunk of generateContentStream({
      contents: [{ role: "user", parts: [{ text: dataPrompt }] }],
      systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
    })) {
      accumulatedText += chunk;
      yield { partial: accumulatedText };
    }
    
    const evaluationOutput = parseAIScoreResponse(accumulatedText);
    
    if (!evaluationOutput.textualFeedback || typeof evaluationOutput.textualFeedback !== 'string' || evaluationOutput.textualFeedback.trim() === '') {
      const conversationScore = evaluationOutput.conversationScore || 'N/A';
      const reflectionScore = evaluationOutput.reflectionScore || 'N/A';
      const conversationRationale = evaluationOutput.conversationRationale || getTranslatedPrompt('noRationale', {});
      const reflectionRationale = evaluationOutput.reflectionRationale || getTranslatedPrompt('noRationale', {});
      
      const fallbackMarkdown = getTranslatedPrompt('evaluationFallback', {
        conversationScore: conversationScore.toString(),
        reflectionScore: reflectionScore.toString(),
        conversationRationale,
        reflectionRationale
      });
      
      const aiProvidedTextualFeedback = evaluationOutput.textualFeedback.trim();
      
      evaluationOutput.textualFeedback = fallbackMarkdown + 
        (aiProvidedTextualFeedback ? `\n${getTranslatedPrompt('overallFeedback', {})}\n\n${aiProvidedTextualFeedback}` : `\n${getTranslatedPrompt('overallFeedback', {})}\n\n${getTranslatedPrompt('defaultFeedback', {})}`);
    }
    
    yield { partial: accumulatedText, complete: evaluationOutput };
  } catch (error) {
    console.error("Error in getAIGameAndReflectionEvaluationStream:", error);
    const errorEvaluation: AIScoreEvaluation = {
      conversationScore: 0,
      reflectionScore: 0,
      textualFeedback: getTranslatedPrompt('error', { error: 'Evaluation error occurred' }),
      conversationRationale: getTranslatedPrompt('evaluationError', {}),
      reflectionRationale: getTranslatedPrompt('evaluationError', {})
    };
    yield { partial: errorEvaluation.textualFeedback, complete: errorEvaluation };
  }
};

/**
 * @function getAIGameAndReflectionEvaluation
 * @description Generates a non-streaming evaluation of a game and reflection.
 * @param {ConversationData} conversationData - The data from the conversation.
 * @param {string} userReflection - The user's written reflection.
 * @returns {Promise<AIScoreEvaluation>} A promise that resolves to the complete, structured AI evaluation.
 */
export const getAIGameAndReflectionEvaluation = async (
  conversationData: ConversationData,
  userReflection: string
): Promise<AIScoreEvaluation> => {
  try {
    const conversationText = conversationData.messages
      .map((msg) => {
        const speaker = msg.role === "user" ? getTranslatedPrompt('studentLabel', {}) : conversationData.character;
        return `${speaker}: ${msg.content}`;
      })
      .join("\n\n");
    
    const systemInstruction = buildSystemInstruction(conversationData);
    
    const dataPrompt = getTranslatedPrompt('evaluation', {
      conversationText,
      userReflection
    });
    
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: dataPrompt }] }],
      systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
    });
    
    let evaluationOutput: AIScoreEvaluation;

    if (result.response && typeof result.response.text === 'function') {
      const rawResponse = result.response.text();
      if (typeof rawResponse === 'string') {
        evaluationOutput = parseAIScoreResponse(rawResponse);
      } else {
        console.error("Error in getAIGameAndReflectionEvaluation: AI response text is not a string.");
        evaluationOutput = {
          textualFeedback: getTranslatedPrompt('error', { error: 'Invalid response from model' }),
        };
      }
    } else {
      console.error("Error in getAIGameAndReflectionEvaluation: AI response structure is invalid.");
      evaluationOutput = {
        textualFeedback: getTranslatedPrompt('error', { error: 'Invalid response structure from model' }),
      };
    }
    
    if (!evaluationOutput.textualFeedback || typeof evaluationOutput.textualFeedback !== 'string' || evaluationOutput.textualFeedback.trim() === '') {
      const conversationScore = evaluationOutput.conversationScore || 'N/A';
      const reflectionScore = evaluationOutput.reflectionScore || 'N/A';
      const conversationRationale = evaluationOutput.conversationRationale || getTranslatedPrompt('noRationale', {});
      const reflectionRationale = evaluationOutput.reflectionRationale || getTranslatedPrompt('noRationale', {});
      
      const fallbackMarkdown = getTranslatedPrompt('evaluationFallback', {
        conversationScore: conversationScore.toString(),
        reflectionScore: reflectionScore.toString(),
        conversationRationale,
        reflectionRationale
      });
      
      const aiProvidedTextualFeedback = evaluationOutput.textualFeedback.trim();
      
      evaluationOutput.textualFeedback = fallbackMarkdown + 
        (aiProvidedTextualFeedback ? `\n${getTranslatedPrompt('overallFeedback', {})}\n\n${aiProvidedTextualFeedback}` : `\n${getTranslatedPrompt('overallFeedback', {})}\n\n${getTranslatedPrompt('defaultFeedback', {})}`);
    }
    
    return evaluationOutput;
  } catch (error) {
    console.error("Error in getAIGameAndReflectionEvaluation:", error);
    return {
      conversationScore: 0,
      reflectionScore: 0,
      textualFeedback: getTranslatedPrompt('error', { error: 'Evaluation error occurred' }),
      conversationRationale: getTranslatedPrompt('evaluationError', {}),
      reflectionRationale: getTranslatedPrompt('evaluationError', {})
    };
  }
};

/**
 * @function evaluateReflection
 * @description A deprecated function to evaluate a user's reflection.
 * @deprecated Use `getAIGameAndReflectionEvaluation` instead.
 * @param {ConversationData} conversationData - The data from the conversation.
 * @param {string} userReflection - The user's written reflection.
 * @param {string} [characterSnippet] - An optional character snippet.
 * @returns {Promise<string>} The raw text of the AI's evaluation.
 */
export const evaluateReflection = async (
  conversationData: ConversationData,
  userReflection: string,
  characterSnippet?: string
): Promise<string> => {
  console.warn(getTranslatedPrompt('deprecatedFunction', {}));

  const mockPrepareReflectionEvaluationPrompt = (args: any): { systemInstruction: string, dataPrompt: string } => {
    return {
      systemInstruction: "Mock system instruction per evaluateReflection (deprecata)",
      dataPrompt: `Mock data prompt per evaluateReflection (deprecata):
        Personaggio: ${args.sessionData.characterName}
        Topic: ${args.sessionData.topic}
        Riflessione: ${args.userReflection}`
    };
  };

  const { systemInstruction: oldSystemInstruction, dataPrompt: oldDataPrompt } = mockPrepareReflectionEvaluationPrompt({
    sessionData: {
      characterName: conversationData.character,
      topic: conversationData.topic,
      messages: conversationData.messages,
      objective: `Convincere ${conversationData.character} riguardo ${conversationData.topic}`,
      characterSnippet: characterSnippet,
    },
    userReflection
  });

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: oldDataPrompt }] }],
      systemInstruction: {
        role: "system",
        parts: [{ text: oldSystemInstruction }]
      },
    });

    if (result.response && typeof result.response.text === 'function') {
      const evaluation = result.response.text();
      if (typeof evaluation === 'string' && evaluation.trim() !== "") {
        return evaluation.trim();
      }
      return getTranslatedPrompt('deprecatedNoResult', {});
    }
    return getTranslatedPrompt('deprecatedInvalidResponse', {});

  } catch (error) {
    console.error("Error in DEPRECATED evaluateReflection:", error);
    const errorMessage = error instanceof Error ? error.message : getTranslatedPrompt('unknownError', {});
    return getTranslatedPrompt('deprecatedError', { error: errorMessage });
  }
};

/**
 * @function getAICombinedEvaluation
 * @description An obsolete function for evaluation.
 * @deprecated This function is no longer in use.
 * @returns {Promise<string>} A message indicating the function is obsolete.
 */
export const getAICombinedEvaluation = async (
  conversationData: ConversationData,
  userReflection: string
): Promise<string> => {
  console.warn(getTranslatedPrompt('obsoleteFunction', {}));

  return getTranslatedPrompt('obsoleteFunctionMessage', {});
};
