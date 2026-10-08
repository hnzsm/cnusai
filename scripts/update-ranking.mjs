import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// update-ranking.mjs — refresh the per-modality model leaderboards baked into
// js/data.js from authoritative first-party sources:
//   · window.RANK_BOARDS[] — one board per modality.
//       text / vision / text_to_image / image_edit / text_to_video /
//       image_to_video / webdev / search / document / agent
//         → Chatbot Arena (LMArena) official leaderboard dataset, one parquet
//           directory per modality, `category === 'overall'` slice.
//       swe → SWE-bench Verified official leaderboard (embedded JSON).
//
// Usage:
//   node scripts/update-ranking.mjs                 # fetch, rewrite js/data.js (writes a .bak)
//   node scripts/update-ranking.mjs --dry           # fetch + print summary, do NOT touch data.js
//   node scripts/update-ranking.mjs --top 50        # global list length (default 30)
//   node scripts/update-ranking.mjs --region-top 30 # cn/us list length (default 20)
//   node scripts/update-ranking.mjs --only text,vision   # refresh a subset
//
// Requires the `hyparquet` devDependency (parquet reader). Install once:
//   npm install
//
// This is a BUILD-TIME tool. The site never calls these sources at runtime —
// the output is a static snapshot committed into data.js.
// ---------------------------------------------------------------------------

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'js/data.js');

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf('--' + name);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : (args.includes('--' + name) ? true : def);
};
const DRY = !!flag('dry', false);
const TOP = parseInt(flag('top', '30'), 10);
const REGION_TOP = parseInt(flag('region-top', '20'), 10);
const ONLY = String(flag('only', '')).split(',').map((s) => s.trim()).filter(Boolean);

const ARENA_MIRROR = 'https://hf-mirror.com/datasets/lmarena-ai/leaderboard-dataset/resolve/main';
const ARENA_ORIGIN = 'https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset/resolve/main';
// huggingface.co is blocked from the mainland dev box but is the fastest route
// from CI runners; the mirror is the fallback there and the primary route here.
const ARENA_BASES = process.env.CI ? [ARENA_ORIGIN, ARENA_MIRROR] : [ARENA_MIRROR, ARENA_ORIGIN];
const ARENA_FILE = 'latest-00000-of-00001.parquet';
const ARENA_SOURCE_URL = 'https://lmarena.ai/leaderboard/';
const SWE_URL = 'https://www.swebench.com/';

const ELO = { zh: 'Arena 评分（人类盲测 Elo）', en: 'Arena Score (blind-test Elo)' };

// Modality boards, in tab order. `dir` is the parquet directory in the dataset.
const BOARDS = [
  { key: 'text',    dir: 'text',           zh: '文本对话',   en: 'Text Chat',      metric: ELO, digits: 0 },
  { key: 'vision',  dir: 'vision',         zh: '多模态理解', en: 'Vision',         metric: ELO, digits: 0 },
  { key: 't2i',     dir: 'text_to_image',  zh: '图片生成',   en: 'Image Gen',      metric: ELO, digits: 0 },
  { key: 'imgedit', dir: 'image_edit',     zh: '图片编辑',   en: 'Image Edit',     metric: ELO, digits: 0 },
  { key: 't2v',     dir: 'text_to_video',  zh: '视频生成',   en: 'Video Gen',      metric: ELO, digits: 0 },
  { key: 'i2v',     dir: 'image_to_video', zh: '图生视频',   en: 'Image→Video',    metric: ELO, digits: 0 },
  { key: 'webdev',  dir: 'webdev',         zh: '网页开发',   en: 'Web Dev',        metric: ELO, digits: 0 },
  { key: 'search',  dir: 'search',         zh: '联网搜索',   en: 'Search',         metric: ELO, digits: 0 },
  { key: 'doc',     dir: 'document',       zh: '文档理解',   en: 'Document',       metric: ELO, digits: 0 },
  { key: 'agent',   dir: 'agent',          zh: '智能体',     en: 'Agent',
    metric: { zh: 'Agent 优势分（真实会话盲测）', en: 'Agent advantage score (live sessions)' }, digits: 4 },
  { key: 'swe',     dir: null,             zh: '编程实测',   en: 'SWE-bench',
    metric: { zh: 'SWE-bench Verified 官方', en: 'SWE-bench Verified (official)' }, digits: 1,
    sourceUrl: SWE_URL }
];

