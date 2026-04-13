/* =====================================================
   TECHPULSE — app.js v4.0
   + Tradução automática para PT-BR (MyMemory API)
   + Ícone de hype + ordenação por engajamento
   ===================================================== */
'use strict';

/* ── Constants ──────────────────────────────────────── */
const HN_SEARCH  = 'https://hn.algolia.com/api/v1';
const HN_ITEMS   = 'https://hn.algolia.com/api/v1/items/';
const HN_DISCUSS = 'https://news.ycombinator.com/item?id=';
const TRANSLATE  = 'https://api.mymemory.translated.net/get';

/* ── Queries por categoria ──────────────────────────── */
const QUERIES = {
  ai: [
    'ChatGPT Claude Gemini LLM',
    'OpenAI Anthropic machine learning',
    'artificial intelligence GPT model',
    'deep learning neural network AI',
  ],
  game: [
    'Unity Unreal Godot game engine',
    'indie game development Steam',
    'game developer graphics rendering',
    'Nintendo PlayStation Xbox release',
  ],
  general: [
    'best practices programming',
    'productivity tools web',
    'open source projects weekend',
    'show hn useful tool',
  ],
};

const GENERAL_SURPRISE_QUERIES = [
  'architecture patterns design',
  'refactoring code smells',
  'linux terminal bash tips',
  'git advanced commands',
  'ui ux design principles',
  'career advice software engineer',
  'book recommendations programming',
  'system design algorithms',
  'docker kubernetes devops',
  'performance optimization web',
];

/* ── Metadados das categorias ───────────────────────── */
const CATS = {
  ai:      { label: 'Inteligência Artificial', icon: '🤖', cls: 'ai'    },
  game:    { label: 'Game Development',        icon: '🎮', cls: 'game'  },
  general: { label: 'Conhecimentos Úteis',     icon: '💡', cls: 'general' },
};

/* ── Níveis de hype (baseado em pontos + comentários HN) */
const HYPE_LEVELS = [
  { min: 1500, icon: '🔥', label: 'Viral',     cls: 'hype-viral'   },
  { min: 600,  icon: '⚡', label: 'Trending',  cls: 'hype-trending' },
  { min: 150,  icon: '📈', label: 'Em Alta',   cls: 'hype-rising'  },
  { min: 30,   icon: '💡', label: 'Relevante', cls: 'hype-notable' },
  { min: 0,    icon: '🆕', label: 'Novo',      cls: 'hype-new'     },
];

/* ── Estado ─────────────────────────────────────────── */
const state = {
  articles : { ai: [], game: [], general: [] },
  loading  : false,
};

/* ── Cache de traduções (localStorage, TTL 12h) ─────── */
const CACHE_KEY = 'tp_translations_v1';
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12h em ms

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(CACHE_KEY); return {}; }
    return data;
  } catch { return {}; }
}

function saveCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); }
  catch { /* quota exceeded — skip */ }
}

const translationCache = loadCache();

/* ── Hype Promotion Tracker (localStorage) ────────── */
const TRACKER_KEY = 'tp_hype_tracker_v1';
const DAYS_3      = 3 * 24 * 60 * 60 * 1000;
const DAYS_7      = 7 * 24 * 60 * 60 * 1000;

function loadTracker() {
  try { return JSON.parse(localStorage.getItem(TRACKER_KEY)) || {}; }
  catch { return {}; }
}

function saveTracker(data) {
  try { localStorage.setItem(TRACKER_KEY, JSON.stringify(data)); }
  catch { }
}

const hypeTracker = loadTracker();

function getPromotionStatus(article) {
  const id      = article.objectID;
  const entry   = hypeTracker[id];
  const score   = hypeScore(article);
  const now     = Date.now();

  // Se score >= 600 (Trending), registramos ou verificamos promoção
  if (score >= 600) {
    if (!entry) {
      hypeTracker[id] = { firstSeen: now, promotedAt: null };
      saveTracker(hypeTracker);
    } else if (!entry.promotedAt && (now - entry.firstSeen >= DAYS_3)) {
      entry.promotedAt = now;
      saveTracker(hypeTracker);
    }
  }

  // Verifica se está no período de "Hype" (1 semana após a promoção)
  if (entry && entry.promotedAt && (now - entry.promotedAt < DAYS_7)) {
    return true; // É Hype Especial
  }
  return false;
}

