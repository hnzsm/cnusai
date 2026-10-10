import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Project root = one level above this scripts/ dir (portable across machines/CI).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://www.cnusai.com';

// --- load data.js in a shimmed window ---
const sandbox = { window: {} };
const code = fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf8');
const fn = new Function('window', code);
fn(sandbox.window);
const W = sandbox.window;
const CN = W.CHINA_SITES, US = W.US_SITES, OSS = W.OSS_PROJECTS, SKILLS = W.SKILLS, TAGS = W.TAGS;
const BOARDS = W.RANK_BOARDS;
const RANK = BOARDS[0];
const LANGS = W.LANGS;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function card(it) {
  const tag = TAGS[it.tag];
  const tagText = tag ? tag.zh : '';
  return `      <a class="card" data-cat="${esc(it.tag)}" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">` +
    `<span class="card-body"><span class="card-name">${esc(it.name)}</span>` +
    `<span class="card-intro">${esc(it.intro.zh)}</span></span>` +
    (tagText ? `<span class="card-tag">${esc(tagText)}</span>` : '') + `</a>`;
}

function section(id, title, items) {
  return `    <section class="panel" id="${id}">
      <header class="panel-head"><h2>${esc(title)}</h2></header>
      <div class="grid">
${items.map(card).join('\n')}
      </div>
    </section>`;
}

// Static snapshot of the default board (text chat, global) for crawlers, plus
// the modality tab labels so those keywords are in the HTML.
const fmtScore = (n, d) => (d > 0 ? Number(n).toFixed(d) : String(n));
const top = RANK.items.global.slice(0, 10);
const rankRows = top.map((it) =>
  `        <li class="rank-row${it.r <= 3 ? ' top' + it.r : ''}"><span class="rank-no">${it.r}</span>` +
  `<span class="rank-name">${esc(it.name)}</span><span class="rank-org">${esc(it.org)}</span>` +
  `<span class="rank-score">${fmtScore(it.score, RANK.digits)}</span></li>`).join('\n');
const boardTabs = BOARDS.map((b, i) =>
  `        <button class="rank-tab${i === 0 ? ' active' : ''}" role="tab">${esc(b.label.zh)}</button>`).join('\n');
const regionTabs = ['全球', '中国', '美国'].map((r, i) =>
  `        <button class="rank-tab${i === 0 ? ' active' : ''}" role="tab">${r}</button>`).join('\n');

const staticMain = `
    <!-- SEO snapshot: prerendered, crawlable links generated from js/data.js.
         app.js replaces this with the interactive UI on load. -->
    <div class="cols">
${section('sec-cn', '中国 AI 导航', CN)}
${section('sec-us', '美国 AI 导航', US)}
    </div>
${section('sec-oss', '开源 AI 项目', OSS)}
${section('sec-skills', 'AI 技能（Skills）', SKILLS)}
    <section class="panel rank-panel" id="sec-rank">
      <header class="panel-head"><h2>模型排名</h2>
        <span class="rank-meta">${esc(RANK.label.zh)} · 全球模型 · ${esc(RANK.metric.zh)} · ${RANK.asOf}</span>
        <a class="rank-src" href="${RANK.sourceUrl}" target="_blank" rel="noopener noreferrer">数据来源</a>
      </header>
      <div class="rank-tabs rank-tabs-scroll" role="tablist">
${boardTabs}
      </div>
      <div class="rank-tabs" role="tablist">
${regionTabs}
      </div>
      <ol class="rank-list">
${rankRows}
      </ol>
    </section>`;

// --- JSON-LD ItemList covering all directories ---
const itemListItems = [];
let pos = 1;
const pushList = (arr) => arr.forEach((it) => {
  itemListItems.push({ '@type': 'ListItem', position: pos++, name: it.name, url: it.url });
});
pushList(CN); pushList(US); pushList(OSS); pushList(SKILLS);

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': SITE + '/#website',
      url: SITE + '/',
      name: '中美 AI 导航',
      alternateName: 'US & China AI Nav',
      description: '一站式直达中美两国 AI 产品、AI 工具、开源 AI 项目与热门 AI 技能（Agent Skills），附 11 个按模态划分的权威大模型排行榜。',
      inLanguage: ['zh-CN', 'en'],
      publisher: { '@id': SITE + '/#org' }
    },
    {
      '@type': 'Organization',
      '@id': SITE + '/#org',
      name: '中美 AI 导航',
      url: SITE + '/'
    },
    {
      '@type': 'WebPage',
      '@id': SITE + '/#webpage',
      url: SITE + '/',
      name: '中美 AI 导航 - 中美 AI 工具·产品·开源项目一站式大全',
      isPartOf: { '@id': SITE + '/#website' },
      inLanguage: 'zh-CN',
      description: '收录中国与美国主流 AI 产品、AI 工具与开源 AI 项目，涵盖 AI 对话、AI 搜索、AI 编程、图像/视频生成、Agent 智能体等分类，并附文本、多模态、图片生成、视频生成、网页开发、智能体、SWE-bench 编程等按模态划分的权威模型排名。'
    },
    {
      '@type': 'ItemList',
      '@id': SITE + '/#directory',
      name: '中美 AI 网站与开源项目目录',
      numberOfItems: itemListItems.length,
      itemListElement: itemListItems
    }
  ]
};

