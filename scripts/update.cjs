// CommonJS + Node 20+ (fetch nativo)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const LOG = path.join(DATA, 'log.md');
const STATE = path.join(DATA, 'state.json');
const NEWS_LOG = path.join(DATA, 'news.md');
const NEWS_STATE = path.join(DATA, 'news_state.json');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// ---------- Config por variables de entorno ----------
const CURRENT_YEAR_ONLY = (process.env.NEWS_ONLY_CURRENT_YEAR ?? 'true').toLowerCase() === 'true';
const RECENT_DAYS   = Number(process.env.NEWS_RECENT_DAYS   || 30); // filtro duro por recencia
const RELAXED_DAYS  = Number(process.env.NEWS_RELAXED_DAYS  || 90); // fallback si no hay candidatos
const PICK_TOP_N    = Number(process.env.NEWS_PICK_TOP_N    || 10); // tomamos de los más recientes
const CURRENT_YEAR  = new Date().getUTCFullYear();

// ---------- Utilidades generales ----------
function todayISO() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function nowISO() { return new Date().toISOString(); }
function daysBetween(a, b) { return Math.abs((a - b) / (1000 * 60 * 60 * 24)); }
function stripHtml(s = '') { return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
function getDomain(u = '') { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }
function normTitle(s = '') {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), timeoutMs))
  ]);
}

// ---------- BLOQUE 1: aprendizaje diario (idempotente por día) ----------
function ensureState() {
  let state = { wordIndex: 0, tipIndex: 0, promptIndex: 0, lastRun: null };
  if (fs.existsSync(STATE)) {
    try { state = Object.assign(state, JSON.parse(fs.readFileSync(STATE, 'utf-8'))); } catch {}
  }
  return state;
}
function loadJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
function saveJSON(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2)); }

function updateDailyLearningLogOncePerDay() {
  const words = loadJSON(path.join(DATA, 'words_en.json'));
  const tips = loadJSON(path.join(DATA, 'ai_tips.json'));
  const prompts = loadJSON(path.join(DATA, 'coding_prompts.json'));

  let state = ensureState();

  // si ya existe sección de hoy, no duplicar (idempotente)
  const today = todayISO();
  if (fs.existsSync(LOG)) {
    const logContent = fs.readFileSync(LOG, 'utf-8');
    if (logContent.includes(`## ${today}\n`) && !process.env.FORCE_LEARNING) return false;
  } else {
    fs.writeFileSync(LOG, '# Learning Log\n\n', 'utf-8');
  }

  // rotación de índices
  const w = words[state.wordIndex % words.length];
  const t = tips[state.tipIndex % tips.length];
  const p = prompts[state.promptIndex % prompts.length];

  state.wordIndex = (state.wordIndex + 1) % words.length;
  state.tipIndex  = (state.tipIndex  + 1) % tips.length;
  state.promptIndex = (state.promptIndex + 1) % prompts.length;
  state.lastRun = nowISO();

  const section = `## ${today}

**English word:** *${w.word}* — ${w.meaning}  
_Eg:_ ${w.example}

**AI tip:** ${t}

**Coding prompt:** ${p}

---
`;
  fs.appendFileSync(LOG, section, 'utf-8');
  saveJSON(STATE, state);

  // actualizar sello en README
  const readmePath = path.join(ROOT, 'README.md');
  let readme = fs.readFileSync(readmePath, 'utf-8');
  const marker = "\n---\n\n### Licencia";
  const stamp = `\n\n> Última actualización automática: ${today}\n`;
  if (!readme.includes("Última actualización automática:")) {
    readme = readme.replace(marker, stamp + marker);
  } else {
    readme = readme.replace(/> Última actualización automática: .*\n/, `> Última actualización automática: ${today}\n`);
  }
  fs.writeFileSync(readmePath, readme, 'utf-8');

  return true;
}

