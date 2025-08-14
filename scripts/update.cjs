/**
 * Update daily learning log.
 * Picks next item from each JSON list (rotating) and appends to data/log.md.
 * No external deps.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const LOG = path.join(DATA, 'log.md');
const STATE = path.join(DATA, 'state.json');

function loadJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
function saveJSON(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2)); }

function todayISO() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth()+1).padStart(2,'0');
  const day = String(d.getUTCDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

// init state
let state = { wordIndex: 0, tipIndex: 0, promptIndex: 0, lastRun: null };
if (fs.existsSync(STATE)) {
  try { state = Object.assign(state, loadJSON(STATE)); } catch {}
}

const words = loadJSON(path.join(DATA, 'words_en.json'));
const tips = loadJSON(path.join(DATA, 'ai_tips.json'));
const prompts = loadJSON(path.join(DATA, 'coding_prompts.json'));

// rotate indices
const w = words[state.wordIndex % words.length];
const t = tips[state.tipIndex % tips.length];
const p = prompts[state.promptIndex % prompts.length];

state.wordIndex = (state.wordIndex + 1) % words.length;
state.tipIndex = (state.tipIndex + 1) % tips.length;
state.promptIndex = (state.promptIndex + 1) % prompts.length;
state.lastRun = new Date().toISOString();

// append to log
const section = `## ${todayISO()}

**English word:** *${w.word}* — ${w.meaning}  
_Eg:_ ${w.example}

**AI tip:** ${t}

**Coding prompt:** ${p}

---
`;

fs.appendFileSync(LOG, section, 'utf-8');
saveJSON(STATE, state);

// also update README tail with last update
const readmePath = path.join(ROOT, 'README.md');
let readme = fs.readFileSync(readmePath, 'utf-8');
const marker = "\n---\n\n### Licencia";
const stamp = `\n\n> Última actualización automática: ${todayISO()}\n`;
if (!readme.includes("Última actualización automática:")) {
  readme = readme.replace(marker, stamp + marker);
} else {
  readme = readme.replace(/> Última actualización automática: .*\n/, `> Última actualización automática: ${todayISO()}\n`);
}
fs.writeFileSync(readmePath, readme, 'utf-8');

console.log("Daily log updated for", todayISO());
