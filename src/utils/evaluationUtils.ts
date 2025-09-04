
import { Message } from "@/types/conversation";
import { model, generateContentStream } from "@/services/aiService"; // Import the model instance and streaming
import { getTranslatedSystemInstruction, getTranslatedPrompt } from "./aiPromptUtils";

export interface ConversationData {
  character: string;
  topic: string;
  messages: Message[];
  characterSnippet?: string;
}

export interface AIScoreEvaluation {
  textualFeedback: string;
  conversationScore?: number;
  conversationRationale?: string;
  reflectionScore?: number;
  reflectionRationale?: string;
}

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
  
  // Clean the textual feedback by removing score and rationale sections
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


  // If rationales were inadvertently included in textualFeedback due to overlapping regex from above, remove known prefixes.
  if (evaluation.textualFeedback.startsWith("PUNTEGGIO_RIFLESSIONE:")) {
      evaluation.textualFeedback = ""; // Or handle more gracefully
  }
   if (evaluation.textualFeedback.startsWith("MOTIVAZIONE_RIFLESSIONE:")) {
      evaluation.textualFeedback = evaluation.textualFeedback.substring("MOTIVAZIONE_RIFLESSIONE:".length).trim();
  }


  // Final check to ensure no score/rationale text remains if it was the only content
  if (evaluation.textualFeedback.match(/^(PUNTEGGIO_|MOTIVAZIONE_)(CONVERSAZIONE|RIFLESSIONE):/i)) {
    evaluation.textualFeedback = ""; // Or a default message like "No additional feedback provided."
  }

  // If textual feedback is just a number (e.g., a stray score), blank it to trigger fallback display
  if (/^\d+$/.test(evaluation.textualFeedback)) {
    evaluation.textualFeedback = ""; 
  }

  return evaluation;
};

const buildSystemInstruction = (conversationData: ConversationData): string => {
  return getTranslatedSystemInstruction('evaluation', {
    character: conversationData.character,
    snippet: conversationData.characterSnippet || '',
    topic: conversationData.topic
  });
};

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

    console.log("System Instruction:", systemInstruction);
    console.log("Data Prompt:", dataPrompt);
    
    let accumulatedText = "";
    
    for await (const chunk of generateContentStream({
      contents: [{ role: "user", parts: [{ text: dataPrompt }] }],
      systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
      generationConfig: {
        // temperature: 0.5,
        // maxOutputTokens: 800,
      },
    })) {
      accumulatedText += chunk;
      yield { partial: accumulatedText };
    }
    
    // Parse the final result
    const evaluationOutput = parseAIScoreResponse(accumulatedText);
    
    // Ensure textualFeedback is always present and formatted
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
      .join("\n\n"); // Doppio newline per separazione chiara
    
    const systemInstruction = buildSystemInstruction(conversationData);
    
    const dataPrompt = getTranslatedPrompt('evaluation', {
      conversationText,
      userReflection
    });

    console.log("System Instruction:", systemInstruction);
    console.log("Data Prompt:", dataPrompt);
    
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: dataPrompt }] }],
      systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
      generationConfig: {
        // temperature: 0.5,
        // maxOutputTokens: 800,
      },
    });
    
    // ⚠️ Se .text() è asincrona, sostituire con: const rawResponse = await result.response.text();
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
    
    // Ensure textualFeedback is always present and formatted, using the parsed evaluationOutput
    if (!evaluationOutput.textualFeedback || typeof evaluationOutput.textualFeedback !== 'string' || evaluationOutput.textualFeedback.trim() === '') {
      const conversationScore = evaluationOutput.conversationScore || 'N/A';
      const reflectionScore = evaluationOutput.reflectionScore || 'N/A';
      const conversationRationale = evaluationOutput.conversationRationale || getTranslatedPrompt('noRationale', {});
      const reflectionRationale = evaluationOutput.reflectionRationale || getTranslatedPrompt('noRationale', {});
      
      // Ensure the fallback is Markdown
      const fallbackMarkdown = getTranslatedPrompt('evaluationFallback', {
        conversationScore: conversationScore.toString(),
        reflectionScore: reflectionScore.toString(),
        conversationRationale,
        reflectionRationale
      });
      
      // Append the original textual feedback from AI if it exists (even if it was just whitespace before trim), 
      // or a default message if it was truly empty.
      const aiProvidedTextualFeedback = evaluationOutput.textualFeedback.trim(); // Use the already trimmed version
      
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

    // ⚠️ Se .text() è asincrona, sostituire con: const evaluation = await result.response.text();
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

export const getAICombinedEvaluation = async (
  conversationData: ConversationData,
  userReflection: string
): Promise<string> => {
  console.warn(getTranslatedPrompt('obsoleteFunction', {}));

  return getTranslatedPrompt('obsoleteFunctionMessage', {});
};
