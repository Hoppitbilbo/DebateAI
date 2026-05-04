import { aiFacade } from "./aiFacade";

const VOICES = [
  "Zephyr (Bright, Higher pitch, Female)",
  "Puck (Upbeat, Middle pitch, Male)",
  "Charon (Informative, Lower pitch, Deep Male)",
  "Kore (Firm, Middle pitch, Female)",
  "Fenrir (Excitable, Lower middle pitch, Male)",
  "Leda (Youthful, Higher pitch, Female)",
  "Orus (Firm, Lower middle pitch, Male)",
  "Aoede (Breezy, Middle pitch, Female)",
  "Callirrhoe (Easy-going, Middle pitch, Female)",
  "Autonoe (Bright, Middle pitch, Female)",
  "Enceladus (Breathy, Lower pitch, Male)",
  "Iapetus (Clear, Lower middle pitch, Male)",
  "Umbriel (Easy-going, Lower middle pitch, Female)",
  "Algieba (Smooth, Lower pitch, Male)",
  "Despina (Smooth, Middle pitch, Female)",
  "Erinome (Clear, Middle pitch, Female)",
  "Algenib (Gravelly, Lower pitch, Male)",
  "Rasalgethi (Informative, Middle pitch, Male)",
  "Laomedeia (Upbeat, Higher pitch, Female)",
  "Achernar (Soft, Higher pitch, Female)",
  "Alnilam (Firm, Lower middle pitch, Male)",
  "Schedar (Even, Lower middle pitch, Female)",
  "Gacrux (Mature, Middle pitch, Male)",
  "Pulcherrima (Forward, Middle pitch, Female)",
  "Achird (Friendly, Lower middle pitch, Female)",
  "Zubenelgenubi (Casual, Lower middle pitch, Male)",
  "Vindemiatrix (Gentle, Middle pitch, Female)",
  "Sadachbia (Lively, Lower pitch, Male)",
  "Sadaltager (Knowledgeable, Middle pitch, Male)",
  "Sulafat (Warm, Middle pitch, Female)"
];

export const getBestVoiceForCharacter = async (characterName: string, characterDescription: string = ""): Promise<string> => {
  if (!characterName) return "Aoede";

  const cacheKey = `voice_cache_${characterName}`;
  const cachedVoice = localStorage.getItem(cacheKey);
  if (cachedVoice) {
    return cachedVoice;
  }

  const systemInstruction = `You are a voice casting director. Based on the character's name and description, select the single most appropriate voice from the provided list. 
Consider their likely gender, personality, age, and authority.

Character Name: ${characterName}
Character Description/Bio: ${characterDescription}

Available Voices:
${VOICES.join("\n")}

Respond ONLY with the name of the voice (e.g. Zephyr, Puck, Charon). Do not include any other text or reasoning.`;

  try {
    const chat = aiFacade.text.startChat({ systemInstructionText: systemInstruction });
    const response = await aiFacade.text.sendMessage(chat, `Select the best voice for ${characterName}.`);
    
    // Clean up response to ensure it's just the name
    const rawVoiceName = response?.trim() || "Aoede";
    // Many times the AI outputs "Zephyr (Bright, Higher pitch, Female)" instead of just "Zephyr"
    const voiceName = rawVoiceName.split(" ")[0].trim();
    
    // Verify it's a valid voice from the list to avoid API errors
    const isValid = VOICES.some(v => v.startsWith(voiceName));
    const finalVoice = isValid ? voiceName : "Aoede";

    localStorage.setItem(cacheKey, finalVoice);
    return finalVoice;
  } catch (error) {
    console.error("Error determining character voice:", error);
    return "Aoede"; // Fallback
  }
};