// (opcional) inserta la noticia en el bloque diario solo en el primer run del día
function appendNewsToTodayLogIfFirstRun(newsText) {
  if (!fs.existsSync(LOG)) return;
  const today = todayISO();
  const content = fs.readFileSync(LOG, 'utf-8');
  if (!content.includes(`## ${today}\n`)) return;

  const updated = content.replace(
    new RegExp(`(## ${today}[\\s\\S]*?)(\\n---\\n)`),
    (_, block, end) => `${block}\n**Tech news:**\n${newsText}\n${end}`
  );
  fs.writeFileSync(LOG, updated, 'utf-8');
}

// ---------- BLOQUE 2: noticias tech por RSS ----------
const RSS_SOURCES = [
  // Webedia (ES)
  'https://www.xataka.com/tag/feeds/rss2.xml',
  'https://www.xatakandroid.com/tag/feeds/rss2.xml',
  'https://www.xatakamovil.com/tag/feeds/rss2.xml',
  'https://www.genbeta.com/tag/feeds/rss2.xml',

  // Hipertextual (ES)
  'https://hipertextual.com/feed',

  // El Español - Tecnología (ES)
  'https://www.elespanol.com/rss/tecnologia/',

  // El País - Tecnología (ES)
  'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/tecnologia/portada',

  // elDiario.es - Tecnología (ES)
  'https://www.eldiario.es/rss/tecnologia/',

  // Xataka México (ES, MX)
  'https://www.xataka.com.mx/tag/feeds/rss2.xml',

  // Xataka Basics (tutoriales)
  'https://www.xataka.com/basics/feeds/rss2.xml',

  // MuyComputer (ES)
  'https://www.muycomputer.com/feed/',
  'https://www.xataka.com/basics/feeds/rss2.xml',
  'https://computerhoy.com/rss',
  'https://www.muycomputerpro.com/feed'
];

function getTag(xml, tag) {
  // Soporta CDATA o texto plano
  const reCdata = new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i');
  const mC = reCdata.exec(xml);
  if (mC && mC[1]) return mC[1].trim();

  const rePlain = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const mP = rePlain.exec(xml);
  return mP && mP[1] ? mP[1].trim() : '';
}
function getTagAny(xml, tags) {
  for (const t of tags) {
    const v = getTag(xml, t);
    if (v) return v;
  }
  return '';
}
function parseDateFromItemXml(itemXml) {
  // Intenta pubDate (RSS), dc:date, updated/published (Atom)
  const raw = getTagAny(itemXml, ['pubDate', 'dc:date', 'updated', 'published']);
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}
function extractItems(xml) {
  // Soporta RSS <item> y Atom <entry>
  const items = [];

  // RSS
  const rssRegex = /<item>([\s\S]*?)<\/item>/ig;
  let m;
  while ((m = rssRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = stripHtml(getTag(block, 'title'));
    const link  = stripHtml(getTag(block, 'link'));
    const desc  = stripHtml(getTagAny(block, ['description', 'summary']));
    const date  = parseDateFromItemXml(block);
    if (title && link) items.push({ title, link, description: desc, date });
  }

  // Atom
  const atomRegex = /<entry>([\s\S]*?)<\/entry>/ig;
  while ((m = atomRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = stripHtml(getTag(block, 'title'));
    const linkTag = /<link[^>]*href="([^"]+)"/i.exec(block);
    const link = linkTag ? linkTag[1] : stripHtml(getTag(block, 'link'));
    const desc  = stripHtml(getTagAny(block, ['summary', 'content']));
    const date  = parseDateFromItemXml(block);
    if (title && link) items.push({ title, link, description: desc, date });
  }

  return items;
}

function loadNewsState() {
  let s = { seenLinks: [], seenTitles: [] };
  if (fs.existsSync(NEWS_STATE)) {
    try { s = Object.assign(s, JSON.parse(fs.readFileSync(NEWS_STATE, 'utf-8'))); } catch {}
  }
  return s;
}
function saveNewsState(s) {
  s.seenLinks  = Array.from(new Set(s.seenLinks )).slice(-400);
  s.seenTitles = Array.from(new Set(s.seenTitles)).slice(-400);
  fs.writeFileSync(NEWS_STATE, JSON.stringify(s, null, 2), 'utf-8');
}

