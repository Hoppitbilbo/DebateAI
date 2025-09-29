import { GoogleGenerativeAI, GenerativeModel, ChatSession, GenerateContentRequest, GenerateContentResult, Part } from "@google/generative-ai";

const API_KEY_STORAGE_KEY = 'gemini_api_key';

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

/**
 * Gets the API key from session storage or environment variables (fallback)
 */
const getApiKey = (): string | null => {
  // First try session storage
  const sessionApiKey = sessionStorage.getItem(API_KEY_STORAGE_KEY);
  if (sessionApiKey && sessionApiKey.trim()) {
    return sessionApiKey.trim();
  }
  
  // Fallback to environment variable
  const envApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (envApiKey && envApiKey !== 'your_api_key_here') {
    return envApiKey;
  }
  
  return null;
};

/**
 * Initializes the AI service with the current API key
 */
const initializeAiService = (): boolean => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.warn("No Gemini API key found. AI Service will be disabled.");
    console.info("Please add your API key using the API key button in the navbar.");
    genAI = null;
    model = null;
    return false;
  }

  try {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
    console.log("Google AI service initialized successfully");
    return true;
  } catch (error) {
    console.error("Error initializing GoogleGenerativeAI:", error);
    console.warn("AI Service initialization failed. Please check your API key.");
    genAI = null;
    model = null;
    return false;
  }
};

// Initialize on module load
initializeAiService();

/**
 * Checks if the AI service is available and configured.
 */
export const isAiServiceAvailable = (): boolean => {
  // Try to reinitialize if model is not available
  if (!model) {
    initializeAiService();
  }
  return !!model;
};

/**
 * Reinitializes the AI service (useful when API key changes)
 */
export const reinitializeAiService = (): boolean => {
  return initializeAiService();
};

/**
 * Starts a new chat session with the generative model.
 * @param history - Optional chat history to initialize the session.
 * @returns A new ChatSession instance.
 */
export const startChat = (
  history: { role: "user" | "model"; parts: Part[] }[] = [],
  systemInstructionText?: string
): ChatSession => {
  if (!isAiServiceAvailable()) {
    throw new Error("AI Service is not configured. Cannot start chat. Please add your API key using the API key button in the navbar.");
  }

  if (!model) {
    throw new Error("AI model is not initialized. This should not happen if isAiServiceAvailable() returns true.");
  }

  const chatOptions: { history: { role: "user" | "model"; parts: Part[] }[], systemInstruction?: { role: string, parts: Part[] } } = { history };

  if (systemInstructionText) {
    chatOptions.systemInstruction = {
      role: 'system',
      parts: [{ text: systemInstructionText }],
    };
  }

  return model.startChat(chatOptions);
};

/**
 * Sends a message in an ongoing chat session.
 * @param chat - The ChatSession instance.
 * @param message - The message to send.
 * @returns The model's response text.
 */
export const sendMessage = async (chat: ChatSession, message: string): Promise<string> => {
  if (!isAiServiceAvailable()) {
    console.warn("AI Service not available. Returning mock response.");
    return "Mock response: AI service is not available.";
  }
  const result = await chat.sendMessage(message);
  const response = await result.response;
  return response.text();
};

/**
 * Generates content from the model based on a request.
 * @param request - The content generation request.
 * @returns The generated content result.
 */
export const generateContent = async (request: GenerateContentRequest): Promise<GenerateContentResult> => {
  if (!isAiServiceAvailable()) {
    throw new Error("AI Service is not configured. Cannot generate content.");
  }
  return model.generateContent(request);
};

/**
 * A versatile function to get a response for a given prompt, with optional system instructions.
 * @param prompt - The user prompt text.
 * @param systemInstructionText - Optional system instruction text.
 * @returns The model's response text.
 */
export const getResponse = async (prompt: string, systemInstructionText?: string): Promise<string> => {
  if (!isAiServiceAvailable()) {
    console.warn("AI Service not available. Returning mock response.");
    return "Mock response: AI service is not available.";
  }

  try {
    const systemInstruction: { role: "system"; parts: Part[] } | undefined = systemInstructionText
      ? { role: "system", parts: [{ text: systemInstructionText }] }
      : undefined;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction,
    });

    const response = result.response;
    return response.text();
  } catch (error) {
    console.error("Error getting response from AI service:", error);
    throw error;
  }
};

/**
 * Generates streaming content from the model based on a request.
 * @param request - The content generation request.
 * @returns An async generator that yields text chunks.
 */
export const generateContentStream = async function* (request: GenerateContentRequest): AsyncGenerator<string, void, unknown> {
  if (!isAiServiceAvailable()) {
    throw new Error("AI Service is not configured. Cannot generate streaming content.");
  }
  
  try {
    const result = await model.generateContentStream(request);
    
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  } catch (error) {
    console.error("Error generating streaming content:", error);
    throw error;
  }
};

