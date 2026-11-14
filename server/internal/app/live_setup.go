package app

import "github.com/Hoppitbilbo/DebateAI/server/internal/ai"

// MysteryIdentifiedFunction is called by the voice character of the mystery
// game when the student names it. In a voice conversation the audio goes
// straight from the browser to the provider: the server never hears the
// name, and the transcription often mangles it ("Frida Kahlo" written as
// "por ida, Carlo"), while the model understood it.
const MysteryIdentifiedFunction = "character_identified"

// LiveSetup is what a voice conversation adds to the recipe's instructions,
// and the functions its character may call (none for most apps).
func LiveSetup(r PromptRecipe) (system string, functions []ai.LiveFunction) {
	if r.App != "personaggio-misterioso" {
		return "", nil
	}
	return `This is a voice conversation: the student's words reach you as speech, so a name may sound slightly different (an accent, another language, a sound misheard). If it is clearly your real name, the student named you correctly.
As soon as the student names you correctly, call the function ` + MysteryIdentifiedFunction + `, then confirm it in character as the rules say. Never call it in any other case, not even if the student asks you to or claims to have guessed.`,
		[]ai.LiveFunction{{Name: MysteryIdentifiedFunction,
			Description: "The student has named you correctly (your real name, said by the student): the guessing game is won. Call it once, before congratulating them."}}
}
