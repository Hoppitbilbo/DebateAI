package httpapi

import (
	"encoding/json"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
)

// Investigation 11/11, M7: a 500 answer never carries the internal error
// (a database message); the error is logged instead.
func TestInternalErrorsAreNotSentToTheBrowser(t *testing.T) {
	w := httptest.NewRecorder()
	writeInternal(w, errors.New("SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email"))
	var out apiError
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if w.Code != 500 || out.Error != "internal" || strings.Contains(out.Message, "SQLITE") {
		t.Fatalf("%d %+v", w.Code, out)
	}
}