// --- organization → country attribution ------------------------------------
// Only orgs with an unambiguous HQ are attributed; everything else appears in
// the 全球 board alone. Add here when a new org shows up in the logs.
const CN_ORGS = new Set([
  'alibaba', 'wan', 'bytedance', 'baidu', 'tencent', 'xiaomi', 'meituan', 'ant-group',
  'deepseek', 'moonshot', 'minimax', 'stepfun', 'zai', 'kling', 'shengshu'
]);
const US_ORGS = new Set([
  'openai', 'google', 'anthropic', 'meta', 'xai', 'nvidia', 'amazon', 'ibm', 'microsoft',
  'microsoft-ai', 'allenai', 'perplexity', 'diffbot', 'poolside', 'luma-ai', 'pika',
  'runway', 'ideogram', 'genmo', 'krea', 'reve'
]);
// SWE-bench spells orgs differently (display names, not slugs).
const SWE_CN = new Set(['qwen', 'moonshot ai', 'z.ai', 'z-ai', 'minimax', 'deepseek', 'bytedance']);
const SWE_US = new Set(['anthropic', 'openai', 'google deepmind', 'meta']);

const ORG_DISPLAY = {
  google: 'Google', openai: 'OpenAI', anthropic: 'Anthropic', meta: 'Meta', xai: 'xAI',
  deepseek: 'DeepSeek', moonshot: 'Moonshot AI', zai: 'Zhipu AI', minimax: 'MiniMax',
  stepfun: 'StepFun', 'ant-group': 'Ant Group', alibaba: 'Alibaba', bytedance: 'ByteDance',
  tencent: 'Tencent', baidu: 'Baidu', xiaomi: 'Xiaomi', meituan: 'Meituan', nvidia: 'NVIDIA',
  amazon: 'Amazon', ibm: 'IBM', microsoft: 'Microsoft', 'microsoft-ai': 'Microsoft',
  allenai: 'AI2', mistral: 'Mistral AI', cohere: 'Cohere', upstage: 'Upstage',
  'inception-ai': 'Inception', thinky: 'Thinky', wan: 'Alibaba', kling: 'Kuaishou',
  shengshu: 'Shengshu', hidream: 'HiDream', aorizon: 'Aorizon', kandinsky: 'Sber',
  bfl: 'Black Forest Labs', recraft: 'Recraft', 'leonardo-ai': 'Leonardo',
  'luma-ai': 'Luma AI', pika: 'Pika', runway: 'Runway', ideogram: 'Ideogram',
  perplexity: 'Perplexity', diffbot: 'Diffbot', poolside: 'Poolside', genmo: 'Genmo',
  krea: 'KREA', reve: 'Reve'
};

// ---------------------------------------------------------------------------
async function fetchArrayBuffer(url, ms = 60000) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.arrayBuffer();
}
async function fetchText(url, ms = 60000) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

const PAREN_MODES = new Set(['high', 'medium', 'low', 'xhigh', 'xlow']);
const ACRONYMS = {
  gpt: 'GPT', chatgpt: 'ChatGPT', glm: 'GLM', ernie: 'ERNIE', mimo: 'MiMo',
  deepseek: 'DeepSeek', llama: 'LLaMA', mixtral: 'Mixtral', qwen: 'Qwen', grok: 'Grok',
  gemini: 'Gemini', mistral: 'Mistral', whisper: 'Whisper', cohere: 'Cohere',
  hunyuan: 'Hunyuan', hy: 'HY', vl: 'VL', tts: 'TTS', flux: 'FLUX', sora: 'Sora', veo: 'Veo',
  sensenova: 'SenseNova', trinity: 'Trinity', soroban: 'Soroban', command: 'Command',
  nova: 'Nova', seed: 'Seed', ring: 'Ring', yi: 'Yi', doubao: 'Doubao', kimi: 'Kimi',
  spark: 'Spark', abab: 'ABAB', minimax: 'MiniMax', stepfun: 'StepFun', erina: 'ERINA',
  wan: 'Wan', kling: 'Kling', vidu: 'Vidu', omni: 'Omni', astra: 'Astra', sol: 'Sol',
  xhigh: 'xHigh', xlow: 'xLow'
};
// Rows the source itself could not attribute — noise in a leaderboard.
const SKIP_NAMES = /undisclosed|anonymous/i;

