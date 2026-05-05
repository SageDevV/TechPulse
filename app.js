/* =====================================================
   TECHPULSE — app.js v5.0
   + Tradução automática para PT-BR (MyMemory API)
   + Apenas notícias do dia
   ===================================================== */
'use strict';

/* ── Constants ──────────────────────────────────────── */
const HN_SEARCH  = 'https://hn.algolia.com/api/v1';
const HN_ITEMS   = 'https://hn.algolia.com/api/v1/items/';
const HN_DISCUSS = 'https://news.ycombinator.com/item?id=';
const TRANSLATE  = 'https://api.mymemory.translated.net/get';
const DEVTO_API  = 'https://dev.to/api/articles';
const LOBSTERS   = 'https://lobste.rs';
const REDDIT     = 'https://www.reddit.com';

/* ── Queries HN por categoria (expandidas) ─────────── */
const QUERIES = {
  ai: [
    'ChatGPT Claude Gemini LLM',
    'OpenAI Anthropic machine learning',
    'artificial intelligence GPT model',
    'deep learning neural network AI',
    'transformer attention model',
    'AI agent autonomous',
    'copilot code assistant AI',
    'stable diffusion midjourney image generation',
    'llama mistral open source model',
    'NLP natural language processing',
    'computer vision object detection',
    'reinforcement learning robotics',
  ],
  game: [
    'Unity Unreal Godot game engine',
    'indie game development Steam',
    'game developer graphics rendering',
    'Nintendo PlayStation Xbox release',
    'game jam itch.io',
    'shader graphics GPU game',
    'procedural generation roguelike',
    'VR AR virtual reality game',
    'game design mechanics gameplay',
    'pixel art 2D platformer',
    'multiplayer networking game',
    'Blender 3D modeling animation',
  ],
  cyber: [
    'cybersecurity hacking infosec',
    'malware ransomware vulnerability',
    'zero-day exploit patch',
    'reverse engineering cryptography',
    'data breach leak privacy',
    'phishing social engineering',
    'network security firewall',
    'penetration testing pentest',
    'defcon blackhat conference',
    'linux kernel exploit',
    'OWASP web security',
    'cloud security IAM',
  ],
};



/* ── Subreddits por categoria ──────────────────────── */
const REDDIT_SUBS = {
  ai: [
    'artificial', 'MachineLearning', 'ChatGPT',
    'LocalLLaMA', 'singularity', 'deeplearning',
  ],
  game: [
    'gamedev', 'indiegaming', 'Unity3D',
    'unrealengine', 'godot', 'gameassets',
  ],
  cyber: [
    'cybersecurity', 'netsec', 'hacking',
    'ReverseEngineering', 'AskNetsec', 'malware',
  ],
};

/* ── Tags Dev.to por categoria ─────────────────────── */
const DEVTO_TAGS = {
  ai:      ['ai', 'machinelearning', 'deeplearning', 'chatgpt'],
  game:    ['gamedev', 'unity', 'godot', 'indiedev'],
  cyber:   ['security', 'cybersecurity', 'infosec', 'hacking'],
};

/* ── Tags Lobsters por categoria ───────────────────── */
const LOBSTERS_TAGS = {
  ai:      ['ai', 'ml'],
  game:    ['games'],
};

/* ── Metadados das categorias ───────────────────────── */
const CATS = {
  ai:      { label: 'Inteligência Artificial', icon: '🤖', cls: 'ai'    },
  game:    { label: 'Game Development',        icon: '🎮', cls: 'game'  },
  cyber:   { label: 'Cyber Segurança',         icon: '🛡️', cls: 'cyber' },
};

/* ── Filtro de data (apenas notícias do dia) ──────── */
function isToday(isoDate) {
  if (!isoDate) return false;
  const articleDate = new Date(isoDate);
  const now = new Date();
  return articleDate.getFullYear() === now.getFullYear()
      && articleDate.getMonth()    === now.getMonth()
      && articleDate.getDate()     === now.getDate();
}

