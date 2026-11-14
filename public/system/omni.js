// OMNI//GRID v2 shared behaviour: Telegram shell, API paths that survive the gateway prefix,
// haptics, glass light, icon draw-on, sheet, toast, number formatting, demo wallet.
(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // only treat the page as a Telegram WebApp when Telegram actually launched it
  const tg = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;

  // Pages live at /<prefix>/v2/ (gateway) or /v2/ (direct port); '../' always reaches the game's own root.
  const root = new URL('../', location.href);
  const api = async (path, body) => {
    const res = await fetch(new URL(path.replace(/^\//, ''), root), body === undefined
      ? { headers: { Accept: 'application/json' } }
      : { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON body */ }
    if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
    return data;
  };
  const wsUrl = () => root.href.replace(/^http/, 'ws');

  // optional live feed: never required for play (the gateway does not proxy upgrades)
  const live = onMessage => {
    let ws;
    try { ws = new WebSocket(wsUrl()); } catch (e) { return null; }
    ws.onmessage = e => { try { onMessage(JSON.parse(e.data)); } catch (err) { /* ignore */ } };
    ws.onerror = () => {};
    return ws;
  };

  const haptic = kind => {
    const h = tg && tg.HapticFeedback;
    if (h) {
      if (kind === 'gain' || kind === 'success') h.notificationOccurred('success');
      else if (kind === 'bust' || kind === 'error') h.notificationOccurred('error');
      else if (kind === 'select') h.selectionChanged();
      else h.impactOccurred(kind === 'heavy' ? 'heavy' : kind === 'medium' ? 'medium' : 'light');
    } else if (navigator.vibrate && !reduce) {
      navigator.vibrate(kind === 'bust' ? [30, 40, 30] : kind === 'gain' ? 18 : 8);
    }
  };

  const LAMPORTS = 1e9;
  const sol = (lamports, digits) => {
    const v = Number(lamports) / LAMPORTS;
    const d = digits != null ? digits : v !== 0 && Math.abs(v) < 0.01 ? 4 : v < 1 ? 3 : 2;
    return v.toFixed(d).replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');
  };
  const mult = x => `${Number(x).toFixed(2)}×`;
  const shortHash = (h, k) => { if (!h) return '—'; k = k || 6; return h.length <= k * 2 + 1 ? h : `${h.slice(0, k)}…${h.slice(-k)}`; };

  // demo wallet: 32 random bytes in base58, so it is a well-formed Solana address; never connected to funds
  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const base58 = bytes => {
    let n = 0n; for (const b of bytes) n = (n << 8n) + BigInt(b);
    let out = ''; while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
    for (const b of bytes) { if (b === 0) out = '1' + out; else break; }
    return out;
  };
  const demoWallet = () => {
    const key = 'omnigrid.demoWallet.v1';
    try { const saved = localStorage.getItem(key); if (saved) return saved; } catch (e) { /* storage blocked */ }
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const addr = base58(bytes);
    try { localStorage.setItem(key, addr); } catch (e) { /* storage blocked */ }
    return addr;
  };

  // glass light follows the finger or pointer
  const glassLight = scope => {
    (scope || document).addEventListener('pointermove', e => {
      const g = e.target.closest && e.target.closest('.og-glass');
      if (!g) return;
      const r = g.getBoundingClientRect();
      g.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      g.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    }, { passive: true });
  };

  // icons draw on, slowly, once
  const drawIcons = (scope, delay) => {
    if (reduce) return;
    const icons = (scope || document).querySelectorAll('.og-icon[data-draw]');
    icons.forEach((svg, i) => {
      const use = svg.querySelector('use');
      if (!use || !use.animate) return;
      use.style.strokeDasharray = '1';
      use.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 700, delay: (delay || 0) + i * 60, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' })
        .finished.then(() => { use.style.strokeDasharray = ''; }).catch(() => {});
    });
  };
  const icon = (name, extra) => `<svg class="og-icon${extra ? ' ' + extra : ''}" aria-hidden="true"><use href="system/icons.svg#i-${name}"/></svg>`;

  // a lens that glides between options (dock and segmented controls)
  const lens = (container, lensEl, selector) => {
    const place = (el, instant) => {
      if (!el) return;
      const c = container.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (instant) lensEl.style.transition = 'none';
      lensEl.style.width = `${r.width}px`;
      lensEl.style.transform = `translateX(${r.left - c.left}px)`;
      if (instant) { lensEl.getBoundingClientRect(); lensEl.style.transition = ''; }
    };
    const current = () => container.querySelector(`${selector}[aria-selected="true"], ${selector}[aria-current="true"]`);
    requestAnimationFrame(() => place(current(), true));
    addEventListener('resize', () => place(current(), true));
    return { move: el => place(el, false), sync: () => place(current(), true) };
  };

  // sheet
  const sheet = (sheetEl, scrimEl) => {
    let last = null;
    const open = () => {
      last = document.activeElement;
      sheetEl.classList.add('is-open'); scrimEl.classList.add('is-open');
      sheetEl.removeAttribute('inert'); sheetEl.setAttribute('aria-hidden', 'false');
      const f = sheetEl.querySelector('button, [href], input, textarea'); if (f) f.focus({ preventScroll: true });
      if (tg && tg.BackButton) tg.BackButton.show();
    };
    const close = () => {
      sheetEl.classList.remove('is-open'); scrimEl.classList.remove('is-open');
      sheetEl.setAttribute('inert', ''); sheetEl.setAttribute('aria-hidden', 'true');
      if (last && last.focus) last.focus({ preventScroll: true });
    };
    sheetEl.setAttribute('inert', ''); sheetEl.setAttribute('aria-hidden', 'true');
    scrimEl.addEventListener('click', close);
    addEventListener('keydown', e => { if (e.key === 'Escape' && sheetEl.classList.contains('is-open')) close(); });
    return { open, close, get isOpen() { return sheetEl.classList.contains('is-open'); } };
  };

  // toast
  let toastEl = null, toastTimer = 0;
  const toast = (message, tone) => {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'og-toast og-glass';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    const name = tone === 'gain' ? 'spark' : tone === 'bust' ? 'info' : 'check';
    toastEl.dataset.tone = tone || 'neutral';
    toastEl.innerHTML = `${icon(name)}<span></span>`;
    toastEl.querySelector('span').textContent = message;
    requestAnimationFrame(() => toastEl.classList.add('is-open'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-open'), 3200);
  };

  const copy = async text => {
    try { await navigator.clipboard.writeText(text); toast('Copied'); haptic('select'); }
    catch (e) { toast('Copy failed: select the text instead', 'bust'); }
  };

  // Telegram shell: expand, match colours, back button returns to the hub
  const telegram = opts => {
    if (!tg) return;
    try {
      tg.ready(); tg.expand();
      if (tg.setHeaderColor) tg.setHeaderColor('#070d1d');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#070d1d');
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      if (opts && opts.hub && tg.BackButton) {
        tg.BackButton.show();
        tg.BackButton.onClick(() => { location.href = opts.hub; });
      }
    } catch (e) { /* older clients */ }
  };

  window.Omni = { reduce, tg, api, wsUrl, live, haptic, sol, mult, shortHash, demoWallet, glassLight, drawIcons, icon, lens, sheet, toast, copy, telegram, LAMPORTS };
})();