/* ── Cache de Notícias Anteriores ───────────────────── */
const PREV_CACHE_KEY = 'tp_prev_news_v1';
function loadPreviousCache() {
  try { return JSON.parse(localStorage.getItem(PREV_CACHE_KEY)) || { ai: [], game: [], general: [] }; }
  catch { return { ai: [], game: [], general: [] }; }
}
function savePreviousCache(data) {
  try { localStorage.setItem(PREV_CACHE_KEY, JSON.stringify(data)); }
  catch { }
}

/* ── DOM refs ───────────────────────────────────────── */
const el  = id => document.getElementById(id);

const dom = {
  dot        : el('statusDot'),
  status     : el('statusText'),
  refresh    : el('refreshBtn'),
  date       : el('headerDate'),
  ticker     : el('tickerTrack'),
  toast      : el('toast'),
  overlay    : el('modalOverlay'),
  modalClose : el('modalClose'),
  mCat       : el('modalCategory'),
  mImg       : el('modalImageWrapper'),
  mTitle     : el('modalTitle'),
  mSource    : el('modalSource'),
  mDate      : el('modalDate'),
  mBody      : el('modalBody'),
  mLink      : el('modalLink'),
  cardsAI      : el('cardsAI'),
  cardsGame    : el('cardsGame'),
  cardsGeneral : el('cardsGeneral'),
  cntAI        : el('countAI'),
  cntGame      : el('countGame'),
  cntGeneral   : el('countGeneral'),
  btnSurprise  : el('btnSurprise'),
};

/* ── Utilidades gerais ──────────────────────────────── */
function setStatus(type, text) {
  dom.dot.className      = `status-dot ${type}`;
  dom.status.textContent = text;
}

function toast(msg, ms = 4000) {
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  setTimeout(() => dom.toast.classList.remove('show'), ms);
}

function domain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return 'hackernews.com'; }
}

function ago(iso) {
  if (!iso) return '';
  const d = Math.floor((Date.now() - +new Date(iso)) / 1000);
  if (d < 120)     return 'agora mesmo';
  if (d < 3600)    return `${Math.floor(d/60)}m atrás`;
  if (d < 86400)   return `${Math.floor(d/3600)}h atrás`;
  if (d < 7*86400) return `${Math.floor(d/86400)}d atrás`;
  return new Date(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR',{
    day:'2-digit', month:'short', year:'numeric',
    hour:'2-digit', minute:'2-digit',
  });
}

function stripTags(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}

function dedupe(arr) {
  const seen = new Set();
  return arr.filter(a => {
    if (!a?.objectID) return false;
    if (seen.has(a.objectID)) return false;
    seen.add(a.objectID);
    return true;
  });
}

/* ── Cálculo de hype ────────────────────────────────── */
function hypeScore(article) {
  const pts = article.points       || 0;
  const cmt = article.num_comments || 0;
  // Pontos valem mais; comentários indicam discussão ativa
  return pts * 2 + cmt * 3;
}

function getHype(article) {
  if (getPromotionStatus(article)) {
    return { icon: '💎', label: 'Hype', cls: 'hype-special' };
  }
  const score = hypeScore(article);
  return HYPE_LEVELS.find(l => score >= l.min) || HYPE_LEVELS.at(-1);
}

/* ── Tradução via MyMemory API ──────────────────────── */
async function translateText(text) {
  if (!text || text.trim().length < 4) return text;

  // Verifica cache
  if (translationCache[text]) return translationCache[text];

  try {
    const url = `${TRANSLATE}?q=${encodeURIComponent(text.slice(0, 480))}&langpair=en|pt-BR`;
    const r   = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return text;
    const d   = await r.json();
    const out = d?.responseData?.translatedText;
    if (!out || d.responseStatus !== 200) return text;

    // Corrige artefatos comuns do MyMemory (MAIÚSCULAS excessivas)
    const clean = out.replace(/\bBRAZILIAN PORTUGUESE\b/gi, '')
                     .replace(/^TRANSLATED BY.*$/m, '')
                     .trim();

    if (clean.length > 3) {
      translationCache[text] = clean;
      saveCache(translationCache);
      return clean;
    }
  } catch { /* timeout ou erro — usa original */ }
  return text;
}

/* Traduz em lote com throttle para respeitar rate-limit */
async function translateBatch(articles) {
  const DELAY = 200; // ms entre requisições
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    if (!a._titlePT) {
      a._titlePT = await translateText(a.title || '');
      // Atualiza o card no DOM em tempo real
      const card = document.querySelector(`[data-hn-id="${a.objectID}"] .card-title`);
      if (card && a._titlePT !== a.title) card.textContent = a._titlePT;
    }
    if (i < articles.length - 1) await new Promise(r => setTimeout(r, DELAY));
  }
}

