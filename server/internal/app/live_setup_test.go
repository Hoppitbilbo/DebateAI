package app

import (
	"strings"
	"testing"
)

// The mystery character tells the browser through a function call that the
// student named it: in a voice conversation the server never hears the
// name, and the transcription often mangles it.
func TestLiveSetupGivesTheMysteryCharacterItsFunction(t *testing.T) {
	system, fns := LiveSetup(PromptRecipe{App: "personaggio-misterioso"})
	if len(fns) != 1 || fns[0].Name != MysteryIdentifiedFunction || fns[0].Description == "" {
		t.Fatalf("functions: %+v", fns)
	}
	if !strings.Contains(system, MysteryIdentifiedFunction) {
		t.Fatalf("the instructions do not mention the function: %q", system)
	}
	for _, app := range []string{"wiki-chatbot", "convinci-tu", "impersona-tu"} {
		if system, fns := LiveSetup(PromptRecipe{App: app}); system != "" || fns != nil {
			t.Fatalf("%s: %q %+v", app, system, fns)
		}
	}
}