/* Verifica se a data está dentro das últimas X horas */
function isRecent(isoDate, hours) {
  if (!isoDate) return false;
  const articleDate = new Date(isoDate);
  const now = new Date();
  const diffHours = (now - articleDate) / (1000 * 60 * 60);
  return diffHours >= 0 && diffHours <= hours;
}

/* ── Estado ─────────────────────────────────────────── */
const state = {
  articles : { ai: [], game: [], cyber: [] },
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
  cardsCyber   : el('cardsCyber'),
  cntAI        : el('countAI'),
  cntGame      : el('countGame'),
  cntCyber     : el('countCyber'),
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
    // Dedupe por título normalizado para evitar mesma notícia de fontes diferentes
    const key = a.objectID;
    const titleKey = (a.title || '').toLowerCase().trim().slice(0, 60);
    if (seen.has(key) || seen.has(titleKey)) return false;
    seen.add(key);
    if (titleKey.length > 10) seen.add(titleKey);
    return true;
  });
}

/* ── Pontuação para ordenação ────────────────────────── */
function engagementScore(article) {
  const pts = article.points       || 0;
  const cmt = article.num_comments || 0;
  return pts * 2 + cmt * 3;
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

/* ── Fetch Hacker News (Algolia API) ─────────────────── */
async function hnQuery(q, byDate = true) {
  const ep  = byDate ? 'search_by_date' : 'search';
  const url = `${HN_SEARCH}/${ep}?query=${encodeURIComponent(q)}`
            + `&tags=story&hitsPerPage=20&numericFilters=num_comments%3E0`;
  const r   = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`HN ${r.status}`);
  const d   = await r.json();
  return (d.hits || []).filter(h => h.title && h.url);
}

/* ── Fetch Reddit (JSON API, sem autenticação) ──────── */
async function redditFetch(subreddit) {
  try {
    const url = `${REDDIT}/r/${subreddit}/hot.json?limit=20&raw_json=1`;
    const r   = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const d   = await r.json();
    return (d?.data?.children || [])
      .map(c => c.data)
      .filter(p => !p.stickied && !p.is_self && p.url && p.title)
      .map(p => ({
        objectID    : `reddit_${p.id}`,
        title       : p.title,
        url         : p.url,
        created_at  : new Date(p.created_utc * 1000).toISOString(),
        author      : p.author,
        points      : p.score || 0,
        num_comments: p.num_comments || 0,
        _source     : 'reddit.com',
        _sourceIcon : '🔴',
        _discussUrl : `https://reddit.com${p.permalink}`,
      }));
  } catch { return []; }
}

/* ── Fetch Dev.to (API pública) ──────────────────────── */
async function devtoFetch(tag) {
  try {
    const url = `${DEVTO_API}?tag=${tag}&top=1&per_page=15`;
    const r   = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const articles = await r.json();
    return (articles || [])
      .filter(a => a.title && a.url)
      .map(a => ({
        objectID    : `devto_${a.id}`,
        title       : a.title,
        url         : a.url,
        created_at  : a.published_at || a.created_at,
        author      : a.user?.name || a.user?.username || 'dev.to',
        points      : a.public_reactions_count || 0,
        num_comments: a.comments_count || 0,
        _source     : 'dev.to',
        _sourceIcon : '📝',
        _discussUrl : a.url,
      }));
  } catch { return []; }
}

/* ── Fetch Lobste.rs (JSON feed) ─────────────────────── */
async function lobstersFetch(tag) {
  try {
    const url = `${LOBSTERS}/t/${tag}.json`;
    const r   = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return [];
    const articles = await r.json();
    return (articles || [])
      .filter(a => a.title && a.url)
      .map(a => ({
        objectID    : `lob_${a.short_id}`,
        title       : a.title,
        url         : a.url,
        created_at  : a.created_at,
        author      : a.submitter_user?.username || 'lobste.rs',
        points      : a.score || 0,
        num_comments: a.comment_count || 0,
        _source     : 'lobste.rs',
        _sourceIcon : '🦞',
        _discussUrl : `${LOBSTERS}/s/${a.short_id}`,
      }));
  } catch { return []; }
}