/* ── Fetch Algolia ──────────────────────────────────── */
async function hnQuery(q, byDate = true) {
  const ep  = byDate ? 'search_by_date' : 'search';
  const url  = `${HN_SEARCH}/${ep}?query=${encodeURIComponent(q)}`
              + `&tags=story&hitsPerPage=15&numericFilters=num_comments%3E2`;
  const r   = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`HN ${r.status}`);
  const d   = await r.json();
  return (d.hits || []).filter(h => h.title && h.url);
}

async function fetchCategory(key, customQueries = null) {
  const queriesToRun = customQueries || QUERIES[key];
  const settled = await Promise.allSettled(
    queriesToRun.flatMap(q => [ hnQuery(q, true), hnQuery(q, false) ])
  );
  const hits = settled
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  return dedupe(hits)
    .sort((a, b) => {
      const aHype = getPromotionStatus(a);
      const bHype = getPromotionStatus(b);
      if (aHype && !bHype) return -1;
      if (!aHype && bHype) return 1;
      return hypeScore(b) - hypeScore(a);
    })
    .slice(0, 20);
}

/* ── Fetch principal ────────────────────────────────── */
async function fetchAll() {
  if (state.loading) return;
  state.loading = true;
  dom.refresh.classList.add('loading');
  setStatus('loading', 'Buscando últimas notícias…');

  showSkeleton(dom.cardsAI);
  showSkeleton(dom.cardsGame);
  showSkeleton(dom.cardsGeneral);

  try {
    let [ai, game, general] = await Promise.all([
      fetchCategory('ai'),
      fetchCategory('game'),
      fetchCategory('general'),
    ]);

    const prevCache = loadPreviousCache();

    if (ai.length === 0 && prevCache.ai && prevCache.ai.length > 0) {
      ai = prevCache.ai.map(a => ({...a, _isPrevious: true}));
    } else if (ai.length > 0) {
      prevCache.ai = ai.map(a => ({...a, _isPrevious: false}));
    }

    if (game.length === 0 && prevCache.game && prevCache.game.length > 0) {
      game = prevCache.game.map(a => ({...a, _isPrevious: true}));
    } else if (game.length > 0) {
      prevCache.game = game.map(a => ({...a, _isPrevious: false}));
    }

    if (general.length === 0 && prevCache.general && prevCache.general.length > 0) {
      general = prevCache.general.map(a => ({...a, _isPrevious: true}));
    } else if (general.length > 0) {
      prevCache.general = general.map(a => ({...a, _isPrevious: false}));
    }

    savePreviousCache(prevCache);

    state.articles.ai      = ai;
    state.articles.game    = game;
    state.articles.general = general;

    renderAll();
    buildTicker();

    const total = ai.length + game.length + general.length;
    const time  = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    setStatus('success', `Atualizado às ${time} · ${total} artigos · traduzindo…`);
    toast(`✅ ${total} artigos carregados! Traduzindo títulos…`);

    // Traduz em background sem bloquear a UI
    Promise.all([
      translateBatch(state.articles.ai),
      translateBatch(state.articles.game),
      translateBatch(state.articles.general),
    ]).then(() => {
      buildTicker(); // atualiza ticker com títulos traduzidos
      setStatus('success', `Atualizado às ${time} · ${total} artigos · PT-BR ✓`);
    });

  } catch (err) {
    console.error('[TechPulse]', err);
    setStatus('error', 'Erro ao buscar notícias. Tente novamente.');
    toast('❌ Falha ao buscar notícias.');
    showError();
  } finally {
    state.loading = false;
    dom.refresh.classList.remove('loading');
  }
}

/* ── Skeleton ───────────────────────────────────────── */
function showSkeleton(container) {
  container.innerHTML = Array(5).fill('<div class="skeleton-card"></div>').join('');
}

