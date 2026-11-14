// k6 load test for DebateAI. Pick the scenario with SCENARIO:
//   login  logins per second rising step by step (bcrypt), with light
//          browsing traffic alongside to see whether the rest slows down
//   chat   logged-in students doing activities (streamed AI answers from
//          the mock provider, transcript saved after every turn)
//   room   guests joining "aula lampo" rooms with a code, then chatting
// See README.md for the parameters.
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Counter } from "k6/metrics";
import exec from "k6/execution";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";

const BASE = __ENV.BASE_URL || "http://localhost:18080";
const SCENARIO = __ENV.SCENARIO || "login";
const STUDENTS = Number(__ENV.STUDENTS || 600);
const CLASS_SIZE = 30; // students behind one school IP
const PASSWORD = "student-pass-123";
const ADMIN = { identifier: "admin@load.test", password: "load-test-admin" };
const TURNS = Number(__ENV.TURNS || 5);
const THINK_MIN = Number(__ENV.THINK_MIN || 8); // seconds a student takes to write
const THINK_MAX = Number(__ENV.THINK_MAX || 15);
// The mock answers in MOCK_FIRST_TOKEN_MS + MOCK_TOKENS * MOCK_TOKEN_MS.
const MOCK_MS = Number(__ENV.MOCK_FIRST_TOKEN_MS || 800) + Number(__ENV.MOCK_TOKENS || 60) * Number(__ENV.MOCK_TOKEN_MS || 30);

const loginMs = new Trend("login_ms", true);
const joinMs = new Trend("room_join_ms", true);
const browseMs = new Trend("browse_ms", true);
const aiTurnMs = new Trend("ai_turn_ms", true);
const aiOverheadMs = new Trend("ai_overhead_ms", true); // turn time minus the mock's own delay
const saveMs = new Trend("save_transcript_ms", true);
const sessionMs = new Trend("create_session_ms", true);
const failures = new Counter("failures");

const steps = (list, seconds) => list.split(",").map((n) => ({ target: Number(n), duration: `${seconds}s` }));

const scenarios = {
  login: {
    logins: {
      executor: "ramping-arrival-rate",
      exec: "loginStorm",
      startRate: 1,
      timeUnit: "1s",
      preAllocatedVUs: 200,
      maxVUs: 2000,
      stages: steps(__ENV.LOGIN_RATES || "5,5,10,10,20,20,30,30,40,40", __ENV.STEP_SECONDS || 15),
    },
    browsing: {
      executor: "constant-arrival-rate",
      exec: "browse",
      rate: 5,
      timeUnit: "1s",
      duration: `${(__ENV.LOGIN_RATES || "5,5,10,10,20,20,30,30,40,40").split(",").length * Number(__ENV.STEP_SECONDS || 15)}s`,
      preAllocatedVUs: 20,
      maxVUs: 200,
    },
  },
  chat: {
    students: {
      executor: "ramping-vus",
      exec: "studentChat",
      startVUs: 0,
      stages: steps(__ENV.CHAT_VUS || "50,50,150,150,300,300", __ENV.STEP_SECONDS || 60),
      gracefulRampDown: "30s",
    },
  },
  room: {
    guests: {
      executor: "ramping-vus",
      exec: "guestChat",
      startVUs: 0,
      stages: steps(__ENV.ROOM_VUS || "60,60,180,180,300,300", __ENV.STEP_SECONDS || 60),
      gracefulRampDown: "30s",
    },
  },
}[SCENARIO];

export const options = {
  scenarios,
  setupTimeout: "15m",
  noCookiesReset: true, // a student stays logged in across activities, like in the browser
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
  thresholds: {
    // Reference values, not pass/fail gates: they mark in the summary where it degrades.
    login_ms: ["p(95)<1000"],
    browse_ms: ["p(95)<300"],
    ai_overhead_ms: ["p(95)<500"],
    save_transcript_ms: ["p(95)<500"],
    failures: ["count<1"],
  },
};

// One IP per class of 30, as a school network behind NAT (the server trusts
// X-Forwarded-For from private networks).
const fromClass = (n, params = {}) => {
  const c = Math.floor(n / CLASS_SIZE);
  params.headers = Object.assign({}, params.headers, { "X-Forwarded-For": `10.${Math.floor(c / 250)}.${c % 250}.1` });
  return params;
};
const post = (path, body, n, tags) => http.post(BASE + path, JSON.stringify(body), fromClass(n, { headers: { "Content-Type": "application/json" }, tags }));
const put = (path, body, n, tags) => http.put(BASE + path, JSON.stringify(body), fromClass(n, { headers: { "Content-Type": "application/json" }, tags }));

function fail(what, res) {
  failures.add(1, { what, status: String(res.status) });
  if (__ENV.VERBOSE) console.warn(`vu ${exec.vu.idInTest} iter ${exec.vu.iterationInScenario} t=${Math.round(exec.instance.currentTestRunDuration / 1000)}s ${what}: ${res.status} ${String(res.body).slice(0, 120)} cookies=${JSON.stringify(http.cookieJar().cookiesForURL(BASE))}`);
}

// ---------- setup: admin, mock provider, rooms, students ----------