const keywords = '中美AI导航,AI工具导航,中国AI网站,美国AI网站,AI产品大全,AI导航网站,开源AI项目,AI技能,Agent Skills,大模型排名,大模型排行榜,文本模型排名,多模态模型排名,图片生成模型排名,视频生成模型排名,图生视频排名,网页开发模型排名,联网搜索模型排名,智能体排名,SWE-bench排名,AI编程工具,AI搜索,AI智能体,ChatGPT,DeepSeek,Claude,通义千问,文心一言,Kimi,豆包,AI navigation,US China AI directory,model leaderboard by modality,image generation model ranking,video generation model ranking,AI agent skills';
const description = '中美 AI 导航收录中国与美国的主流 AI 产品、AI 工具、开源 AI 项目与热门 AI 技能（Agent Skills），涵盖 AI 对话、AI 搜索、AI 编程、图像/视频生成、Agent 智能体等分类，并按模态提供文本对话、多模态理解、图片生成、图片编辑、视频生成、图生视频、网页开发、联网搜索、文档理解、智能体与 SWE-bench 编程实测共 11 个权威模型排行榜（Arena 人类盲测 Elo），一站式直达中美 AI 生态。';

const head = `  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Primary meta -->
  <title>中美 AI 导航 - 中美 AI 工具·产品·开源项目一站式大全</title>
  <meta name="description" content="${description}">
  <meta name="keywords" content="${keywords}">
  <meta name="author" content="中美 AI 导航">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <meta name="googlebot" content="index, follow">
  <meta name="baiduspider" content="index, follow">
  <link rel="canonical" href="${SITE}/">

  <!-- Language alternates (same page, ?lang= switches UI language) -->
${LANGS.map((l) => `  <link rel="alternate" hreflang="${l.html}" href="${SITE}/?lang=${l.code}">`).join('\n')}
  <link rel="alternate" hreflang="x-default" href="${SITE}/">

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="中美 AI 导航">
  <meta property="og:title" content="中美 AI 导航 - 中美 AI 工具·产品·开源项目一站式大全">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${SITE}/">
  <meta property="og:locale" content="${LANGS[0].locale}">
${LANGS.slice(1).map((l) => `  <meta property="og:locale:alternate" content="${l.locale}">`).join('\n')}
  <meta property="og:image" content="${SITE}/og-cover.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="中美 AI 导航 - 中美 AI 工具·产品·开源项目一站式大全">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="中美 AI 导航 - 中美 AI 工具·产品·开源项目一站式大全">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${SITE}/og-cover.png">

  <!-- Mobile / misc -->
  <meta name="format-detection" content="telephone=no">
  <meta http-equiv="x-dns-prefetch-control" content="on">
  <link rel="icon" type="image/svg+xml" href="logo.svg?v=2">
  <link rel="apple-touch-icon" href="logo.svg?v=2">

  <!-- Structured data -->
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>

  <link rel="stylesheet" href="css/styles.css?v=13">`;

const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
${head}
</head>
<body>
  <header class="site-header">
    <div class="brand">
      <img class="brand-mark" src="logo.svg?v=2" alt="中美 AI 导航 logo" width="44" height="44">
      <div>
        <h1 id="site-title">中美 AI 导航</h1>
        <p id="subtitle">一站式直达中美两国 AI 产品与开源项目</p>
      </div>
    </div>
    <div class="controls">
      <span id="detect-hint" class="detect-hint" hidden></span>
      <div class="lang-switch">
        <select class="lang-select" id="lang-select" aria-label="Language / 语言">