/* ── Construir card com DOM API (Garante estrutura limpa e sem textos soltos) ── */
function buildCard(article, catKey) {
  const card = document.createElement('article');
  card.className = 'news-card';
  card.tabIndex  = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('data-hn-id', article.objectID);

  const src   = domain(article.url);
  const hype  = getHype(article);
  const score = hypeScore(article);

  // 1. Top Section (Source + Time)
  const top = document.createElement('div');
  top.className = 'card-top';

  if (article._isPrevious) {
    card.classList.add('is-previous');
    const oldBadge = document.createElement('span');
    oldBadge.className = 'card-previous-badge';
    oldBadge.textContent = '⏱️ Anterior';
    oldBadge.title = 'Mostrando notícia de buscas passadas pois não foram encontradas novas agora.';
    top.appendChild(oldBadge);
  }
  
  const tag = document.createElement('span');
  tag.className = 'card-source-tag';
  tag.textContent = String(src).trim();
  
  const timeEl = document.createElement('span');
  timeEl.className = 'card-time';
  timeEl.textContent = String(ago(article.created_at)).trim();
  
  top.appendChild(tag);
  top.appendChild(timeEl);

  // 2. Hype Badge
  const badge = document.createElement('div'); // Contêiner para isolar o badge
  badge.className = 'card-badge-container';
  const badgeInner = document.createElement('span');
  badgeInner.className = `hype-badge ${hype.cls}`;
  badgeInner.title = `Hype score: ${score}`;
  badgeInner.textContent = `${hype.icon} ${hype.label}`;
  badge.appendChild(badgeInner);

  // 3. Middle Section wrapper (Title + Desc)
  const bodyWrapper = document.createElement('div');
  bodyWrapper.className = 'card-body-wrapper';

  const h3 = document.createElement('h3');
  h3.className = 'card-title';
  h3.textContent = (article._titlePT || article.title || 'Sem título').trim();

  const desc = document.createElement('p');
  desc.className = 'card-desc';
  desc.textContent = `Compartilhado no HN por ${article.author}. Clique para ver a fonte original em ${src}.`.trim();

  bodyWrapper.appendChild(h3);
  bodyWrapper.appendChild(desc);

  // 4. Footer Section
  const footer = document.createElement('div');
  footer.className = 'card-footer';
  
  const metaEl = document.createElement('span');
  metaEl.className = 'card-meta';
  metaEl.textContent = [
    article.points ? `▲ ${article.points}` : '',
    article.num_comments ? `💬 ${article.num_comments}` : ''
  ].filter(Boolean).join('  ').trim();
  
  const readEl = document.createElement('span');
  readEl.className = 'card-read-btn';
  readEl.textContent = 'Ler mais ›';
  
  footer.appendChild(metaEl);
  footer.appendChild(readEl);

  // Append all in order
  card.appendChild(top);
  card.appendChild(badge);
  card.appendChild(bodyWrapper);
  card.appendChild(footer);

  card.addEventListener('click', () => openModal(article, catKey));
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(article, catKey); });
  
  return card;
}

/* ── Renderizar todas as colunas ─────────────────────── */
function renderAll() {
  renderColumn('ai',      dom.cardsAI,      dom.cntAI);
  renderColumn('game',    dom.cardsGame,    dom.cntGame);
  renderColumn('general', dom.cardsGeneral, dom.cntGeneral);
}

