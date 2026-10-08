(function () {
  'use strict';

  var STORAGE_KEY = 'cnusai-lang';
  var state = { lang: 'zh', geo: null, rankTab: 'text', rankRegion: 'global', globalQ: '', globalQRaw: '', override: localStorage.getItem(STORAGE_KEY) || null };

  var UI = {
    zh: {
      siteTitle: '中美 AI 导航',
      siteSub: '一站式直达中美两国 AI 产品与开源项目',
      seoTitle: '中美 AI 导航 - 中美 AI 工具·产品·开源项目一站式大全',
      chinaCol: '中国 AI 导航',
      usCol: '美国 AI 导航',
      ossCol: '开源 AI 项目',
      skillsCol: 'AI 技能（Skills）',
      globalSearch: '全局搜索所有站点与技能…',
      backTop: '回到顶部',
      resultSuffix: '个结果',
      detected: '已按您的地区切换界面语言',
      search: '搜索名称或简介…',
      all: '全部',
      empty: '没有匹配结果',
      rankTitle: '模型排名',
      rankRegionGlobal: '全球',
      rankRegionCN: '中国',
      rankRegionUS: '美国',
      rankRegionSuffix: '模型',
      rankMore: '查看更多',
      rankLess: '收起',
      rankSrc: '数据来源',
      footerSource: '数据来源',
      footerAbout: '关于本站',
      footerAboutText: '收录中美 AI 产品与开源项目，模型排名取自 Chatbot Arena 与 SWE-bench 官方快照，仅作导航参考。',
      footerNote: '数据仅供导航参考 · 语言可手动切换'
    },
    en: {
      siteTitle: 'US & China AI Nav',
      siteSub: 'One-stop directory of AI products and open-source projects',
      seoTitle: 'US & China AI Nav - AI Tools, Products & Open-Source Directory',
      chinaCol: 'China AI',
      usCol: 'US AI',
      ossCol: 'Open-Source AI Projects',
      skillsCol: 'AI Skills',
      globalSearch: 'Search all sites & skills…',
      backTop: 'Back to top',
      resultSuffix: 'results',
      detected: 'UI language set from your region',
      search: 'Search name or description…',
      all: 'All',
      empty: 'No results',
      rankTitle: 'Model Rankings',
      rankRegionGlobal: 'Global',
      rankRegionCN: 'China',
      rankRegionUS: 'US',
      rankRegionSuffix: ' models',
      rankMore: 'Show more',
      rankLess: 'Collapse',
      rankSrc: 'Source',
      footerSource: 'Data sources',
      footerAbout: 'About',
      footerAboutText: 'A directory of China & US AI products and open-source projects; model rankings are official snapshots from Chatbot Arena and SWE-bench, for reference only.',
      footerNote: 'For reference only · Language switchable anytime'
    }
  };

  // --- language registry -----------------------------------------------------
  // window.LANGS (js/data.js) lists every supported language; zh/en strings are
  // built into UI below, the others arrive as on-demand packs (js/i18n/<code>.js)
  // that register themselves on window.I18N. `cnFirst` drives the two layouts
  // that mirror for a Chinese audience: the 中国/美国 column order and the
  // 全球/中国/美国 region-tab order. Every other language uses the en layout.
  var LANGS = window.LANGS;
  var BUILT_IN = { zh: true, en: true };
  var PACK_VERSION = '1';

  function findLang(code) {
    for (var i = 0; i < LANGS.length; i++) { if (LANGS[i].code === code) return LANGS[i]; }
    return null;
  }
  function langMeta(code) { return findLang(code) || findLang('en') || LANGS[0]; }
  function cnFirst() { return langMeta(state.lang).cnFirst; }
  function pack() { return (window.I18N && window.I18N[state.lang]) || null; }

  // A {zh,en} pair from data.js → active language, falling back en → zh so a
  // missing string never renders "undefined".
  function L(obj) {
    if (!obj) return '';
    return obj[state.lang] || obj.en || obj.zh || '';
  }
  // A pack may legitimately translate a string as empty (ru drops the region
  // suffix), so presence is checked by type rather than truthiness.
  function str(v) { return typeof v === 'string' ? v : null; }
  function t(key) {
    var p = pack();
    var v = str(p && p.ui && p.ui[key]);
    if (v === null) v = str(UI[state.lang] && UI[state.lang][key]);
    if (v === null) v = str(UI.en[key]);
    if (v === null) v = str(UI.zh[key]);
    return v === null ? key : v;
  }
  function tagLabel(tag) {
    var p = pack();
    var v = str(p && p.tags && p.tags[tag]);
    if (v !== null) return v;
    return window.TAGS[tag] ? L(window.TAGS[tag]) : tag;
  }
  function introOf(item) {
    var p = pack();
    var v = str(p && p.sites && p.sites[item.url]);
    return v !== null ? v : L(item.intro);
  }
  function boardText(board, field) {
    var p = pack();
    var v = str(p && p.boards && p.boards[board.key] && p.boards[board.key][field]);
    return v !== null ? v : L(board[field]);
  }

  // Lazy pack loader: one <script> per language, fetched the first time it is
  // selected. A failed fetch degrades to English copy rather than blocking.
  var packState = {};
  var packQueue = {};
  function ensureLang(code, cb) {
    if (BUILT_IN[code] || packState[code] === 'ready' || packState[code] === 'failed') { cb(); return; }
    (packQueue[code] = packQueue[code] || []).push(cb);
    if (packState[code] === 'loading') return;
    packState[code] = 'loading';
    var flush = function (ok) {
      packState[code] = ok ? 'ready' : 'failed';
      var q = packQueue[code] || [];
      packQueue[code] = [];
      q.forEach(function (fn) { fn(); });
    };
    var s = document.createElement('script');
    s.src = 'js/i18n/' + code + '.js?v=' + PACK_VERSION;
    s.onload = function () { flush(!!(window.I18N && window.I18N[code])); };
    s.onerror = function () { flush(false); };
    document.head.appendChild(s);
  }

  function langOptionsHtml() {
    return LANGS.map(function (l) {
      return '<option value="' + l.code + '"' + (l.code === state.lang ? ' selected' : '') + '>' + l.label + '</option>';
    }).join('');
  }

  // Country → UI language, used only when the browser exposes no language we
  // support. Everything unmapped falls through to English.
  var COUNTRY_LANG = {
    CN: 'zh', TW: 'zh', HK: 'zh', MO: 'zh', SG: 'zh',
    JP: 'ja',
    KR: 'ko', KP: 'ko',
    RU: 'ru', BY: 'ru', KZ: 'ru', KG: 'ru',
    ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es', UY: 'es',
    PY: 'es', BO: 'es', EC: 'es', GT: 'es', CU: 'es', DO: 'es', HN: 'es', NI: 'es',
    CR: 'es', PA: 'es', SV: 'es', PR: 'es', GQ: 'es'
  };
  function geoLang(code) { return code ? COUNTRY_LANG[code] || null : null; }

  function isLang(code) { return !!findLang(code); }

  // First browser language we have a pack for, or null when there is none.
  function browserLang() {
    var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language];
    for (var i = 0; i < list.length; i++) {
      var found = findLang(String(list[i] || '').toLowerCase().split('-')[0]);
      if (found) return found.code;
    }
    return null;
  }


  // Keep canonical / OG URL / title in sync with the active UI language so each
  // ?lang= variant self-references and matches its hreflang alternate.
  function updateSeoMeta() {
    var url;
    try {
      var u = new URL(location.href);
      u.searchParams.set('lang', state.lang);
      url = u.toString();
    } catch (e) { return; }
    var link = document.querySelector('link[rel="canonical"]');
    if (link) link.href = url;
    var ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', url);
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', t('seoTitle'));
    var ogLocale = document.querySelector('meta[property="og:locale"]');
    if (ogLocale) ogLocale.setAttribute('content', langMeta(state.lang).locale);
  }

  var GITHUB_ICON = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="64" height="64">' +
    '<path fill="#ffffff" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>');

  function isGithub(item) { return item.url.indexOf('https://github.com/') === 0; }

  function iconSources(item) {
    var host;
    try { host = new URL(item.url).hostname; } catch (e) { return null; }
    if (host === 'github.com') {
      var org = item.url.split('/')[3];
      return org
        ? ['https://github.com/' + org + '.png', 'https://unavatar.io/github/' + org + '?fallback=false']
        : null;
    }
    // Global-first ordering: CDN aggregator (reachable incl. mainland) → direct
    // favicon (zero third-party) → Google as a last-resort net for non-CN users.
    return [
      'https://unavatar.io/' + host + '?fallback=false',
      'https://' + host + '/favicon.ico',
      'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(host) + '&sz=64'
    ];
  }

  window.iconNext = function (img) {
    var alts = (img.dataset.alt || '').split('|').filter(Boolean);
    var next = alts.shift();
    if (next) {
      img.dataset.alt = alts.join('|');
      img.src = next;
    } else if (img.dataset.gh === '1') {
      img.dataset.alt = '';
      img.removeAttribute('onerror');
      img.src = GITHUB_ICON;
    } else {
      img.remove();
    }
  };

  // Icons whose connections stall never fire load/error; advance them manually
  // through the fallback chain until every source is exhausted.
  var iconWatchTimer = null;
  function watchIconTimeouts() {
    if (iconWatchTimer) clearInterval(iconWatchTimer);
    var deadline = Date.now() + 30000;
    iconWatchTimer = setInterval(function () {
      var imgs = document.querySelectorAll('.card-icon img');
      var pending = 0;
      imgs.forEach(function (img) {
        if (img.complete || !img.currentSrc) return;
        pending++;
        if (Date.now() > deadline) img.remove();
        else window.iconNext(img);
      });
      if (!pending) { clearInterval(iconWatchTimer); iconWatchTimer = null; }
    }, 5000);
  }

  function flagBadge(item) {
    var sources = iconSources(item);
    if (!sources) return '';
    var initial = (item.name || '?').trim().charAt(0).toUpperCase();
    return '<span class="card-icon" aria-hidden="true">' +
      '<img src="' + sources[0] + '" alt="" loading="lazy" decoding="async" ' +
      'data-alt="' + sources.slice(1).join('|') + '" ' +
      (isGithub(item) ? 'data-gh="1" ' : '') +
      'onerror="iconNext(this)">' + initial + '</span>';
  }

  function cardHtml(item) {
    var intro = introOf(item);
    var tagText = window.TAGS[item.tag] ? tagLabel(item.tag) : '';
    return '<a class="card" data-cat="' + item.tag + '" href="' + item.url + '" target="_blank" rel="noopener noreferrer">' +
      flagBadge(item) +
      '<span class="card-body">' +
        '<span class="card-name">' + item.name + '</span>' +
        '<span class="card-intro">' + intro + '</span>' +
      '</span>' +
      (tagText ? '<span class="card-tag">' + tagText + '</span>' : '') +
      '</a>';
  }

  function chipsHtml(items) {
    var seen = [];
    items.forEach(function (it) { if (seen.indexOf(it.tag) === -1) seen.push(it.tag); });
    var html = '<button class="chip active" data-cat="all">' + t('all') + '</button>';
    seen.forEach(function (tag) {
      var label = tagLabel(tag);
      html += '<button class="chip" data-cat="' + tag + '">' + label + '</button>';
    });
    return '<div class="chips" role="group" aria-label="category">' + html + '</div>';
  }

  var RANK_COLLAPSED = 20;
  var RANK_MAX = 100;
  // A region tab is only offered when the source has enough models in it.
  var RANK_REGION_MIN = 3;

  function currentBoard() {
    var boards = window.RANK_BOARDS || [];
    for (var i = 0; i < boards.length; i++) {
      if (boards[i].key === state.rankTab) return boards[i];
    }
    return boards[0];
  }

  function boardRegions(board) {
    var order = cnFirst() ? ['global', 'cn', 'us'] : ['global', 'us', 'cn'];
    return order.filter(function (rg) {
      return rg === 'global' || (board.items[rg] || []).length >= RANK_REGION_MIN;
    });
  }

  function fmtScore(score, digits) {
    return digits > 0 ? Number(score).toFixed(digits) : String(score);
  }

  function rankHtml() {
    var board = currentBoard();
    if (!board) return '';
    var regions = boardRegions(board);
    var region = regions.indexOf(state.rankRegion) === -1 ? 'global' : state.rankRegion;
    var items = (board.items[region] || board.items.global).slice(0, RANK_MAX);
    var rows = items.map(function (it, i) {
      var cls = 'rank-row' + (i >= RANK_COLLAPSED ? ' extra' : '') + (it.r <= 3 ? ' top' + it.r : '');
      return '<li class="' + cls + '"' + (i >= RANK_COLLAPSED ? ' hidden' : '') + '>' +
        '<span class="rank-no">' + it.r + '</span>' +
        '<span class="rank-name">' + it.name + '</span>' +
        '<span class="rank-org">' + it.org + '</span>' +
        '<span class="rank-score">' + fmtScore(it.score, board.digits) + '</span>' +
        '</li>';
    }).join('');
    var extraCount = items.length - RANK_COLLAPSED;
    var regionKey = region === 'cn' ? 'rankRegionCN' : region === 'us' ? 'rankRegionUS' : 'rankRegionGlobal';
    var boardBtns = (window.RANK_BOARDS || []).map(function (b) {
      return '<button class="rank-tab' + (b.key === board.key ? ' active' : '') + '" data-tab="' + b.key +
        '" role="tab" aria-selected="' + (b.key === board.key) + '">' + boardText(b, 'label') + '</button>';
    }).join('');
    var regionBtns = regions.map(function (rg) {
      var key = rg === 'cn' ? 'rankRegionCN' : rg === 'us' ? 'rankRegionUS' : 'rankRegionGlobal';
      return '<button class="rank-tab' + (region === rg ? ' active' : '') + '" data-region="' + rg +
        '" role="tab" aria-selected="' + (region === rg) + '">' + t(key) + '</button>';
    }).join('');
    var tabs = '<div class="rank-tabs rank-tabs-scroll" role="tablist" aria-label="' + t('rankTitle') + '">' + boardBtns + '</div>' +
      '<div class="rank-tabs" role="tablist">' + regionBtns + '</div>';
    return '<section class="panel rank-panel" id="sec-rank">' +
      '<header class="panel-head"><h2>' + t('rankTitle') + '</h2>' +
      '<span class="rank-meta">' + boardText(board, 'label') + ' · ' + t(regionKey) + t('rankRegionSuffix') +
      ' · ' + boardText(board, 'metric') + ' · ' + board.asOf + '</span>' +
      '<a class="rank-src" href="' + board.sourceUrl + '" target="_blank" rel="noopener noreferrer">' + t('rankSrc') + '</a>' +
      '</header>' +
      tabs +
      '<ol class="rank-list">' + rows + '</ol>' +
      (extraCount > 0
        ? '<button class="rank-more" id="rank-more" data-extra="' + extraCount + '">' + t('rankMore') + ' (+' + extraCount + ')</button>'
        : '') +
      '</section>';
  }

  function bindRankTabs() {
    var sec = document.getElementById('sec-rank');
    if (!sec) return;
    sec.querySelectorAll('.rank-tabs').forEach(function (bar) {
      bar.addEventListener('click', function (e) {
        var btn = e.target.closest('.rank-tab');
        if (!btn) return;
        if (btn.dataset.tab) {
          if (btn.dataset.tab === state.rankTab) return;
          state.rankTab = btn.dataset.tab;
        } else if (btn.dataset.region) {
          if (btn.dataset.region === state.rankRegion) return;
          state.rankRegion = btn.dataset.region;
        } else return;
        sec.outerHTML = rankHtml();
        bindRankTabs();
        bindRankToggle();
        var active = document.querySelector('#sec-rank .rank-tabs-scroll .rank-tab.active');
        if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    });
  }

  function bindRankToggle() {
    var btn = document.getElementById('rank-more');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var expanded = btn.dataset.expanded === '1';
      document.querySelectorAll('#sec-rank .rank-row.extra').forEach(function (row) {
        row.hidden = expanded;
      });
      btn.dataset.expanded = expanded ? '0' : '1';
      btn.textContent = expanded
        ? t('rankMore') + ' (+' + btn.dataset.extra + ')'
        : t('rankLess');
    });
  }

  function sectionHtml(id, title, hint, items, rows) {
    return '<section class="panel" id="' + id + '"' + (rows ? ' data-rows="' + rows + '"' : '') + '>' +
      '<header class="panel-head"><h2>' + title + '</h2>' +
      (hint ? '<span class="panel-flag">' + hint + '</span>' : '') +
      '<input class="panel-search" type="search" data-target="' + id + '" placeholder="' + t('search') + '" aria-label="' + t('search') + '">' +
      '</header>' +
      chipsHtml(items) +
      '<div class="grid">' + items.map(cardHtml).join('') +
      '<p class="empty" hidden>' + t('empty') + '</p></div>' +
      (rows ? '<button class="grid-more" id="' + id + '-more" hidden>' + t('rankMore') + '</button>' : '') +
      '</section>';
  }

  function topnavHtml() {
    var order = cnFirst()
      ? [['sec-cn', 'chinaCol'], ['sec-us', 'usCol'], ['sec-oss', 'ossCol'], ['sec-skills', 'skillsCol'], ['sec-rank', 'rankTitle']]
      : [['sec-us', 'usCol'], ['sec-cn', 'chinaCol'], ['sec-oss', 'ossCol'], ['sec-skills', 'skillsCol'], ['sec-rank', 'rankTitle']];
    var links = order.map(function (p) {
      return '<a class="nav-link" data-sec="' + p[0] + '" href="#' + p[0] + '">' + t(p[1]) + '</a>';
    }).join('');
    return links +
      '<input class="global-search" id="global-search" type="search" placeholder="' + t('globalSearch') +
      '" aria-label="' + t('globalSearch') + '" value="' + (state.globalQRaw || '').replace(/"/g, '&quot;') + '">' +
      '<span class="global-count" id="global-count" hidden></span>';
  }

  function applyGlobalSearch() {
    document.querySelectorAll('#app section.panel').forEach(function (panel) {
      if (!panel.querySelector('.panel-search')) return;
      panel.dataset.expanded = state.globalQ ? '1' : '0';
      applyFilter(panel);
    });
    var total = 0;
    document.querySelectorAll('#app .card').forEach(function (c) {
      if (!c.hidden && !c.classList.contains('collapsed-hide')) total++;
    });
    var el = document.getElementById('global-count');
    if (el) {
      el.hidden = !state.globalQ;
      if (state.globalQ) el.textContent = total + ' ' + t('resultSuffix');
    }
  }

  function bindTopnav() {
    var input = document.getElementById('global-search');
    if (input) input.addEventListener('input', function () {
      state.globalQRaw = input.value;
      state.globalQ = input.value.trim().toLowerCase();
      applyGlobalSearch();
    });
  }

  function highlightNav() {
    var links = document.querySelectorAll('.topnav .nav-link');
    if (!links.length) return;
    var offset = window.innerWidth <= 720 ? 70 : 160;
    var current = null;
    links.forEach(function (a) {
      var sec = document.getElementById(a.dataset.sec);
      if (sec && sec.getBoundingClientRect().top <= offset) current = a;
    });
    links.forEach(function (a) { a.classList.toggle('active', a === current); });
  }

  function initScrollUi() {
    var backtop = document.createElement('button');
    backtop.className = 'backtop';
    backtop.type = 'button';
    backtop.textContent = '↑';
    backtop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    document.body.appendChild(backtop);
    window.addEventListener('scroll', function () {
      backtop.classList.toggle('show', window.scrollY > 600);
      highlightNav();
    }, { passive: true });
  }

  function render() {
    document.documentElement.lang = langMeta(state.lang).html;
    var cn = sectionHtml('sec-cn', t('chinaCol'), '🇨🇳', window.CHINA_SITES, 8);
    var us = sectionHtml('sec-us', t('usCol'), '🇺🇸', window.US_SITES, 8);
    var oss = sectionHtml('sec-oss', t('ossCol'), '', window.OSS_PROJECTS, 6);
    var skills = sectionHtml('sec-skills', t('skillsCol'), '', window.SKILLS, 4);

    document.getElementById('app').innerHTML =
      '<div class="cols">' + (cnFirst() ? cn + us : us + cn) + '</div>' + oss + skills + rankHtml();

    document.getElementById('site-title').textContent = t('siteTitle');
    document.getElementById('subtitle').textContent = t('siteSub');
    document.getElementById('footer-title').textContent = t('siteTitle');
    document.getElementById('footer-sub').textContent = t('siteSub');
    document.getElementById('footer-h-source').textContent = t('footerSource');
    document.getElementById('footer-h-about').textContent = t('footerAbout');
    document.getElementById('footer-about').textContent = t('footerAboutText');
    document.getElementById('footer').textContent =
      '© ' + new Date().getFullYear() + ' ' + t('siteTitle') + ' · ' + t('footerNote');
    document.title = t('seoTitle');
    updateSeoMeta();

    var detect = document.getElementById('detect-hint');
    if (state.override) {
      detect.textContent = '';
      detect.hidden = true;
    } else {
      detect.hidden = false;
      detect.textContent = t('detected');
    }

    var langSelect = document.getElementById('lang-select');
    if (langSelect) {
      langSelect.innerHTML = langOptionsHtml();
      langSelect.value = state.lang;
    }

    bindSearch();
    bindGridMore();
    document.querySelectorAll('.panel[data-rows]').forEach(applyCollapse);
    bindRankTabs();
    bindRankToggle();
    watchIconTimeouts();

    var topnav = document.getElementById('topnav');
    if (topnav) { topnav.innerHTML = topnavHtml(); bindTopnav(); }
    var bt = document.querySelector('.backtop');
    if (bt) { bt.setAttribute('aria-label', t('backTop')); bt.title = t('backTop'); }
    applyGlobalSearch();
    highlightNav();
  }

  function applyFilter(panel) {
    var q = panel.querySelector('.panel-search').value.trim().toLowerCase();
    var cat = panel.dataset.cat || 'all';
    var visible = 0;
    panel.querySelectorAll('.card').forEach(function (card) {
      var matchCat = cat === 'all' || card.dataset.cat === cat;
      var hay = card.textContent.toLowerCase();
      var matchQ = (!q || hay.indexOf(q) !== -1) && (!state.globalQ || hay.indexOf(state.globalQ) !== -1);
      var hit = matchCat && matchQ;
      card.hidden = !hit;
      if (hit) visible++;
    });
    panel.querySelector('.empty').hidden = visible !== 0;
    applyCollapse(panel);
  }

  function gridCols(grid) {
    var tpl = getComputedStyle(grid).gridTemplateColumns;
    if (!tpl || tpl === 'none') return 1;
    return tpl.split(' ').filter(function (x) { return x; }).length;
  }

  function applyCollapse(panel) {
    var rows = parseInt(panel.dataset.rows, 10);
    if (!rows) return;
    var grid = panel.querySelector('.grid');
    var more = panel.querySelector('.grid-more');
    var expanded = panel.dataset.expanded === '1';
    var shown = [];
    panel.querySelectorAll('.card').forEach(function (card) {
      if (!card.hidden) shown.push(card);
    });
    var limit = rows * gridCols(grid);
    shown.forEach(function (card, i) {
      card.classList.toggle('collapsed-hide', !expanded && i >= limit);
    });
    if (more) {
      var overflow = shown.length - limit;
      more.hidden = overflow <= 0;
      more.textContent = expanded ? t('rankLess') : t('rankMore') + ' (+' + Math.max(0, overflow) + ')';
    }
  }

  function bindGridMore() {
    document.querySelectorAll('.grid-more').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var panel = btn.closest('.panel');
        panel.dataset.expanded = panel.dataset.expanded === '1' ? '0' : '1';
        applyCollapse(panel);
      });
    });
  }

  function bindSearch() {
    document.querySelectorAll('.panel-search').forEach(function (input) {
      input.addEventListener('input', function () {
        applyFilter(document.getElementById(input.dataset.target));
      });
    });
    document.querySelectorAll('.panel .chips').forEach(function (bar) {
      bar.addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        var panel = chip.closest('.panel');
        panel.dataset.cat = chip.dataset.cat;
        panel.querySelectorAll('.chip').forEach(function (c) {
          c.classList.toggle('active', c === chip);
        });
        applyFilter(panel);
      });
    });
  }

  function setLang(lang, remember) {
    if (!isLang(lang)) return;
    if (remember) {
      state.override = lang;
      localStorage.setItem(STORAGE_KEY, lang);
      try {
        var u = new URL(location.href);
        u.searchParams.set('lang', lang);
        history.replaceState(null, '', u);
      } catch (e) {}
    }
    state.lang = lang;
    ensureLang(lang, render);
  }

  // --- IP region detection: race several APIs, first valid answer wins ---
  function fetchJson(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var ctl = new AbortController();
      var timer = setTimeout(function () { ctl.abort(); reject(new Error('timeout')); }, timeoutMs);
      fetch(url, { signal: ctl.signal })
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(function (d) { clearTimeout(timer); resolve(d); })
        .catch(function (e) { clearTimeout(timer); reject(e); });
    });
  }

  function detectRegion() {
    var sources = [
      { url: 'https://ipwho.is/', pick: function (d) { return d && d.success !== false && d.country_code; } },
      { url: 'https://api.ip.sb/geoip', pick: function (d) { return d && d.country_code; } },
      { url: 'https://get.geojs.io/v1/ip/geo.json', pick: function (d) { return d && d.country_code; } }
    ];
    return new Promise(function (resolve) {
      var pending = sources.length;
      var settled = false;
      sources.forEach(function (s) {
        fetchJson(s.url, 4000)
          .then(function (d) {
            if (settled) return;
            var code = s.pick(d);
            if (code) { settled = true; resolve(code.toUpperCase()); }
          })
          .catch(function () {})
          .finally(function () {
            pending--;
            if (!settled && pending === 0) {
              // All APIs failed: the browser language already decided the UI.
              settled = true;
              resolve(null);
            }
          });
      });
    });
  }

  // --- init ---
  var langSelect = document.getElementById('lang-select');
  if (langSelect) {
    langSelect.addEventListener('change', function () { setLang(langSelect.value, true); });
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      document.querySelectorAll('.panel[data-rows]').forEach(applyCollapse);
    }, 150);
  });

  function applyDetected() {
    var newLang = state.override || geoLang(state.geo) || navLang || 'en';
    if (newLang === state.lang) {
      // Language unchanged: refresh the hint only; a full re-render would wipe
      // any category/search state the user just applied.
      var detect = document.getElementById('detect-hint');
      if (!state.override) {
        detect.hidden = false;
        detect.textContent = t('detected');
      }
      return;
    }
    state.lang = newLang;
    ensureLang(newLang, render);
  }

  // Initial paint with a sensible default before detection returns.
  // An explicit ?lang= in the URL wins (crawlable, shareable language variants).
  var urlLang = null;
  try { urlLang = new URLSearchParams(location.search).get('lang'); } catch (e) {}
  if (!isLang(urlLang)) urlLang = null;

  var navLang = browserLang();
  if (urlLang) {
    state.lang = urlLang;
    state.override = urlLang;
  } else if (state.override && isLang(state.override)) {
    state.lang = state.override;
  } else {
    state.override = null;
    state.lang = navLang || 'en';
  }
  initScrollUi();
  ensureLang(state.lang, render);

  detectRegion().then(function (code) {
    state.geo = code;
    applyDetected();
  });
})();
