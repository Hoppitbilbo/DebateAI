// Copies the Vite build into server/webui/dist so `go build` embeds it.
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
const target = new URL("../server/webui/dist/", import.meta.url).pathname;
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(new URL("../dist/", import.meta.url).pathname, target, { recursive: true });
writeFileSync(target + ".keep", "");
console.log("frontend copied to server/webui/dist");
