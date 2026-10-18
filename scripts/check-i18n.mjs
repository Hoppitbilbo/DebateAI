// Checks that every translation key used in src/ exists in all five locales.
// Usage: node scripts/check-i18n.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const LOCALES = ["it", "en", "es", "fr", "de"];
const root = new URL("../src/", import.meta.url).pathname;

const loadLocale = (l) => {
  const dir = join(root, "i18n/locales", l);
  const out = {};
  for (const f of readdirSync(dir)) {
    if (f.endsWith(".json")) out[f.replace(".json", "")] = JSON.parse(readFileSync(join(dir, f), "utf8"));
  }
  out.apps = {};
  for (const f of readdirSync(join(dir, "apps"))) out.apps[f.replace(".json", "")] = JSON.parse(readFileSync(join(dir, "apps", f), "utf8"));
  return out;
};

const flatten = (obj, prefix = "", acc = new Set()) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, key, acc);
    else acc.add(key);
  }
  return acc;
};

const walk = (dir, files = []) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (!p.includes("/i18n") && !p.includes("/ui") && !p.includes("/debug")) walk(p, files); }
    else if (/\.(tsx?)$/.test(f)) files.push(p);
  }
  return files;
};

const keys = LOCALES.map((l) => [l, flatten(loadLocale(l))]);
const used = new Set();
for (const f of walk(root)) {
  // only files using the default namespace
  const src = readFileSync(f, "utf8");
  if (/useTranslation\(['"]\w+['"]\)/.test(src)) continue;
  for (const m of src.matchAll(/\bt\(\s*["']([a-zA-Z0-9_.]+)["']/g)) used.add(m[1]);
}
// dynamic keys used through template literals
const dyn = {
  "platform.activity.phase": ["setup", "chat", "reflection", "feedback"],
  "platform.roles": ["admin", "teacher", "student"],
  "platform.status": ["todo", "active", "goal_reached", "turn_limit", "completed", "abandoned"],
  "platform.appNames": ["convinci-tu", "doppia-intervista", "wiki-chatbot", "personaggio-misterioso", "impersona-tu", "you-moderate"],
  "platform.admin.tasks": ["chat", "evaluation", "utility", "judge", "live"],
  "platform.admin.taskHints": ["chat", "evaluation", "utility", "judge", "live"],
  "platform.admin.tabs": ["overview", "costs", "ai", "users", "invites", "classes", "settings"],
  "platform.admin.ai.strategies": ["ordered", "free_first", "cheapest"],
  "platform.admin.ai.presetNotes": ["gemini", "opencode", "jev", "openrouter", "local"],
  "platform.live.state": ["off", "connecting", "listening", "speaking"],
  "platform.invite.status": ["added", "invited", "error"],
};
for (const [p, list] of Object.entries(dyn)) list.forEach((k) => used.add(`${p}.${k}`));
for (const app of ["convinciTu", "doppiaIntervista", "wikiChatbot", "personaggioMisterioso", "impersonaTu", "youModerate"]) used.add(`apps.${app}.title`);

let missing = 0;
for (const [l, set] of keys) {
  const miss = [...used].filter((k) => !set.has(k) && !set.has(`${k}_one`) && !set.has(`${k}_other`));
  if (miss.length) {
    missing += miss.length;
    console.log(`\n[${l}] missing ${miss.length}:\n  ${miss.join("\n  ")}`);
  }
}
// platform namespace must have identical keys everywhere
const ref = [...keys.find(([l]) => l === "en")[1]].filter((k) => k.startsWith("platform."));
for (const [l, set] of keys) {
  const miss = ref.filter((k) => !set.has(k));
  if (miss.length) {
    missing += miss.length;
    console.log(`\n[${l}] platform keys missing vs en:\n  ${miss.join("\n  ")}`);
  }
}
console.log(missing ? `\n${missing} problems` : `OK: ${used.size} keys present in ${LOCALES.length} locales`);
process.exit(missing ? 1 : 0);
