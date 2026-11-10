package domain

import "testing"

func TestNormalizeUsername(t *testing.T) {
	for in, want := range map[string]string{" Mario.Rossi ": "mario.rossi", "abc": "abc", "a_b-c9": "a_b-c9", "3d": ""} {
		got, err := NormalizeUsername(in)
		if want == "" {
			if err == nil {
				t.Errorf("%q must be rejected", in)
			}
			continue
		}
		if err != nil || got != want {
			t.Errorf("%q: got %q, %v", in, got, err)
		}
	}
	for _, bad := range []string{"", "ab", "_abc", ".abc", "a b c", "mario@x.it", "àbc", "abcdefghijklmnopqrstuvwxyz12345"} {
		if _, err := NormalizeUsername(bad); err == nil {
			t.Errorf("%q must be rejected", bad)
		}
	}
}

func TestEnrollmentCodeIsLongAndUnambiguous(t *testing.T) {
	a, b := NewEnrollmentCode(), NewEnrollmentCode()
	if len(a) != 39 || a == b || NormalizeJoinCode(a) != a {
		t.Fatalf("codes: %q %q", a, b)
	}
}
