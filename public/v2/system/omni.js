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
      if (tg.setHeaderColor) tg.setHeaderColor('#0a0c0a');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#0a0c0a');
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      if (opts && opts.hub && tg.BackButton) {
        tg.BackButton.show();
        tg.BackButton.onClick(() => { location.href = opts.hub; });
      }
    } catch (e) { /* older clients */ }
  };

  // 3D icons: shaded objects lit from the top left. Each call gets its own gradient ids.
  let uid = 0;
  const ICON3D = {
    gem: p => `<defs><linearGradient id="${p}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9f7c9"/><stop offset="1" stop-color="#9fd26a"/></linearGradient><linearGradient id="${p}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cb84f"/><stop offset="1" stop-color="#2c4d20"/></linearGradient></defs>
      <path d="M7 4h10l4 5.5H3z" fill="url(#${p}a)"/><path d="M3 9.5h18L12 21z" fill="url(#${p}b)"/><path d="M8.5 9.5 12 21l3.5-11.5z" fill="#5d9442"/><path d="M7 4l1.5 5.5L12 4zM17 4l-1.5 5.5L12 4z" fill="#f6ffe4" opacity=".7"/><path d="M5 6.5 7.5 5" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".9"/>`,
    mine: p => `<defs><radialGradient id="${p}a" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ffb199"/><stop offset=".45" stop-color="#ef6a4c"/><stop offset="1" stop-color="#5a1d10"/></radialGradient><linearGradient id="${p}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfc8b6"/><stop offset="1" stop-color="#5b574c"/></linearGradient></defs>
      <g fill="url(#${p}b)"><rect x="11" y="1.5" width="2" height="5" rx="1"/><rect x="11" y="17.5" width="2" height="5" rx="1"/><rect x="1.5" y="11" width="5" height="2" rx="1"/><rect x="17.5" y="11" width="5" height="2" rx="1"/><rect x="4" y="4.6" width="2" height="4.6" rx="1" transform="rotate(-45 5 6.9)"/><rect x="18" y="14.8" width="2" height="4.6" rx="1" transform="rotate(-45 19 17.1)"/><rect x="4" y="14.8" width="2" height="4.6" rx="1" transform="rotate(45 5 17.1)"/><rect x="18" y="4.6" width="2" height="4.6" rx="1" transform="rotate(45 19 6.9)"/></g>
      <circle cx="12" cy="12" r="6.5" fill="url(#${p}a)"/><ellipse cx="9.8" cy="9.4" rx="2.2" ry="1.4" fill="#fff" opacity=".75" transform="rotate(-30 9.8 9.4)"/>`,
    seal: p => `<defs><linearGradient id="${p}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe9b4"/><stop offset=".5" stop-color="#e2c275"/><stop offset="1" stop-color="#8a6a26"/></linearGradient></defs>
      <path d="M12 2.5l8 3.1v6c0 4.8-3.3 8.6-8 10.1-4.7-1.5-8-5.3-8-10.1v-6z" fill="url(#${p}a)"/><path d="M12 4.2l6.4 2.5v4.9c0 3.9-2.6 7-6.4 8.3z" fill="#000" opacity=".12"/><path d="M8.5 12.2l2.4 2.4 4.6-4.9" fill="none" stroke="#3a2a08" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 6.5 12 4.2" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>`,
    shield: p => ICON3D.seal(p),
    play: p => `<defs><linearGradient id="${p}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9f2b8"/><stop offset="1" stop-color="#5d9442"/></linearGradient></defs>
      <path d="M7 4.6v14.8a1.2 1.2 0 0 0 1.8 1l12-7.4a1.2 1.2 0 0 0 0-2L8.8 3.6A1.2 1.2 0 0 0 7 4.6z" fill="url(#${p}a)"/><path d="M8.6 6.2v4" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".85"/>`,
    cashout: p => `<defs><linearGradient id="${p}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe9b4"/><stop offset="1" stop-color="#a7832f"/></linearGradient><linearGradient id="${p}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9f2b8"/><stop offset="1" stop-color="#5d9442"/></linearGradient></defs>
      <path d="M3.5 14h17v4.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" fill="url(#${p}a)"/><path d="M12 2.8l5.5 5.6h-3.3v7.2h-4.4V8.4H6.5z" fill="url(#${p}b)"/><path d="M5 15.5h14" stroke="#fff" stroke-width="1" opacity=".6"/>`,
    coin: p => `<defs><linearGradient id="${p}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1c4"/><stop offset=".55" stop-color="#e2c275"/><stop offset="1" stop-color="#7d5e1e"/></linearGradient></defs>
      <ellipse cx="12" cy="15.5" rx="8" ry="3.5" fill="#7d5e1e"/><rect x="4" y="9" width="16" height="6.5" fill="#a7832f"/><ellipse cx="12" cy="9" rx="8" ry="3.5" fill="url(#${p}a)"/><ellipse cx="12" cy="9" rx="4.5" ry="1.8" fill="none" stroke="#fff" stroke-width=".9" opacity=".6"/>`,
    spark: p => `<defs><linearGradient id="${p}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6d6"/><stop offset="1" stop-color="#c89b3c"/></linearGradient></defs>
      <path d="M12 2.5c.8 5 2.5 6.8 7.5 7.5-5 .8-6.7 2.5-7.5 7.5-.8-5-2.5-6.7-7.5-7.5 5-.7 6.7-2.5 7.5-7.5z" fill="url(#${p}a)"/><circle cx="18.5" cy="18.5" r="1.6" fill="#e2c275"/>`,
    trophy: p => `<defs><linearGradient id="${p}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1c4"/><stop offset=".6" stop-color="#e2c275"/><stop offset="1" stop-color="#7d5e1e"/></linearGradient></defs>
      <path d="M6.5 6.5H3.8v1.2a3.6 3.6 0 0 0 3.6 3.6M17.5 6.5h2.7v1.2a3.6 3.6 0 0 1-3.6 3.6" fill="none" stroke="#a7832f" stroke-width="1.6"/><path d="M6.5 3.5h11v5.5a5.5 5.5 0 0 1-11 0z" fill="url(#${p}a)"/><rect x="10.8" y="14" width="2.4" height="3.5" fill="#a7832f"/><rect x="7.5" y="17.5" width="9" height="3" rx="1" fill="url(#${p}a)"/>`,
    grid: p => `<defs><linearGradient id="${p}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a8b8e"/><stop offset="1" stop-color="#3a3b3d"/></linearGradient></defs>
      <rect x="3" y="3" width="8" height="8" rx="2.2" fill="url(#${p}a)"/><rect x="13" y="3" width="8" height="8" rx="2.2" fill="url(#${p}a)"/><rect x="3" y="13" width="8" height="8" rx="2.2" fill="url(#${p}a)"/>${''}<rect x="13" y="13" width="8" height="8" rx="2.2" fill="#2c4d20"/><path d="M17 14.6l2.4 2.4-2.4 2.4-2.4-2.4z" fill="#9fd26a"/><path d="M4.5 4.2h5M14.5 4.2h5M4.5 14.2h5" stroke="#fff" stroke-width=".9" stroke-linecap="round" opacity=".45"/>`,
    cards: p => `<defs><linearGradient id="${p}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffdf4"/><stop offset="1" stop-color="#cfc8b2"/></linearGradient></defs>
      <rect x="3" y="5.5" width="10" height="14" rx="2" fill="#8f8a78" transform="rotate(-10 8 12.5)"/><rect x="10" y="3.5" width="10" height="14.5" rx="2" fill="url(#${p}a)"/><path d="M15 7.5l2.2 3-2.2 3-2.2-3z" fill="#3f6b2e"/>`,
    door: p => `<defs><linearGradient id="${p}a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e2c275"/><stop offset="1" stop-color="#7d5e1e"/></linearGradient><linearGradient id="${p}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2b2c"/><stop offset="1" stop-color="#050505"/></linearGradient></defs>
      <path d="M4 21V11a8 8 0 0 1 16 0v10z" fill="url(#${p}a)"/><path d="M6.8 21v-9.6a5.2 5.2 0 0 1 10.4 0V21z" fill="url(#${p}b)"/><circle cx="14.8" cy="15.5" r="1" fill="#9fd26a"/><path d="M2.5 21h19" stroke="#a29d8b" stroke-width="1.6" stroke-linecap="round"/>`,
    robot: p => `<defs><linearGradient id="${p}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2eee2"/><stop offset="1" stop-color="#7c786b"/></linearGradient></defs>
      <rect x="11.2" y="2" width="1.6" height="4" fill="#a29d8b"/><circle cx="12" cy="2.5" r="1.4" fill="#ef6a4c"/><rect x="4" y="6" width="16" height="13" rx="4" fill="url(#${p}a)"/><rect x="6.5" y="9.5" width="11" height="4.5" rx="2.2" fill="#0d0d0e"/><circle cx="9.5" cy="11.75" r="1.1" fill="#9fd26a"/><circle cx="14.5" cy="11.75" r="1.1" fill="#9fd26a"/><path d="M6 7.5h7" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".8"/>`,
    vault: p => `<defs><linearGradient id="${p}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9e5d8"/><stop offset="1" stop-color="#5f5b50"/></linearGradient><radialGradient id="${p}b" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fbe9b4"/><stop offset="1" stop-color="#8a6a26"/></radialGradient></defs>
      <rect x="2.5" y="2.5" width="19" height="19" rx="4.5" fill="url(#${p}a)"/><circle cx="12" cy="12" r="5.6" fill="#1a1a1b"/><circle cx="12" cy="12" r="4.2" fill="url(#${p}b)"/><path d="M12 8.6v2.2M12 13.2v2.2M8.6 12h2.2M13.2 12h2.2" stroke="#3a2a08" stroke-width="1.3" stroke-linecap="round"/><path d="M4.5 5h6" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".7"/>`,
    wallet: p => `<defs><linearGradient id="${p}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d9442"/><stop offset="1" stop-color="#2c4d20"/></linearGradient></defs>
      <rect x="2.5" y="6" width="19" height="14" rx="3" fill="url(#${p}a)"/><rect x="14" y="10.5" width="7.5" height="5" rx="1.5" fill="#1d2a17"/><circle cx="16.5" cy="13" r="1" fill="#e2c275"/><path d="M4.5 7.5h9" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".55"/>`,
  };
  const icon3d = (name, cls) => {
    if (!ICON3D[name]) return icon(name, cls);
    const p = `i3d${++uid}_`;
    return `<svg class="og-icon3d${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICON3D[name](p)}</svg>`;
  };
  // Swap line icons for their 3D version, except ticks and controls that rely on currentColor states
  // The original <use> stays inside (hidden), so page scripts that read or change it keep working;
  // a change of its href redraws the 3D shape, or falls back to the line icon when there is no 3D version.
  const nameOf = u => (/#i-([\w-]+)$/.exec(u.getAttribute('href') || '') || [])[1];
  const paint = (svg, u) => {
    const name = nameOf(u);
    const own = svg.dataset.ogClass; // the page's own classes, kept for its sizing rules
    [...svg.childNodes].forEach(n => { if (n !== u) n.remove(); });
    if (ICON3D[name]) {
      svg.setAttribute('class', `${own} og-icon3d`);
      svg.setAttribute('viewBox', '0 0 24 24');
      u.style.display = 'none';
      svg.insertAdjacentHTML('afterbegin', ICON3D[name](`i3d${++uid}_`));
    } else {
      svg.setAttribute('class', `${own} og-icon`);
      u.style.display = '';
    }
  };
  const upgradeIcons = scope => {
    // any icon drawn from the system sprite, whatever class the page gave it
    (scope || document).querySelectorAll('svg > use[href*="icons.svg#i-"]').forEach(u => {
      const svg = u.parentNode;
      if (!ICON3D[nameOf(u)] || svg.closest('.og-chip, .og-btn--quiet, .og-iconbtn')) return;
      const w = getComputedStyle(svg).width, h = getComputedStyle(svg).height;
      svg.style.width = w; svg.style.height = h;
      svg.dataset.ogClass = (svg.getAttribute('class') || '').replace(/\bog-icon3?d?\b/g, '').trim();
      paint(svg, u);
      new MutationObserver(() => paint(svg, u)).observe(u, { attributes: true, attributeFilter: ['href'] });
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => upgradeIcons());
  else upgradeIcons();

  window.Omni = {
    icon3d, upgradeIcons, reduce, tg, api, wsUrl, live, haptic, sol, mult, shortHash, demoWallet, glassLight, drawIcons, icon, lens, sheet, toast, copy, telegram, LAMPORTS };
})();