async function fetchOneTechNews() {
  const ua = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' };


  const results = await Promise.allSettled(
    RSS_SOURCES.map(async (url) => {
      try {
        const xml = await fetchXmlWithRetry(url, ua, 2);
        return { url, items: extractItems(xml) };
      } catch (e) {
        console.log('RSS error:', url, e.message);
        return { url, items: [] };
      }
    })
  );

  // Junta todos los ítems
  let all = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const { url, items } = r.value;
      all.push(...items.map(it => ({ ...it, source: url })));
    }
  }
  if (!all.length) return { source: 'N/A', text: 'No se pudieron leer fuentes.' };

  // Filtrado por fecha
  const now = new Date();
  let candidates = all.filter(it => it.date);

  if (CURRENT_YEAR_ONLY) {
    candidates = candidates.filter(it => it.date.getUTCFullYear() === CURRENT_YEAR);
  }

  // Aplica recencia dura
  candidates = candidates.filter(it => daysBetween(now, it.date) <= RECENT_DAYS);

  // Si quedó vacío, relaja a 90 días (aunque cambie el año)
  if (!candidates.length) {
    candidates = all.filter(it => it.date && daysBetween(now, it.date) <= RELAXED_DAYS);
  }

  // Ordena por más reciente
  candidates.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

  // Dedup (link + título normalizado)
  const state = loadNewsState();
  const seenLinks  = new Set(state.seenLinks  || []);
  const seenTitles = new Set(state.seenTitles || []);

  const topN = candidates.slice(0, Math.max(1, PICK_TOP_N));
  const chosen = topN.find(it => !seenLinks.has(it.link) && !seenTitles.has(normTitle(it.title)))
               || candidates[0];

  // Persistencia de vistos
  state.seenLinks.push(chosen.link);
  state.seenTitles.push(normTitle(chosen.title));
  saveNewsState(state);

  // Mensaje compacto con dominio y fecha
  const preview = chosen.description
    ? chosen.description.slice(0, 240) + (chosen.description.length > 240 ? '…' : '')
    : '';
  const isoDate = chosen.date ? chosen.date.toISOString().slice(0, 10) : '';
  const domain = getDomain(chosen.link);
  const text = `📰 ${chosen.title}\n${preview ? preview + '\n' : ''}${chosen.link}\n🗓️ ${isoDate} • 🏷️ ${domain}`;

  return { source: chosen.source, text };
}
async function fetchXmlWithRetry(url, headers, tries = 2) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetchWithTimeout(url, { headers }, 12000);
      return await res.text();
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 500 + i * 500)); // backoff
    }
  }
  throw lastErr || new Error('fetch failed');
}

// ---------- Telegram ----------
async function sendTelegramMessage(text) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('Telegram not configured. Skipping send.');
    return false;
  }
  const api = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const res = await fetch(api, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text })
  });
  if (!res.ok) {
    const body = await res.text();
    console.log('Telegram send failed:', res.status, body);
    return false;
  }
  return true;
}

// ---------- Persistencia de news ----------
async function appendNewsLog(entry) {
  const stamp = new Date().toISOString();
  const block = `\n### ${stamp}\n${entry}\n`;
  if (!fs.existsSync(NEWS_LOG)) fs.writeFileSync(NEWS_LOG, '# Tech News Log\n', 'utf-8');
  fs.appendFileSync(NEWS_LOG, block, 'utf-8');
}

// ---------- MAIN ----------
(async () => {
  const didDaily = updateDailyLearningLogOncePerDay(); // puede ser false si ya estaba hecho
  const news = await fetchOneTechNews();

  await appendNewsLog(news.text);
  if (didDaily) appendNewsToTodayLogIfFirstRun(news.text);

  const sent = await sendTelegramMessage(news.text);
  console.log(`Learning log updated today? ${didDaily ? 'yes' : 'no (already done)'}`);
  console.log(sent ? 'News sent via Telegram.' : 'News NOT sent.');
})();