${LANGS.map((l) => `          <option value="${l.code}"${l.code === 'zh' ? ' selected' : ''}>${esc(l.label)}</option>`).join('\n')}
        </select>
      </div>
    </div>
    <nav class="topnav" id="topnav" aria-label="分区导航">
      <a class="nav-link" href="#sec-cn">中国 AI 导航</a>
      <a class="nav-link" href="#sec-us">美国 AI 导航</a>
      <a class="nav-link" href="#sec-oss">开源 AI 项目</a>
      <a class="nav-link" href="#sec-skills">AI 技能（Skills）</a>
      <a class="nav-link" href="#sec-rank">模型排名</a>
    </nav>
  </header>

  <main id="app">${staticMain}
  </main>

  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <img class="brand-mark" src="logo.svg?v=2" alt="" width="36" height="36">
        <div>
          <strong id="footer-title">中美 AI 导航</strong>
          <p id="footer-sub">一站式直达中美两国 AI 产品与开源项目</p>
        </div>
      </div>
      <div class="footer-cols">
        <div class="footer-col">
          <h3 id="footer-h-source">数据来源</h3>
          <ul>
            <li><a href="https://lmarena.ai/leaderboard/" target="_blank" rel="noopener noreferrer">Chatbot Arena (LMArena)</a></li>
            <li><a href="https://www.swebench.com/" target="_blank" rel="noopener noreferrer">SWE-bench Official</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h3 id="footer-h-about">关于本站</h3>
          <p id="footer-about">收录中美 AI 产品与开源项目，模型排名取自 Chatbot Arena 与 SWE-bench 官方快照，仅作导航参考。</p>
        </div>
      </div>
    </div>
    <div class="footer-bottom"><span id="footer">© ${new Date().getFullYear()} 中美 AI 导航 · 数据仅供导航参考 · 语言可手动切换</span></div>
  </footer>

  <script src="js/data.js?v=17"></script>
  <script src="js/app.js?v=24"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'index.html'), indexHtml, 'utf8');

// --- robots.txt ---
const robots = `# ${SITE}/robots.txt
User-agent: *
Allow: /

# Explicitly welcome major Chinese + global crawlers
User-agent: Baiduspider
Allow: /
User-agent: Baiduspider-image
Allow: /
User-agent: 360Spider
Allow: /
User-agent: HaosouSpider
Allow: /
User-agent: Sogou web spider
Allow: /
User-agent: Bytespider
Allow: /
User-agent: Googlebot
Allow: /
User-agent: Bingbot
Allow: /
User-agent: DuckDuckBot
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;
fs.writeFileSync(path.join(ROOT, 'robots.txt'), robots, 'utf8');

// --- sitemap.xml ---
const today = new Date().toISOString().slice(0, 10);
const alternates = [...LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.html}" href="${SITE}/?lang=${l.code}"/>`),
  `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/"/>`].join('\n');
const sitemapUrl = (loc, priority) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
${alternates}
  </url>`;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapUrl(`${SITE}/`, '1.0')}
${LANGS.filter((l) => l.code !== 'zh').map((l) => sitemapUrl(`${SITE}/?lang=${l.code}`, '0.8')).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap, 'utf8');

// --- clean deploy bundle ---------------------------------------------------
// The Pages output directory must NOT be the repo root: Cloudflare installs its
// own deploy tooling into the checkout, so node_modules ends up inside the asset
// tree and a single 129 MB workerd binary breaks the 25 MiB per-asset limit.
// `dist/` holds only the files a visitor actually needs.
const DIST = path.join(ROOT, 'dist');
const DIST_FILES = ['index.html', 'robots.txt', 'sitemap.xml', 'logo.svg', 'og-cover.png'];
const DIST_DIRS = ['css', 'js'];
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
for (const f of DIST_FILES) fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f));
for (const d of DIST_DIRS) fs.cpSync(path.join(ROOT, d), path.join(DIST, d), { recursive: true });

const sizeOf = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .reduce((sum, e) => sum + (e.isDirectory() ? sizeOf(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);

console.log('SITE=' + SITE);
console.log('cards: CN=' + CN.length + ' US=' + US.length + ' OSS=' + OSS.length + ' SKILLS=' + SKILLS.length + ' listItems=' + itemListItems.length);
console.log('index.html bytes=' + Buffer.byteLength(indexHtml));
console.log('dist/ = ' + sizeOf(DIST) + ' bytes → set Pages Build output directory to: dist');
console.log('WROTE index.html, robots.txt, sitemap.xml, dist/');