function renderColumn(key, container, counter) {
  const articles = state.articles[key];
  counter.textContent = articles.length;
  container.innerHTML = '';

  if (!articles.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <p>Nenhuma notícia encontrada.<br>Tente atualizar.</p>
      </div>`;
    return;
  }

  const frag = document.createDocumentFragment();
  articles.forEach((a, i) => {
    const card = buildCard(a, key);
    card.style.animationDelay = `${i * 40}ms`;
    frag.appendChild(card);
  });
  container.appendChild(frag);
}

function showError() {
  [dom.cardsAI, dom.cardsGame, dom.cardsGeneral].forEach(c => {
    c.innerHTML = `
      <div class="error-state">
        <div class="error-state-icon">⚠️</div>
        <p>Não foi possível carregar.<br>Verifique sua conexão.</p>
      </div>`;
  });
}

/* ── Ticker ─────────────────────────────────────────── */
function buildTicker() {
  const items = [
    ...state.articles.ai.slice(0,5).map(a      => `🤖 ${a._titlePT || a.title}`),
    ...state.articles.game.slice(0,5).map(a    => `🎮 ${a._titlePT || a.title}`),
    ...state.articles.general.slice(0,5).map(a => `💡 ${a._titlePT || a.title}`),
  ].filter(Boolean);
  if (!items.length) return;
  const doubled = [...items, ...items];
  dom.ticker.innerHTML = doubled
    .map(t => `<span class="ticker-item">${t.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span>`)
    .join('');
}

/* ── Modal ──────────────────────────────────────────── */
async function openModal(article, catKey) {
  const cat   = CATS[catKey];
  const hype  = getHype(article);
  const score = hypeScore(article);

  dom.mCat.className   = `modal-category-tag ${cat.cls}`;
  dom.mCat.textContent = `${cat.icon} ${cat.label}`;
  dom.mImg.innerHTML   = '';

  // Usa título já traduzido se disponível
  dom.mTitle.textContent  = article._titlePT || article.title || 'Sem título';
  dom.mSource.textContent = domain(article.url);
  dom.mDate.textContent   = fmtDate(article.created_at);
  dom.mLink.href          = article.url || HN_DISCUSS + article.objectID;
  dom.mLink.textContent   = 'Ler artigo completo →';

  // Hype indicator no modal
  let hypeEl = document.getElementById('modalHype');
  if (!hypeEl) {
    hypeEl = document.createElement('div');
    hypeEl.id = 'modalHype';
    hypeEl.className = 'modal-hype-bar';
    dom.mTitle.insertAdjacentElement('afterend', hypeEl);
  }
  hypeEl.innerHTML = `
    <span class="hype-badge ${hype.cls}">${hype.icon} ${hype.label}</span>
    <span class="modal-hype-score">Score: ${score} · ▲ ${article.points||0} pontos · 💬 ${article.num_comments||0} comentários</span>
  `;

  // Botão de discussão HN
  let hnBtn = document.getElementById('modalHNLink');
  if (!hnBtn) {
    hnBtn = document.createElement('a');
    hnBtn.id = 'modalHNLink';
    hnBtn.target = '_blank';
    hnBtn.rel    = 'noopener noreferrer';
    hnBtn.className = 'modal-link modal-link-secondary';
    dom.mLink.insertAdjacentElement('afterend', hnBtn);
  }
  hnBtn.href        = HN_DISCUSS + article.objectID;
  hnBtn.textContent = `💬 ${article.num_comments||0} comentários no HN`;

  // Corpo inicial
  dom.mBody.innerHTML = `<p class="modal-translating">⏳ Carregando conteúdo e traduzindo…</p>`;

  dom.overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Busca texto completo do item HN + traduz
  try {
    const r    = await fetch(HN_ITEMS + article.objectID, { signal: AbortSignal.timeout(6000) });
    const data = await r.json();
    const rawText = stripTags(data.text || '');

    let bodyText = rawText;
    if (rawText && rawText.length > 10) {
      // Traduz o texto completo (limitado a 480 chars por requisição)
      const chunks  = chunkText(rawText, 450);
      const translated = await Promise.all(chunks.map(translateText));
      bodyText = translated.join(' ');
    }

    if (bodyText && bodyText.length > 10) {
      dom.mBody.innerHTML = bodyText
        .split(/(?<=[.!?])\s{2,}|\n{2,}/)
        .filter(p => p.trim().length > 8)
        .slice(0, 10)
        .map(p => `<p>${p.trim().replace(/&/g,'&amp;').replace(/</g,'&lt;')}</p>`)
        .join('');
    } else {
      dom.mBody.innerHTML = buildDefaultBody(article);
    }
  } catch {
    dom.mBody.innerHTML = buildDefaultBody(article);
  }
}

function chunkText(text, maxLen) {
  const words   = text.split(' ');
  const chunks  = [];
  let   current = '';
  for (const word of words) {
    if ((current + ' ' + word).length > maxLen) {
      if (current) chunks.push(current.trim());
      current = word;
    } else {
      current += (current ? ' ' : '') + word;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

function buildDefaultBody(a) {
  const src = domain(a.url);
  return `
    <p>Esta notícia foi compartilhada no Hacker News por <strong>${a.author || 'um membro'}</strong> e gerou <strong>${a.num_comments||0} comentários</strong> na comunidade.</p>
    <p>Fonte original: <em>${src}</em></p>
    ${a.points ? `<p>▲ <strong>${a.points} pontos</strong> de engajamento na comunidade Hacker News.</p>` : ''}
    <p>Clique em <strong>"Ler artigo completo"</strong> para acessar o conteúdo na fonte original, ou em <strong>"comentários no HN"</strong> para ver a discussão.</p>
  `;
}

function closeModal() {
  dom.overlay.classList.remove('open');
  document.body.style.overflow = '';
}

dom.modalClose.addEventListener('click', closeModal);
dom.overlay.addEventListener('click', e => { if (e.target === dom.overlay) closeModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && dom.overlay.classList.contains('open')) closeModal();
});

/* ── Botão Atualizar ────────────────────────────────── */
dom.refresh.addEventListener('click', () => { if (!state.loading) fetchAll(); });

/* ── Botão Surpreenda-me ────────────────────────────── */
dom.btnSurprise.addEventListener('click', async () => {
  if (state.loading) return;
  state.loading = true;
  dom.refresh.classList.add('loading');
  dom.btnSurprise.textContent = '…';
  setStatus('loading', 'Buscando surpresas gerais…');

  showSkeleton(dom.cardsGeneral);

  try {
    // Escolhe 3-4 queries aleatórias do arsenal
    const shuffled = [...GENERAL_SURPRISE_QUERIES].sort(() => 0.5 - Math.random());
    const randomQueries = shuffled.slice(0, 4);

    let general = await fetchCategory('general', randomQueries);

    const prevCache = loadPreviousCache();
    if (general.length === 0 && prevCache.general && prevCache.general.length > 0) {
      general = prevCache.general.map(a => ({...a, _isPrevious: true}));
    } else if (general.length > 0) {
      prevCache.general = general.map(a => ({...a, _isPrevious: false}));
      savePreviousCache(prevCache);
    }

    state.articles.general = general;
    renderColumn('general', dom.cardsGeneral, dom.cntGeneral);
    buildTicker();

    const time = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    setStatus('success', `Surpresa carregada às ${time}`);
    toast(`✅ Conhecimentos Úteis atualizados! Traduzindo…`);

    await translateBatch(state.articles.general);
    buildTicker();
    renderColumn('general', dom.cardsGeneral, dom.cntGeneral); // re-render para atualizar com a tradução

  } catch (err) {
    console.error('[TechPulse Surprise]', err);
    dom.cardsGeneral.innerHTML = `
      <div class="error-state">
        <div class="error-state-icon">⚠️</div>
        <p>Não foi possível buscar as surpresas.</p>
      </div>`;
    toast('❌ Falha na surpresa.');
  } finally {
    state.loading = false;
    dom.refresh.classList.remove('loading');
    dom.btnSurprise.textContent = '?';
  }
});

/* ── Auto-refresh a cada 15 min ─────────────────────── */
setInterval(fetchAll, 15 * 60 * 1000);

/* ── Data no header ─────────────────────────────────── */
dom.date.textContent = new Date().toLocaleDateString('pt-BR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

/* ── Background Music ────────────────────────────────── */
(function initMusic() {
  const audio     = document.getElementById('bgMusic');
  const toggleBtn = document.getElementById('musicToggle');
  const icon      = document.getElementById('musicIcon');
  if (!audio || !toggleBtn) return;

  audio.volume = 0.3;

  function updateIcon(playing) {
    icon.textContent = playing ? '🔊' : '🔇';
    toggleBtn.classList.toggle('playing', playing);
  }

  toggleBtn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().then(() => {
        updateIcon(true);
        localStorage.setItem('tp_music', 'on');
      }).catch(() => {});
    } else {
      audio.pause();
      updateIcon(false);
      localStorage.setItem('tp_music', 'off');
    }
  });

  // Tenta auto-play se o usuário já habilitou antes
  if (localStorage.getItem('tp_music') === 'on') {
    audio.play().then(() => updateIcon(true)).catch(() => {});
  }
})();

/* ── Boot ────────────────────────────────────────────── */
fetchAll();

/* ── Background Particles (Blue upward floating effect) ── */
(function initParticles() {
  const canvas = document.getElementById('bg-particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  let particles = [];
  const particleCount = 60;
  
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  
  window.addEventListener('resize', resize);
  resize();
  
  class Particle {
    constructor() {
      this.init();
    }
    
    init() {
      this.x      = Math.random() * canvas.width;
      this.y      = canvas.height + Math.random() * 100;
      this.size   = Math.random() * 2 + 0.5;
      this.speedY = Math.random() * 0.8 + 0.2;
      this.opacity = Math.random() * 0.5 + 0.1;
      // Shades of blue
      const blueShades = ['#3b82f6', '#60a5fa', '#93c5fd'];
      this.color = blueShades[Math.floor(Math.random() * blueShades.length)];
    }
    
    update() {
      this.y -= this.speedY;
      // Reset if off top
      if (this.y < -10) {
        this.init();
      }
    }
    
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = this.opacity;
      ctx.fill();
    }
  }
  
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }
  
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Batch drawing for performance
    for (const p of particles) {
      p.update();
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(animate);
  }
  
  requestAnimationFrame(animate);
})();