/* ── Fetch combinado de todas as fontes por categoria ── */
async function fetchCategory(key, customQueries = null) {
  const queriesToRun = customQueries || QUERIES[key];

  // 1. Hacker News (várias queries em paralelo)
  const hnPromises = queriesToRun.flatMap(q => [hnQuery(q, true), hnQuery(q, false)]);

  // 2. Reddit (múltiplos subreddits)
  const redditPromises = (REDDIT_SUBS[key] || []).map(sub => redditFetch(sub));

  // 3. Dev.to (múltiplas tags)
  const devtoPromises = (DEVTO_TAGS[key] || []).map(tag => devtoFetch(tag));

  const settled = await Promise.allSettled([
    ...hnPromises,
    ...redditPromises,
    ...devtoPromises,
  ]);

  const hits = settled
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  const deduped = dedupe(hits);
  
  // Tenta filtrar por hoje primeiro (Política Principal)
  let filtered = deduped.filter(a => isToday(a.created_at));

  // Se não encontrar nada de hoje, tenta as últimas 6 horas (Política de Contingência)
  if (filtered.length === 0) {
    filtered = deduped.filter(a => isRecent(a.created_at, 6));
    if (filtered.length > 0) {
      console.log(`[TechPulse] Contingência ativada para ${key}: exibindo registros das últimas 6h.`);
    }
  }

  return filtered
    .sort((a, b) => engagementScore(b) - engagementScore(a))
    .slice(0, 25);
}

