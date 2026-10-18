// Package webui embeds the built React frontend (copied here by `npm run build`)
// so the server ships as a single binary.
package webui

import (
	"embed"
	"io/fs"
)

//go:embed all:dist
var files embed.FS

// FS returns the frontend files, or nil when the frontend was not built.
func FS() fs.FS {
	sub, err := fs.Sub(files, "dist")
	if err != nil {
		return nil
	}
	if _, err := fs.Stat(sub, "index.html"); err != nil {
		return nil
	}
	return sub
}