// claude-opus-4-6-high → "Claude Opus 4.6 (high)". Idempotent for names that
// are already beautified (the agent/search boards ship display names).
function beautifyName(slug) {
  if (!slug) return '';
  let tokens = String(slug).split(/[-_\s]+/).filter(Boolean);
  let paren = null;
  const last = tokens[tokens.length - 1];
  const lastMode = last ? last.toLowerCase().replace(/[()]/g, '') : '';
  if (tokens.length > 1 && PAREN_MODES.has(lastMode)) {
    paren = lastMode;
    tokens = tokens.slice(0, -1);
  }
  const out = [];
  for (const tk of tokens) {
    if (/^\d+[bB]$/.test(tk)) {
      out.push(tk.toUpperCase()); // 235b → 235B (parameter size)
    } else if (/^[aA]\d+[bB]$/.test(tk)) {
      out.push('A' + tk.slice(1).toUpperCase()); // a22b → A22B
    } else if (/^\d+$/.test(tk)) {
      // Join only short segments into a version (4-6 → 4.6); keep long numbers
      // (dates/build ids like 20251101) as their own word.
      if (tk.length <= 2 && out.length && /^\d+(\.\d+)*$/.test(out[out.length - 1])) {
        out[out.length - 1] = out[out.length - 1] + '.' + tk;
      } else {
        out.push(tk);
      }
    } else if (/^\d/.test(tk)) {
      out.push(tk);
    } else if (/^o\d+$/.test(tk.toLowerCase())) {
      out.push(tk.toLowerCase());
    } else if (/^[({]/.test(tk)) {
      // Already-parenthesised suffix, e.g. "(Max)" or "(high)"; normalise mode words.
      out.push(tk.replace(/\((high|medium|low|xhigh|xlow|max)\)/i, (m, w) => `(${w.toLowerCase()})`));
    } else if (/^hy\d/i.test(tk)) {
      out.push('HY' + tk.slice(2)); // hy3 → HY3 (Tencent Hunyuan)
    } else {
      const low = tk.toLowerCase();
      out.push(ACRONYMS[low] || tk.charAt(0).toUpperCase() + tk.slice(1));
    }
  }
  let name = out.join(' ');
  if (paren) name += ` (${paren})`;
  // Uniform casing for trailing mode suffixes: (High)/(xHigh)/(Max) → lowercase.
  name = name.replace(/\((high|medium|low|xhigh|xlow|max)\)$/i, (m, w) => `(${w.toLowerCase()})`);
  return name;
}

function orgDisplay(slug) {
  if (!slug) return '';
  const key = String(slug).toLowerCase();
  return ORG_DISPLAY[key] || slug.charAt(0).toUpperCase() + slug.slice(1);
}

function roundTo(n, digits) {
  return digits <= 0 ? Math.round(n) : Number(Number(n).toFixed(digits));
}

// ---------------------------------------------------------------------------
async function readParquet(dir) {
  let buf = null, used = '';
  const rel = `/${dir}/${ARENA_FILE}`;
  for (const base of ARENA_BASES) {
    try { buf = await fetchArrayBuffer(base + rel); used = base + rel; break; }
    catch (e) { console.warn(`  ${dir}: fetch failed (${e.message}), trying next mirror`); }
  }
  if (!buf) throw new Error(`could not download ${dir}/${ARENA_FILE} from any mirror`);

  let hyparquet;
  try { hyparquet = await import('hyparquet'); }
  catch { throw new Error('missing dependency `hyparquet` — run `npm install` first'); }

  const ab = buf;
  const rows = await hyparquet.parquetReadObjects({
    file: { byteLength: ab.byteLength, slice: (s, e) => ab.slice(s, e) }
  });
  return { rows, used, bytes: ab.byteLength };
}

// Boards whose value column is `score` instead of `rating`.
const SCORE_FIELD = { agent: 'score' };

async function buildArenaBoard(cfg) {
  const { rows, bytes } = await readParquet(cfg.dir);
  const field = SCORE_FIELD[cfg.key] || 'rating';
  const overall = rows
    .filter((r) => r.category === 'overall' && r.model_name && typeof r[field] === 'number' && !SKIP_NAMES.test(r.model_name))
    .sort((a, b) => b[field] - a[field]);
  if (!overall.length) throw new Error(`${cfg.dir}: no rows with category=overall`);

  const mk = (list) => list.map((r, i) => ({
    r: i + 1,
    name: beautifyName(r.model_name),
    org: orgDisplay(r.organization),
    score: roundTo(r[field], cfg.digits)
  }));
  const orgOf = (r) => String(r.organization || '').toLowerCase();
  const publishDate = overall[0].leaderboard_publish_date;

  return {
    key: cfg.key,
    label: { zh: cfg.zh, en: cfg.en },
    asOf: publishDate ? String(publishDate).slice(0, 7) : new Date().toISOString().slice(0, 7),
    metric: cfg.metric,
    sourceUrl: cfg.sourceUrl || ARENA_SOURCE_URL,
    digits: cfg.digits,
    items: {
      global: mk(overall.slice(0, TOP)),
      cn: mk(overall.filter((r) => CN_ORGS.has(orgOf(r))).slice(0, REGION_TOP)),
      us: mk(overall.filter((r) => US_ORGS.has(orgOf(r))).slice(0, REGION_TOP))
    },
    _pool: overall.length,
    _bytes: bytes
  };
}

async function buildSweBoard(cfg) {
  const html = await fetchText(SWE_URL);
  const m = html.match(/<script type="application\/json" id="leaderboard-data">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('could not locate leaderboard-data JSON on swebench.com (page structure may have changed)');
  const cats = JSON.parse(m[1]);
  const verified = (cats.find((c) => /verified/i.test(c.name)) || {}).results;
  if (!Array.isArray(verified)) throw new Error('SWE Verified category missing/renamed');

  // Best resolved % per model, across agent harnesses. The same model shows up
  // under near-identical display strings ("480B/A35B" vs "480B A35B"), so the
  // dedupe key is normalised rather than the raw display name.
  const best = new Map();
  const norm = (s) => s.toLowerCase().replace(/[\/\-_.]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const e of verified) {
    const disp = (e.model_display || '').trim();
    if (!disp || /multiple|ensemble|n\/a/i.test(disp) || SKIP_NAMES.test(disp)) continue;
    if (typeof e.resolved !== 'number') continue;
    const key = norm(disp);
    const cur = best.get(key);
    if (!cur || e.resolved > cur.resolved) best.set(key, e);
  }
  const entries = [...best.values()].sort((a, b) => b.resolved - a.resolved);

  const mk = (list) => list.map((e, i) => ({
    r: i + 1,
    name: beautifyName(e.model_display),
    org: orgDisplay(e.model_org),
    score: roundTo(e.resolved, cfg.digits)
  }));
  const org = (e) => String(e.model_org || '').toLowerCase();

  return {
    key: cfg.key,
    label: { zh: cfg.zh, en: cfg.en },
    asOf: new Date().toISOString().slice(0, 7),
    metric: cfg.metric,
    sourceUrl: cfg.sourceUrl,
    digits: cfg.digits,
    items: {
      global: mk(entries.slice(0, TOP)),
      cn: mk(entries.filter((e) => SWE_CN.has(org(e))).slice(0, REGION_TOP)),
      us: mk(entries.filter((e) => SWE_US.has(org(e))).slice(0, REGION_TOP))
    },
    _pool: entries.length,
    _bytes: html.length
  };
}

// ---------------------------------------------------------------------------
function serializeBoards(boards) {
  const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const row = (it, digits) =>
    `        { r: ${it.r}, name: ${q(it.name)}, org: ${q(it.org)}, score: ${digits > 0 ? it.score.toFixed(digits) : it.score} },`;
  const list = (arr, digits) => (arr.length
    ? '[\n' + arr.map((it) => row(it, digits)).join('\n').replace(/,$/, '') + '\n      ]'
    : '[]');

  const blocks = boards.map((b) => `  {
    key: ${q(b.key)},
    label: { zh: ${q(b.label.zh)}, en: ${q(b.label.en)} },
    asOf: ${q(b.asOf)},
    metric: { zh: ${q(b.metric.zh)}, en: ${q(b.metric.en)} },
    sourceUrl: ${q(b.sourceUrl)},
    digits: ${b.digits},
    items: {
      global: ${list(b.items.global, b.digits)},
      cn: ${list(b.items.cn, b.digits)},
      us: ${list(b.items.us, b.digits)}
    }
  }`);
  return `// Model leaderboards, one board per modality. Regenerate with:
//   node scripts/update-ranking.mjs   (see scripts/update-ranking.mjs header)
window.RANK_BOARDS = [\n${blocks.join(',\n')}\n];`;
}

// First run replaces the legacy MODEL_RANKING + MODEL_RANKING_CODE pair; later
// runs replace the RANK_BOARDS array (and its header comment) in place.
const RE_BOARDS = /(?:^\/\/ [^\n]*\n)*window\.RANK_BOARDS = \[[\s\S]*?\n\];/m;
function spliceBoards(src, block) {
  if (RE_BOARDS.test(src)) return src.replace(RE_BOARDS, () => block);
  const reGeneral = /window\.MODEL_RANKING = \{[\s\S]*?\n\};/;
  const reCode = /window\.MODEL_RANKING_CODE = \{[\s\S]*?\n\};/;
  if (!reGeneral.test(src)) throw new Error('could not find window.MODEL_RANKING or window.RANK_BOARDS in data.js');
  let out = src.replace(reGeneral, () => block);
  out = out.replace(reCode, '');
  return out.replace(/\n{3,}/g, '\n\n');
}

function summarize(b) {
  const g = b.items.global;
  console.log(
    `  ${b.label.zh}/${b.label.en}`.padEnd(26) +
    `pool=${String(b._pool).padStart(4)} global=${String(g.length).padStart(3)} ` +
    `cn=${String(b.items.cn.length).padStart(3)} us=${String(b.items.us.length).padStart(3)} ` +
    `asOf=${b.asOf}`
  );
  if (g.length) console.log(`      #1 ${g[0].name} (${g[0].org}) ${g[0].score}`);
  const thin = ['cn', 'us'].filter((k) => b.items[k].length < 5);
  if (thin.length) console.log(`      note: ${thin.join('/')} slice has <5 models`);
}

async function main() {
  const wanted = ONLY.length ? BOARDS.filter((b) => ONLY.includes(b.key)) : BOARDS;
  if (!wanted.length) throw new Error(`--only matched no board (keys: ${BOARDS.map((b) => b.key).join(', ')})`);
  console.log(`update-ranking: fetching ${wanted.length} board(s)…`);

  const boards = [];
  const failed = [];
  for (const cfg of wanted) {
    try {
      boards.push(cfg.dir ? await buildArenaBoard(cfg) : await buildSweBoard(cfg));
    } catch (e) {
      failed.push(cfg.key);
      console.warn(`  !! ${cfg.key} failed: ${e.message}`);
    }
  }
  if (!boards.length) throw new Error('every board failed to build — nothing to write');
  // A full run replaces the whole array, so writing a partial result would
  // silently delete the boards that failed to fetch. Only a merge run may proceed.
  if (!ONLY.length && failed.length) {
    throw new Error(`aborted: ${failed.length} board(s) failed (${failed.join(', ')}) — rerun later or use --only to merge`);
  }
  boards.forEach(summarize);

  const src = fs.readFileSync(DATA, 'utf8');
  let out;
  if (ONLY.length) {
    // Partial refresh: keep boards we did not fetch, replace the ones we did.
    const sandbox = { window: {} };
    new Function('window', src)(sandbox.window);
    const existing = sandbox.window.RANK_BOARDS || [];
    if (!existing.length) throw new Error('--only requires data.js to already contain window.RANK_BOARDS');
    const byKey = new Map(boards.map((b) => [b.key, b]));
    const merged = existing.map((b) => byKey.get(b.key) || b);
    out = spliceBoards(src, serializeBoards(merged));
  } else {
    out = spliceBoards(src, serializeBoards(boards));
  }

  if (DRY) {
    console.log(`\n[dry-run] data.js NOT written. Size ${src.length} → ${out.length} (${out.length - src.length >= 0 ? '+' : ''}${out.length - src.length} bytes)`);
    return;
  }
  fs.writeFileSync(DATA + '.bak', src, 'utf8');
  fs.writeFileSync(DATA, out, 'utf8');
  console.log(`\nwrote js/data.js (${out.length}B, backup at js/data.js.bak). Now run: node scripts/build-seo.mjs`);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
