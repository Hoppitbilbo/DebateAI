package ai

import "testing"

// The functions a voice character may call are locked in the token with
// the rest of the setup, so the browser cannot drop or change them.
func TestLiveConfigDeclaresTheFunctions(t *testing.T) {
	cfg := liveConfig(LiveTokenOptions{SystemInstruction: "sys", VoiceName: "Aoede",
		Functions: []LiveFunction{{Name: "character_identified", Description: "the student named you"}}})
	if len(cfg.Tools) != 1 || len(cfg.Tools[0].FunctionDeclarations) != 1 {
		t.Fatalf("tools: %+v", cfg.Tools)
	}
	if fd := cfg.Tools[0].FunctionDeclarations[0]; fd.Name != "character_identified" || fd.Description != "the student named you" {
		t.Fatalf("declaration: %+v", fd)
	}
	if cfg.SystemInstruction == nil || cfg.SpeechConfig == nil || cfg.InputAudioTranscription == nil {
		t.Fatalf("setup lost: %+v", cfg)
	}
	if cfg := liveConfig(LiveTokenOptions{}); cfg.Tools != nil {
		t.Fatalf("no functions, no tools: %+v", cfg.Tools)
	}
}