/**
 * Generates 5 suggested questions for inquiry dialogue based on didactic dialogue principles.
 * @param character1Name - Name of the first character
 * @param character2Name - Name of the second character  
 * @param language - Language for the questions (optional, defaults to Italian)
 * @returns Array of 5 suggested questions following didactic dialogue principles in the specified language
 */
export const generateInquiryDialogueQuestions = async (
  character1Name: string, 
  character2Name: string,
  language: string = 'it'
): Promise<string[]> => {
  // Define language-specific prompts
  const promptsByLanguage = {
    'it': {
      system: `Sei un esperto di pedagogia e didattica dialogica, specializzato nel metodo del "Ragionare insieme".
      Il tuo compito è generare ESATTAMENTE 5 domande autentiche per un dialogo di inchiesta tra due personaggi storici o filosofici.
      
      Segui la "Guida Pratica in 5 Passaggi per Creare Domande Autentiche":
      
      1. **Trova il Terreno Comune o il Legame Nascosto**: Cosa lega davvero questi due concetti, al di là dell'ovvio? Non sono solo opposti o simili; spesso uno esiste a causa dell'altro, o condividono uno scopo, o rappresentano due diverse soluzioni allo stesso problema.
      
      2. **Identifica la Tensione o il Paradosso**: Cerca il punto di conflitto. Dove la loro relazione diventa problematica? C'è un paradosso nel loro rapporto? (Es. Per avere più sicurezza, devo rinunciare a un po' di libertà).
      
      3. **Trasforma la Tensione in Domanda Aperta**: Evita domande che possano avere come risposta "sì", "no" o un semplice fatto. Usa formule come:
         - "In che misura...?"
         - "È possibile che... o piuttosto...?"
         - "Quale dei due definisce la natura dell'altro, e perché?"
         - "Se l'obiettivo è X, quale dei due è lo strumento più efficace, ma a quale costo?"
      
      4. **Sfida le Definizioni Comuni**: Una domanda potente costringe i partecipanti a mettere in discussione ciò che pensavano di sapere. "Cos'è veramente la pace? Solo assenza di guerra?".
      
      5. **Pensa al "Perché è Importante?"**: La domanda deve avere una posta in gioco. Deve collegarsi a temi più ampi come il potere, la morale, il progresso, la natura umana.

      Le domande devono:
      - Creare tensione intellettuale tra ${character1Name} e ${character2Name}
      - Essere aperte, senza risposte predefinite
      - Sfida le definizioni comuni e i presupposti
      - Collegarsi a temi universali (potere, morale, progresso, natura umana)
      - Promuovere il ragionamento critico e l'argomentazione

      I personaggi coinvolti sono: ${character1Name} e ${character2Name}.
      
      GENERA ESATTAMENTE 5 DOMANDE IN ITALIANO, una per riga, senza numerazione o spiegazioni aggiuntive.
      Ogni domanda deve essere autentica, creare tensione intellettuale e promuovere dialogo critico.`,
      user: `Crea ESATTAMENTE 5 domande autentiche in italiano per un dialogo tra ${character1Name} e ${character2Name} che seguano la "Guida Pratica in 5 Passaggi" e creino tensione intellettuale tra i personaggi.`
    },
    'es': {
      system: `Eres un experto en pedagogía y didáctica dialógica, especializado en el método "Razonar Juntos".
      Tu tarea es generar EXACTAMENTE 5 preguntas auténticas para un diálogo de investigación entre dos personajes históricos o filosóficos.
      
      Sigue la "Guía Práctica en 5 Pasos para Crear Preguntas Auténticas":
      
      1. **Encuentra el Terreno Común o el Vínculo Oculto**: ¿Qué conecta realmente estos dos conceptos, más allá de lo obvio? No son solo opuestos o similares; a menudo uno existe debido al otro, o comparten un propósito, o representan dos soluciones diferentes al mismo problema.
      
      2. **Identifica la Tensión o la Paradoja**: Busca el punto de conflicto. ¿Dónde se vuelve problemática su relación? ¿Hay una paradoja en su relación? (Ej. Para tener más seguridad, debo renunciar a un poco de libertad).
      
      3. **Transforma la Tensión en Pregunta Abierta**: Evita preguntas que puedan tener como respuesta "sí", "no" o un simple hecho. Usa fórmulas como:
         - "¿En qué medida...?"
         - "¿Es posible que... o más bien...?"
         - "¿Cuál de los dos define la naturaleza del otro, y por qué?"
         - "Si el objetivo es X, ¿cuál de los dos es el instrumento más eficaz, pero a qué costo?"
      
      4. **Desafía las Definiciones Comunes**: Una pregunta potente obliga a los participantes a cuestionar lo que creían saber. "¿Qué es realmente la paz? ¿Solo ausencia de guerra?".
      
      5. **Piensa en el "Por qué es Importante"**: La pregunta debe tener algo en juego. Debe conectarse a temas más amplios como el poder, la moral, el progreso, la naturaleza humana.

      Los personajes involucrados son: ${character1Name} y ${character2Name}.
      
      GENERA EXACTAMENTE 5 PREGUNTAS EN ESPAÑOL, una por línea, sin numeración ni explicaciones adicionales.
      Cada pregunta debe ser auténtica, crear tensión intelectual y promover diálogo crítico.`,
      user: `Crea EXACTAMENTE 5 preguntas auténticas en español para un diálogo entre ${character1Name} y ${character2Name} que sigan la "Guía Práctica en 5 Pasos" y creen tensión intelectual entre los personajes.`
    },
    'en': {
      system: `You are an expert in pedagogy and dialogic teaching, specialized in the "Reasoning Together" method.
      Your task is to generate EXACTLY 5 authentic questions for an inquiry dialogue between two historical or philosophical characters.
      
      Follow the "Practical Guide in 5 Steps to Create Authentic Questions":
      
      1. **Find the Common Ground or Hidden Link**: What truly connects these two concepts, beyond the obvious? They are not just opposites or similar; often one exists because of the other, or they share a purpose, or represent two different solutions to the same problem.
      
      2. **Identify the Tension or Paradox**: Look for the point of conflict. Where does their relationship become problematic? Is there a paradox in their relationship? (Ex. To have more security, I must give up some freedom).
      
      3. **Transform Tension into Open Question**: Avoid questions that can be answered with "yes", "no" or a simple fact. Use formulas like:
         - "To what extent...?"
         - "Is it possible that... or rather...?"
         - "Which of the two defines the nature of the other, and why?"
         - "If the goal is X, which of the two is the most effective tool, but at what cost?"
      
      4. **Challenge Common Definitions**: A powerful question forces participants to question what they thought they knew. "What is peace really? Just absence of war?".
      
      5. **Think about "Why is it Important?"**: The question must have something at stake. It must connect to broader themes like power, morality, progress, human nature.

      The characters involved are: ${character1Name} and ${character2Name}.
      
      GENERATE EXACTLY 5 QUESTIONS IN ENGLISH, one per line, without numbering or additional explanations.
      Each question must be authentic, create intellectual tension, and promote critical dialogue.`,
      user: `Create EXACTLY 5 authentic questions in English for a dialogue between ${character1Name} and ${character2Name} that follow the "Practical Guide in 5 Steps" and create intellectual tension between the characters.`
    },
    'fr': {
      system: `Vous êtes un expert en pédagogie et didactique dialogique, spécialisé dans la méthode "Raisonner Ensemble".
      Votre tâche est de générer EXACTEMENT 5 questions authentiques pour un dialogue d'enquête entre deux personnages historiques ou philosophiques.
      
      Suivez le "Guide Pratique en 5 Étapes pour Créer des Questions Authentiques":
      
      1. **Trouvez le Terrain Commun ou le Lien Caché**: Que connecte vraiment ces deux concepts, au-delà de l'évidence? Ils ne sont pas seulement opposés ou similaires; souvent l'un existe à cause de l'autre, ou ils partagent un but, ou représentent deux solutions différentes au même problème.
      
      2. **Identifiez la Tension ou le Paradoxe**: Cherchez le point de conflit. Où leur relation devient-elle problématique? Y a-t-il un paradoxe dans leur relation? (Ex. Pour avoir plus de sécurité, je dois renoncer à un peu de liberté).
      
      3. **Transformez la Tension en Question Ouverte**: Évitez les questions qui peuvent être répondues par "oui", "non" ou un simple fait. Utilisez des formules comme:
         - "Dans quelle mesure...?"
         - "Est-il possible que... ou plutôt...?"
         - "Lequel des deux définit la nature de l'autre, et pourquoi?"
         - "Si l'objectif est X, lequel des deux est l'outil le plus efficace, mais à quel prix?"
      
      4. **Défiez les Définitions Communes**: Une question puissante force les participants à remettre en question ce qu'ils pensaient savoir. "Qu'est-ce que la paix vraiment? Seulement l'absence de guerre?".
      
      5. **Pensez au "Pourquoi est-ce Important?"**: La question doit avoir quelque chose en jeu. Elle doit se connecter à des thèmes plus larges comme le pouvoir, la morale, le progrès, la nature humaine.

      Les personnages impliqués sont: ${character1Name} et ${character2Name}.
      
      GÉNÉREZ EXACTEMENT 5 QUESTIONS EN FRANÇAIS, une par ligne, sans numérotation ni explications supplémentaires.
      Chaque question doit être authentique, créer une tension intellectuelle et promouvoir le dialogue critique.`,
      user: `Créez EXACTEMENT 5 questions authentiques en français pour un dialogue entre ${character1Name} et ${character2Name} qui suivent le "Guide Pratique en 5 Étapes" et créent une tension intellectuelle entre les personnages.`
    },
    'de': {
      system: `Sie sind ein Experte für Pädagogik und Dialogische Didaktik, spezialisiert auf die Methode "Zusammen Denken".
      Ihre Aufgabe ist es, EXAKT 5 authentische Fragen für einen Untersuchungsdialog zwischen zwei historischen oder philosophischen Charakteren zu generieren.
      
      Folgen Sie dem "Praktischen Leitfaden in 5 Schritten zur Erstellung Authentischer Fragen":
      
      1. **Finden Sie die Gemeinsame Grundlage oder die Versteckte Verbindung**: Was verbindet diese beiden Konzepte wirklich, über das Offensichtliche hinaus? Sie sind nicht nur Gegensätze oder ähnlich; oft existiert eines wegen des anderen, oder sie teilen einen Zweck, oder repräsentieren zwei verschiedene Lösungen für dasselbe Problem.
      
      2. **Identifizieren Sie die Spannung oder das Paradox**: Suchen Sie den Konfliktpunkt. Wo wird ihre Beziehung problematisch? Gibt es ein Paradoxon in ihrer Beziehung? (Z.B. Um mehr Sicherheit zu haben, muss ich auf etwas Freiheit verzichten).
      
      3. **Verwandeln Sie Spannung in Offene Fragen**: Vermeiden Sie Fragen, die mit "Ja", "Nein" oder einer einfachen Tatsache beantwortet werden können. Verwenden Sie Formeln wie:
         - "Inwiefern...?"
         - "Ist es möglich, dass... oder eher...?"
         - "Welches der beiden definiert die Natur des anderen, und warum?"
         - "Wenn das Ziel X ist, welches der beiden ist das effektivste Werkzeug, aber zu welchem Preis?"
      
      4. **Herausforderung Gemeiner Definitionen**: Eine mächtige Frage zwingt die Teilnehmer dazu, das in Frage zu stellen, was sie zu wissen glaubten. "Was ist Frieden wirklich? Nur Abwesenheit von Krieg?".
      
      5. **Denken Sie an "Warum ist es Wichtig?"**: Die Frage muss etwas auf dem Spiel haben. Sie muss sich mit breiteren Themen wie Macht, Moral, Fortschritt, menschlicher Natur verbinden.

      Die beteiligten Charaktere sind: ${character1Name} und ${character2Name}.
      
      GENERIEREN SIE EXAKT 5 FRAGEN AUF DEUTSCH, eine pro Zeile, ohne Nummerierung oder zusätzliche Erklärungen.
      Jede Frage muss authentisch sein, intellektuelle Spannung erzeugen und kritischen Dialog fördern.`,
      user: `Erstellen Sie EXAKT 5 authentische Fragen auf Deutsch für einen Dialog zwischen ${character1Name} und ${character2Name}, die dem "Praktischen Leitfaden in 5 Schritten" folgen und intellektuelle Spannung zwischen den Charakteren erzeugen.`
    }
  };

  // Get the appropriate prompt for the selected language, default to Italian
  const selectedPrompts = promptsByLanguage[language as keyof typeof promptsByLanguage] || promptsByLanguage['it'];
  
  const systemPrompt = selectedPrompts.system;
  const userPrompt = selectedPrompts.user;

  try {
    const response = await getResponse(userPrompt, systemPrompt);
    
    // Split the response by newlines and filter out empty lines
    const questions = response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.endsWith('?'))
      .slice(0, 5); // Ensure we only take 5 questions
    
    return questions;
  } catch (error) {
    console.error('Error generating inquiry dialogue questions:', error);
    return [];
  }
};

/**
 * A streaming version of getResponse that yields text chunks as they arrive.
 * @param prompt - The user prompt text.
 * @param systemInstructionText - Optional system instruction text.
 * @returns An async generator that yields text chunks.
 */
export const getResponseStream = async function* (prompt: string, systemInstructionText?: string): AsyncGenerator<string, void, unknown> {
  if (!isAiServiceAvailable()) {
    console.warn("AI Service not available. Returning mock response.");
    yield "Mock response: AI service is not available.";
    return;
  }

  try {
    const systemInstruction: { role: "system"; parts: Part[] } | undefined = systemInstructionText
      ? { role: "system", parts: [{ text: systemInstructionText }] }
      : undefined;

    const request: GenerateContentRequest = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction,
    };

    yield* generateContentStream(request);
  } catch (error) {
    console.error("Error getting streaming response from AI service:", error);
    throw error;
  }
};

export { model }; // Exporting model for direct use if needed