/* ── Fetch principal ────────────────────────────────── */
async function fetchAll() {
  if (state.loading) return;
  state.loading = true;
  dom.refresh.classList.add('loading');
  setStatus('loading', 'Buscando notícias de hoje…');

  showSkeleton(dom.cardsAI);
  showSkeleton(dom.cardsGame);
  showSkeleton(dom.cardsCyber);

  try {
    const [ai, game, cyber] = await Promise.all([
      fetchCategory('ai'),
      fetchCategory('game'),
      fetchCategory('cyber'),
    ]);

    state.articles.ai      = ai;
    state.articles.game    = game;
    state.articles.cyber   = cyber;

    renderAll();
    buildTicker();

    const total = ai.length + game.length + cyber.length;
    const time  = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    setStatus('success', `Atualizado às ${time} · ${total} artigos · traduzindo…`);
    toast(`✅ ${total} artigos carregados! Traduzindo títulos…`);

    // Traduz em background sem bloquear a UI
    Promise.all([
      translateBatch(state.articles.ai),
      translateBatch(state.articles.game),
      translateBatch(state.articles.cyber),
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

/* ── Construir card com DOM API ──────────────────────── */
function buildCard(article, catKey) {
  const card = document.createElement('article');
  card.className = 'news-card';
  card.tabIndex  = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('data-hn-id', article.objectID);

  const src = domain(article.url);

  // 1. Top Section (Source + Time)
  const top = document.createElement('div');
  top.className = 'card-top';

  const tag = document.createElement('span');
  tag.className = 'card-source-tag';
  const sourceName = article._source || domain(article.url);
  const sourceIcon = article._sourceIcon || '🟠';
  tag.textContent = `${sourceIcon} ${sourceName}`;
  
  const timeEl = document.createElement('span');
  timeEl.className = 'card-time';
  timeEl.textContent = String(ago(article.created_at)).trim();
  
  top.appendChild(tag);
  top.appendChild(timeEl);

  // 3. Middle Section wrapper (Title + Desc)
  const bodyWrapper = document.createElement('div');
  bodyWrapper.className = 'card-body-wrapper';

  const h3 = document.createElement('h3');
  h3.className = 'card-title';
  h3.textContent = (article._titlePT || article.title || 'Sem título').trim();

  const desc = document.createElement('p');
  desc.className = 'card-desc';
  const srcLabel = article._source || 'Hacker News';
  desc.textContent = `Via ${srcLabel} por ${article.author}. Fonte: ${src}.`.trim();

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
  renderColumn('cyber',   dom.cardsCyber,   dom.cntCyber);
}

function renderColumn(key, container, counter) {
  const articles = state.articles[key];
  counter.textContent = articles.length;
  container.innerHTML = '';

  if (!articles.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <p>Sem notícias recentes nesta categoria.</p>
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
  [dom.cardsAI, dom.cardsGame, dom.cardsCyber].forEach(c => {
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
    ...state.articles.cyber.slice(0,5).map(a   => `🛡️ ${a._titlePT || a.title}`),
  ].filter(Boolean);
  if (!items.length) return;
  const doubled = [...items, ...items];
  dom.ticker.innerHTML = doubled
    .map(t => `<span class="ticker-item">${t.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span>`)
    .join('');
}

/* ── Modal ──────────────────────────────────────────── */
async function openModal(article, catKey) {
  const cat = CATS[catKey];

  dom.mCat.className   = `modal-category-tag ${cat.cls}`;
  dom.mCat.textContent = `${cat.icon} ${cat.label}`;
  dom.mImg.innerHTML   = '';

  // Usa título já traduzido se disponível
  dom.mTitle.textContent  = article._titlePT || article.title || 'Sem título';
  dom.mSource.textContent = domain(article.url);
  dom.mDate.textContent   = fmtDate(article.created_at);
  dom.mLink.href          = article.url || HN_DISCUSS + article.objectID;
  dom.mLink.textContent   = 'Ler artigo completo →';

  // Stats bar no modal (sem classificação)
  let statsEl = document.getElementById('modalStats');
  if (!statsEl) {
    statsEl = document.createElement('div');
    statsEl.id = 'modalStats';
    statsEl.className = 'modal-stats-bar';
    dom.mTitle.insertAdjacentElement('afterend', statsEl);
  }
  statsEl.innerHTML = `
    <span class="modal-stats-score">▲ ${article.points||0} pontos · 💬 ${article.num_comments||0} comentários</span>
  `;

  // Botão de discussão (adapta para a fonte)
  const discussUrl = article._discussUrl || (HN_DISCUSS + article.objectID);
  const discussLabel = article._source
    ? `💬 ${article.num_comments||0} comentários em ${article._source}`
    : `💬 ${article.num_comments||0} comentários no HN`;
  let discussBtn = document.getElementById('modalDiscussLink');
  if (!discussBtn) {
    discussBtn = document.createElement('a');
    discussBtn.id = 'modalDiscussLink';
    discussBtn.target = '_blank';
    discussBtn.rel    = 'noopener noreferrer';
    discussBtn.className = 'modal-link modal-link-secondary';
    dom.mLink.insertAdjacentElement('afterend', discussBtn);
  }
  discussBtn.href        = discussUrl;
  discussBtn.textContent = discussLabel;

  // Corpo inicial
  dom.mBody.innerHTML = `<p class="modal-translating">⏳ Carregando conteúdo e traduzindo…</p>`;

  dom.overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Busca texto completo — somente para artigos do HN
  const isHN = !article._source;
  if (isHN) {
    try {
      const r    = await fetch(HN_ITEMS + article.objectID, { signal: AbortSignal.timeout(6000) });
      const data = await r.json();
      const rawText = stripTags(data.text || '');

      let bodyText = rawText;
      if (rawText && rawText.length > 10) {
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
  } else {
    // Para fontes não-HN, mostra corpo padrão diretamente
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
  const platform = a._source || 'Hacker News';
  return `
    <p>Esta notícia foi compartilhada em <strong>${platform}</strong> por <strong>${a.author || 'um membro'}</strong> e gerou <strong>${a.num_comments||0} comentários</strong> na comunidade.</p>
    <p>Fonte original: <em>${src}</em></p>
    ${a.points ? `<p>▲ <strong>${a.points} pontos</strong> de engajamento na comunidade.</p>` : ''}
    <p>Clique em <strong>"Ler artigo completo"</strong> para acessar o conteúdo na fonte original, ou no botão de <strong>"comentários"</strong> para ver a discussão.</p>
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