export function setup() {
  const r = http.post(`${BASE}/api/auth/login`, JSON.stringify(ADMIN), { headers: { "Content-Type": "application/json" } });
  if (r.status !== 200) throw new Error(`admin login ${r.status}: ${r.body}`);

  const providers = http.get(`${BASE}/api/admin/providers`).json();
  if (!providers.some((p) => p.name === "Mock")) {
    const p = http.post(`${BASE}/api/admin/providers`, JSON.stringify({ name: "Mock", kind: "openai", baseURL: "http://mockai:8090", apiKey: "mock" }),
      { headers: { "Content-Type": "application/json" } });
    if (p.status !== 201) throw new Error(`provider ${p.status}: ${p.body}`);
  }
  const rooms = { enabled: true, allowAnonymousTeachers: true, maxMinutes: 120, maxGuests: CLASS_SIZE + 10,
    requestsPerGuestPerHour: 120, maxRequestsPerRoom: 3000, maxOpenAnonymousRooms: 50, tasks: {}, freeOnly: false };
  http.put(`${BASE}/api/admin/settings/rooms`, JSON.stringify(rooms), { headers: { "Content-Type": "application/json" } });

  let created = 0;
  if (SCENARIO !== "room") {
    // Already there from an earlier run: the server answers 409 and they are kept.
    for (let i = 0; i < STUDENTS; i += 10) {
      const batch = [];
      for (let j = i; j < Math.min(i + 10, STUDENTS); j++) {
        batch.push(["POST", `${BASE}/api/admin/users`, JSON.stringify({ email: `s${j}@load.test`, name: `Studente ${j}`, password: PASSWORD, role: "student" }),
          { headers: { "Content-Type": "application/json" } }]);
      }
      created += http.batch(batch).filter((res) => res.status === 201).length;
    }
  }
  const codes = [];
  if (SCENARIO === "room") {
    const maxVUs = Math.max(...(__ENV.ROOM_VUS || "60,60,180,180,300,300").split(",").map(Number));
    for (let i = 0; i < Math.ceil(maxVUs / CLASS_SIZE); i++) {
      const o = http.post(`${BASE}/api/rooms`, JSON.stringify({ title: `Aula ${i}`, appType: "convinci-tu" }), { headers: { "Content-Type": "application/json" } });
      if (o.status !== 201) throw new Error(`room ${o.status}: ${o.body}`);
      codes.push(o.json().room.code);
    }
  }
  console.log(`setup: ${created} new students, ${codes.length} rooms`);
  return { codes };
}

// ---------- scenario bodies ----------

function login(n) {
  const res = post("/api/auth/login", { identifier: `s${n % STUDENTS}@load.test`, password: PASSWORD }, n, { name: "login" });
  loginMs.add(res.timings.duration);
  if (!check(res, { "login 200": (r) => r.status === 200 })) fail("login", res);
  return res.status === 200;
}

export function loginStorm() {
  // Each login is a different student, cycling through them.
  http.cookieJar().clear(BASE);
  login(exec.scenario.iterationInTest);
}

export function browse() {
  const res = http.get(`${BASE}/api/public/config`, { tags: { name: "public config" } });
  browseMs.add(res.timings.duration);
  if (res.status !== 200) fail("browse", res);
}

// One streamed answer; returns the text the character said.
function aiTurn(n, sessionId, recipe, messages) {
  const res = post("/api/ai/generate", { task: "chat", stream: true, sessionId, recipe, messages }, n, { name: "generate" });
  aiTurnMs.add(res.timings.duration);
  aiOverheadMs.add(Math.max(0, res.timings.duration - MOCK_MS));
  const body = String(res.body || "");
  if (res.status !== 200 || !body.includes('"done":true')) {
    fail("generate", res);
    return null;
  }
  return body.split("\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6)).delta || "").join("");
}

const RECIPE = { app: "convinci-tu", character: "Galileo Galilei", bio: "Astronomo e fisico italiano.", topic: "La Terra gira intorno al Sole", difficulty: "medium", uiLang: "it" };

function activity(n) {
  const s = post("/api/sessions", { appType: "convinci-tu", title: "Load test", context: { character: "Galileo Galilei" } }, n, { name: "create session" });
  sessionMs.add(s.timings.duration);
  if (s.status !== 201) {
    fail("create session", s);
    if (s.status === 401) loggedIn = false; // the cookie was refused: log in again
    return sleep(5); // never spin on a failing request
  }
  const id = s.json().id;

  const messages = [];
  const opening = aiTurn(n, id, Object.assign({ kind: "opening" }, RECIPE), []);
  if (opening === null) return sleep(5);
  messages.push({ role: "assistant", content: opening });

  for (let t = 0; t < TURNS; t++) {
    sleep(THINK_MIN + Math.random() * (THINK_MAX - THINK_MIN));
    messages.push({ role: "user", content: `Argomento numero ${t}: le fasi di Venere mostrano che gira intorno al Sole.` });
    const reply = aiTurn(n, id, Object.assign({ kind: "reply" }, RECIPE), messages);
    if (reply === null) return sleep(5);
    messages.push({ role: "assistant", content: reply });
    const sv = put(`/api/sessions/${id}/transcript`, { messages }, n, { name: "save transcript" });
    saveMs.add(sv.timings.duration);
    if (sv.status !== 200) fail("save transcript", sv);
  }
}

// Per VU: whether it holds a session cookie (a guest joins only once).
let loggedIn = false;

export function studentChat() {
  const n = exec.vu.idInTest - 1;
  if (!loggedIn && !(loggedIn = login(n))) return sleep(5);
  activity(n);
}

export function guestChat(data) {
  const n = exec.vu.idInTest - 1;
  if (!loggedIn) {
    const code = data.codes[Math.floor(n / CLASS_SIZE) % data.codes.length];
    const res = post("/api/guest/join", { code, nickname: `ospite${n}`, avatar: "fox", locale: "it" }, n, { name: "room join" });
    joinMs.add(res.timings.duration);
    if (res.status !== 200) {
      fail("room join", res);
      return sleep(60);
    }
    loggedIn = true;
  }
  activity(n);
}

export function handleSummary(data) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return {
    stdout: textSummary(data, { indent: " ", enableColors: false }),
    [`/scripts/results/${SCENARIO}-${stamp}.json`]: JSON.stringify(data, null, 1),
  };
}
