/* ==========================================================================
   PATHOS — page behaviour
   Small on purpose: nav menu, intro + scroll reveals, halftone hero art,
   device tilt, lightbox and the contact form. The 3D prototype
   (prototype.js) is loaded separately, only when it nears the viewport.
   ========================================================================== */

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const raf = requestAnimationFrame;

/* ---------- Nav ---------- */

function initNav() {
  const nav = document.getElementById('nav');
  const menu = document.getElementById('navLinks');
  const toggle = document.getElementById('navToggle');
  if (!nav || !menu || !toggle) return;

  const setOpen = (open) => {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };

  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); toggle.focus(); }
  });
  document.addEventListener('click', e => {
    if (nav.classList.contains('open') && !nav.contains(e.target)) setOpen(false);
  });

  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    raf(() => { nav.classList.toggle('scrolled', scrollY > 12); ticking = false; });
  }, { passive: true });
}

/* ---------- Intro + reveals ---------- */

function initReveals() {
  document.querySelectorAll('[data-reveal-group]').forEach(group => {
    Array.from(group.children).forEach((child, i) => {
      child.setAttribute('data-reveal', '');
      child.style.setProperty('--d', `${i * 70}ms`);
    });
  });

  const items = document.querySelectorAll('[data-reveal]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach(el => io.observe(el));
}

function startIntro() {
  // Two frames so the initial (hidden) state is painted before transitioning.
  raf(() => raf(() => document.documentElement.classList.add('ready')));
}

/* ---------- Halftone hero art ---------- */
// Dot data is pre-computed from PATHOS photos/renders (see assets/*.bin):
// u32 header length, JSON {w,h,palette}, u32 count, then count × (u16 x2, u16 y2, u8 r10, u8 colour).

async function loadDots(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  const view = new DataView(buf);
  const headLen = view.getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, headLen)));
  let off = 4 + headLen;
  off += off % 2;
  const count = view.getUint32(off, true);
  off += 4;
  const x = new Float32Array(count), y = new Float32Array(count), r = new Float32Array(count);
  const c = new Uint8Array(count);
  for (let i = 0; i < count; i++, off += 6) {
    x[i] = view.getUint16(off, true) / 2;
    y[i] = view.getUint16(off + 2, true) / 2;
    r[i] = view.getUint8(off + 4) / 10;
    c[i] = view.getUint8(off + 5);
  }
  return { ...head, count, x, y, r, c };
}

// Shared pointer state for the hero art (client coordinates; null when away).
const pointer = { x: 0, y: 0, active: false };
const REPEL_RADIUS = 58;          // CSS px: how far around the cursor the dots part

// Rotate 90° clockwise: stands a wide figure upright for the tall gutters.
function rotateData(d) {
  const x = new Float32Array(d.count), y = new Float32Array(d.count);
  for (let i = 0; i < d.count; i++) { x[i] = d.h - d.y[i]; y[i] = d.x[i]; }
  return { ...d, w: d.h, h: d.w, x, y };
}

function flipData(d) {
  const x = new Float32Array(d.count);
  for (let i = 0; i < d.count; i++) x[i] = d.w - d.x[i];
  return { ...d, x };
}

// opts.autoStart = false: stay blank until play() (used for art that
// assembles when it scrolls into view).
function halftone(canvas, data, from, opts = {}) {
  const autoStart = opts.autoStart !== false;
  const ctx = canvas.getContext('2d');
  const n = data.count;
  // Pre-group dots by colour so each frame is one path per colour.
  const groups = data.palette.map(() => []);
  for (let i = 0; i < n; i++) groups[data.c[i]].push(i);

  // Intro: each dot starts scattered to one side and settles in.
  const sx = new Float32Array(n), sy = new Float32Array(n), delay = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = data.x[i] / data.w;
    const lead = from === 'left' ? t : 1 - t;
    sx[i] = (from === 'left' ? -1 : 1) * (120 + Math.random() * 420);
    sy[i] = (Math.random() - 0.5) * 260;
    delay[i] = lead * 0.55 + Math.random() * 0.25;
  }
  // Interaction: per-dot displacement and velocity (data units), plus a
  // little per-dot randomness so the dots part unevenly, like grains.
  const ox = new Float32Array(n), oy = new Float32Array(n);
  const vx = new Float32Array(n), vy = new Float32Array(n);
  const jitter = new Float32Array(n);
  for (let i = 0; i < n; i++) jitter[i] = 0.75 + Math.random() * 0.5;

  let scale = 1, dpr = 1, introStart = performance.now(), introDone = reduceMotion;
  let running = false, displaced = false, started = autoStart;
  let boomUntil = 0;                // looser damping right after a click explosion

  // The canvas extends PAD data units past the art on every side (negative
  // margins keep the art itself in place) so exploding dots stay visible.
  const PAD = Math.round(Math.max(data.w, data.h) * 0.32);
  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.style.width = '';
    canvas.style.margin = '';
    const w = opts.fit ? opts.fit(data) : canvas.clientWidth;   // the art's own CSS width
    if (!w) return;
    scale = w / data.w;
    const p = PAD * scale;
    canvas.style.width = (w + 2 * p) + 'px';
    canvas.style.margin = (-p) + 'px';
    canvas.width = Math.round((w + 2 * p) * dpr);
    canvas.height = Math.round((data.h * scale + 2 * p) * dpr);
  }
  // Client-space box of the art itself (excluding the padding).
  function box() {
    const r = canvas.getBoundingClientRect();
    const k = r.width / (data.w + 2 * PAD);
    const p = PAD * k;
    return { k, left: r.left + p, top: r.top + p, right: r.right - p, bottom: r.bottom - p, width: r.width - 2 * p };
  }

  function draw(progress) {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, PAD * scale * dpr, PAD * scale * dpr);
    ctx.clearRect(-PAD, -PAD, data.w + 2 * PAD, data.h + 2 * PAD);
    const intro = progress < 1.8;
    for (let g = 0; g < groups.length; g++) {
      const ids = groups[g];
      if (!ids.length) continue;
      ctx.fillStyle = data.palette[g];
      ctx.beginPath();
      for (let k = 0; k < ids.length; k++) {
        const i = ids[k];
        let px = data.x[i] + ox[i], py = data.y[i] + oy[i];
        if (intro) {
          let t = (progress - delay[i]) / 1.0;
          t = t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
          if (t === 0) continue;
          if (t < 1) { px += sx[i] * (1 - t); py += sy[i] * (1 - t); }
        }
        ctx.moveTo(px + data.r[i], py);
        ctx.arc(px, py, data.r[i], 0, 6.2832);
      }
      ctx.fill();
    }
  }

  // Push dots out of the cursor's radius; springs pull them home.
  function physics() {
    let moving = false;
    // Just after a blast: let dots fly a little, then snap home quickly.
    const booming = performance.now() < boomUntil;
    const damp = booming ? 0.9 : 0.8;
    const spring = booming ? 0.02 : 0.075;
    let mx = -1e6, my = -1e6, R = 0;
    if (pointer.active) {
      const b = box();                             // includes any drift transform
      R = REPEL_RADIUS / b.k;
      mx = (pointer.x - b.left) / b.k;
      my = (pointer.y - b.top) / b.k;
    }
    const R2 = R * R;
    for (let i = 0; i < n; i++) {
      const hx = data.x[i] + ox[i] - mx, hy = data.y[i] + oy[i] - my;
      const d2 = hx * hx + hy * hy;
      if (d2 < R2 && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (R - d) * 0.22 * jitter[i];
        vx[i] += (hx / d) * push;
        vy[i] += (hy / d) * push;
      }
      vx[i] = (vx[i] - ox[i] * spring) * damp;
      vy[i] = (vy[i] - oy[i] * spring) * damp;
      ox[i] += vx[i];
      oy[i] += vy[i];
      if (Math.abs(ox[i]) > 0.05 || Math.abs(oy[i]) > 0.05 || Math.abs(vx[i]) > 0.02 || Math.abs(vy[i]) > 0.02) moving = true;
      else { ox[i] = oy[i] = vx[i] = vy[i] = 0; }
    }
    return moving;
  }

  function near() {
    if (!pointer.active || !started) return false;
    const r = box();
    if (!(r.width > 0)) return false;
    const m = REPEL_RADIUS;
    return pointer.x > r.left - m && pointer.x < r.right + m && pointer.y > r.top - m && pointer.y < r.bottom + m;
  }

  function frame(now) {
    if (!started) { running = false; return; }
    const p = introDone ? 2 : (now - introStart) / 1000;
    if (!introDone && p >= 1.8) { introDone = true; canvas.classList.add('settled'); }
    displaced = (near() || displaced) ? physics() : false;
    draw(p);
    if (!introDone || displaced || near()) raf(frame);
    else running = false;
  }
  function wake() { if (!running) { running = true; raf(frame); } }

  function play() {
    if (started && !autoStart) return;
    started = true;
    size();
    if (reduceMotion) { draw(2); canvas.classList.add('settled'); return; }
    introStart = performance.now();
    introDone = false;
    wake();
  }

  if (autoStart) {
    size();
    if (reduceMotion) { draw(2); canvas.classList.add('settled'); }
    else wake();
  }

  return {
    canvas,
    box,
    play,
    get started() { return started; },
    resize() { if (!started) return; size(); draw(introDone ? 2 : 0); },
    prepare() { size(); },           // size the canvas before it is shown
    poke() { if (!reduceMotion && (near() || displaced)) wake(); },
    // Is a client point on (or just around) this piece?
    hit(x, y, pad = 12) {
      if (!started) return false;
      const r = box();
      return r.width > 0 && x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
    },
    // Mini explosion: kick every dot outward from the click point with a
    // falloff and a little random spread; the springs bring them home.
    blast(x, y) {
      if (reduceMotion || !started) return;
      const b = box();
      const cx = (x - b.left) / b.k, cy = (y - b.top) / b.k;
      const RB = Math.max(data.w, data.h) * 0.85;
      const power = 120;
      for (let i = 0; i < n; i++) {
        let dx = data.x[i] + ox[i] - cx, dy = data.y[i] + oy[i] - cy;
        let d = Math.sqrt(dx * dx + dy * dy);
        if (d > RB) continue;
        if (d < 0.001) { const a = Math.random() * 6.2832; dx = Math.cos(a); dy = Math.sin(a); d = 1; }
        const f = Math.pow(1 - d / RB, 1.4) * power * jitter[i];
        const a = (Math.random() - 0.5) * 0.9;       // scatter the angle a bit
        const ux = dx / d, uy = dy / d;
        const c = Math.cos(a), s = Math.sin(a);
        vx[i] += (ux * c - uy * s) * f;
        vy[i] += (ux * s + uy * c) * f - f * 0.12;   // slight upward lift
      }
      boomUntil = performance.now() + 340;
      displaced = true;
      wake();
    },
  };
}

/* Hero figures: on desktop, place each figure in the largest clear area
   beside the hero text. Obstacles are the real line boxes of the headline
   and subtitle, the announcement pill, the button and each partner logo, so
   the figure can grow wherever the text is narrow. Returns the art width and
   sets the canvas's top; below 1100px the stylesheet decides. */
const HERO_EDGE = 12, HERO_CLEAR = 18, HERO_MAX = 760;
function heroObstacles(hero) {
  const out = [];
  const lines = el => { const r = document.createRange(); r.selectNodeContents(el); return [...r.getClientRects()]; };
  hero.querySelectorAll('.hero-title, .hero-sub').forEach(el => lines(el).forEach(q => q.width && out.push(q)));
  hero.querySelectorAll('.hero-status, .hero-cta > *, .hero-proof').forEach(el => out.push(el.getBoundingClientRect()));
  return out;
}
function heroFit(canvas, hero, d, side) {
  canvas.style.top = ''; canvas.style.left = ''; canvas.style.right = '';
  if (innerWidth < 1100) return canvas.clientWidth;
  const hr = hero.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const obs = heroObstacles(hero).map(q => ({ t: q.top - hr.top, b: q.bottom - hr.top, l: q.left, r: q.right }));
  const nav = document.getElementById('nav');
  const minY = (nav ? nav.getBoundingClientRect().bottom - hr.top : 70) + 14;
  const maxY = hr.height - 12;
  const ar = d.h / d.w;
  // Free width for a band [y0, y1] on this side.
  const free = (y0, y1) => {
    let lim = side === 'left' ? Infinity : -Infinity;
    for (const o of obs) {
      if (o.b < y0 - HERO_CLEAR || o.t > y1 + HERO_CLEAR) continue;
      lim = side === 'left' ? Math.min(lim, o.l) : Math.max(lim, o.r);
    }
    const space = side === 'left' ? (lim === Infinity ? vw : lim) - HERO_EDGE - HERO_CLEAR
                                  : vw - (lim === -Infinity ? 0 : lim) - HERO_EDGE - HERO_CLEAR;
    return Math.min(space, HERO_MAX);
  };
  let best = { w: 0, y: minY };
  for (let y0 = minY; y0 < maxY - 80; y0 += 6) {
    let lo = 80, hi = Math.min(HERO_MAX, (maxY - y0) / ar);
    if (hi < lo) break;
    for (let k = 0; k < 18; k++) {             // largest w whose box is clear
      const w = (lo + hi) / 2;
      if (w <= free(y0, y0 + w * ar)) lo = w; else hi = w;
    }
    if (lo > best.w + 0.5) best = { w: lo, y: y0 };
  }
  if (best.w < 120) return canvas.clientWidth;   // no good spot: fall back to CSS
  // Centre the figure vertically inside the clear band it can occupy.
  let yTop = best.y, h = best.w * ar;
  let up = yTop, down = yTop;
  while (up - 4 >= minY && best.w <= free(up - 4, up - 4 + h)) up -= 4;
  while (down + 4 + h <= maxY && best.w <= free(down + 4, down + 4 + h)) down += 4;
  yTop = (up + down) / 2;
  canvas.style.top = yTop.toFixed(1) + 'px';
  canvas.style[side] = HERO_EDGE + 'px';
  return Math.floor(best.w);
}

async function initHalftones() {
  const hand = document.getElementById('htHand');
  const board = document.getElementById('htBoard');
  const hero = document.getElementById('hero');
  if (!hand || !board || !hero) return;

  // Pause the idle drift once the hero is off screen.
  new IntersectionObserver(es => document.documentElement.classList.toggle('hero-off', !es[es.length - 1].isIntersecting)).observe(hero);

  let arts = [];
  try {
    const [handData, boardData] = await Promise.all([
      loadDots('assets/halftone-hand.bin'),
      loadDots('assets/halftone-board.bin'),
    ]);
    arts = [
      halftone(hand, handData, 'left', { fit: d => heroFit(hand, hero, d, 'left') }),
      halftone(board, boardData, 'right', { fit: d => heroFit(board, hero, d, 'right') }),
    ];
    // Web fonts change the text's width; re-place the figures once they load.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => arts.slice(0, 2).forEach(a => a.resize()));
    initEdgeArt(arts);
    let timer;
    addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => arts.forEach(a => a.resize()), 120);
    }, { passive: true });
  } catch (err) {
    console.warn('Halftone art unavailable:', err.message);
    return;
  }
  if (reduceMotion) return;

  const move = (x, y) => {
    pointer.x = x; pointer.y = y; pointer.active = true;
    arts.forEach(a => a.poke());
  };
  const leave = () => {
    pointer.active = false;
    arts.forEach(a => a.poke());
  };

  // Track the pointer on the whole document: the hand hangs below the hero's
  // bottom edge, where the next section sits on top of it, so hero-only
  // listeners would miss the cursor there.
  const overArt = (x, y) => {
    const pad = REPEL_RADIUS;
    if (arts.some(a => {
      if (!a.started) return false;
      const r = a.box();
      if (!(r.width > 0)) return false;
      return x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
    })) return true;
    const h = hero.getBoundingClientRect();
    return x >= h.left && x <= h.right && y >= h.top && y <= h.bottom;
  };

  document.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    if (overArt(e.clientX, e.clientY)) {
      move(e.clientX, e.clientY);
    } else if (pointer.active) {
      leave();
    }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { if (pointer.active) leave(); });
  // Click (or tap) a figure: mini explosion + shockwave ring.
  const blastAt = (x, y, target) => {
    if (target && target.closest && target.closest('a, button, input, textarea, select, label, .device, .card, .marble, .shot, .hw-stage, .fl-stage')) return;
    const hitArts = arts.filter(a => a.hit(x, y));
    if (!hitArts.length) return;
    hitArts.forEach(a => a.blast(x, y));
    const wave = document.createElement('div');
    wave.className = 'blast-ring';
    wave.style.left = x + 'px';
    wave.style.top = y + 'px';
    wave.setAttribute('aria-hidden', 'true');
    document.body.appendChild(wave);
    wave.addEventListener('animationend', () => wave.remove(), { once: true });
  };
  document.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    blastAt(e.clientX, e.clientY, e.target);
  });
  // Touch: use click so a scroll gesture never triggers it.
  document.addEventListener('click', e => {
    if (e.pointerType && e.pointerType !== 'touch') return;
    if (!e.pointerType && !matchMedia('(pointer: coarse)').matches) return;
    blastAt(e.clientX, e.clientY, e.target);
  });

  // Touch: dragging a finger across the art parts the dots too.
  document.addEventListener('touchmove', e => {
    const t = e.touches[0];
    if (t && overArt(t.clientX, t.clientY)) move(t.clientX, t.clientY);
  }, { passive: true });
  document.addEventListener('touchend', () => { if (pointer.active) leave(); }, { passive: true });
  addEventListener('scroll', () => { if (pointer.active) arts.forEach(a => a.poke()); }, { passive: true });
}

/* ---------- Edge art ----------
   Dot-art pieces in the page's side margins (<canvas class="edge-art">),
   built from PATHOS photos and renders like the hero art. Each assembles
   from scattered dots the first time it scrolls into view, then drifts with
   the scroll (parallax) and parts around the cursor. Data loads only when
   the first piece nears the viewport; hidden below ~1200px wide. */

function initEdgeArt(arts) {
  const els = Array.from(document.querySelectorAll('canvas.edge-art'));
  if (!els.length) return;
  const cache = {};
  // data-art names an asset: "hand" reuses the hero hand, others are edge-*.bin.
  const src = name => name === 'hand' ? 'assets/halftone-hand.bin' : `assets/edge-${name}.bin`;
  const load = name => (cache[name] ||= loadDots(src(name)));
  const items = [];
  // Fill the free gutter beside the 1040px content column (12px from the
  // viewport edge, 16px clear of the content), up to ~96% of the section's
  // height, capped at 680px wide.
  const CONTENT = 1040, EDGE = 12, CLEAR = 16;
  function fitWidth(el, d) {
    const gutter = (document.documentElement.clientWidth - CONTENT) / 2;
    const host = el.offsetParent;
    const maxH = host ? host.clientHeight * 0.96 : 700;
    return Math.max(0, Math.min(gutter - EDGE - CLEAR, 680, maxH * d.w / d.h));
  }

  const setup = el => {
    if (el.dataset.ready) return;
    el.dataset.ready = '1';
    const side = el.dataset.side === 'right' ? 'right' : 'left';
    load(el.dataset.art).then(raw => {
      let data = raw;
      if (el.dataset.rotate === '1') data = rotateData(data);
      if (el.dataset.flip === '1') data = flipData(data);
      const art = halftone(el, data, side, { autoStart: false, fit: d => fitWidth(el, d) });
      arts.push(art);
      const item = { el, art, side, speed: parseFloat(el.dataset.speed || '0.16'), visible: false };
      items.push(item);
      art.prepare();
      update();
      showIO.observe(el);
    }).catch(err => console.warn('Edge art unavailable:', err.message));
  };

  // Load a piece's data ahead of time; assemble it once it's actually on screen.
  const loadIO = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { setup(e.target); loadIO.unobserve(e.target); }
  }), { rootMargin: '2600px 0px' });
  const showIO = new IntersectionObserver(entries => entries.forEach(e => {
    const item = items.find(i => i.el === e.target);
    if (!item) return;
    item.visible = e.isIntersecting;
    if (e.isIntersecting && e.intersectionRatio > 0.3) item.art.play();
    if (e.isIntersecting) queue();
  }), { threshold: [0, 0.3, 0.6] });
  els.forEach(el => loadIO.observe(el));

  // Vertically centre each piece beside its section, with a gentle drift
  // against the scroll (kept small so a piece never leaves its section).
  let ticking = false;
  function update() {
    ticking = false;
    const mid = innerHeight / 2;
    for (const it of items) {
      const host = it.el.offsetParent;
      if (!host) continue;
      const pad = -parseFloat(it.el.style.marginTop || '0') || 0;
      const artH = it.el.offsetHeight - 2 * pad;
      const centre = Math.max(0, (host.clientHeight - artH) / 2);
      let y = centre;
      if (!reduceMotion) {
        const off = host.getBoundingClientRect().top + centre + artH / 2 - mid;
        const room = Math.max(0, Math.min(36, centre - 8));
        y += Math.max(-room, Math.min(room, -off * it.speed));
      }
      it.el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    }
  }
  function queue() { if (!ticking) { ticking = true; raf(update); } }
  addEventListener('scroll', queue, { passive: true });
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      items.forEach(i => { if (!i.art.started) i.art.prepare(); });
      update();
    }, 160);
  }, { passive: true });
}

/* ---------- Device tour ----------
   Scroll through the tall #device-tour section: the iPad tilts in, then turns
   between screens, and the screenshot switches at the peak of each turn.
   Targets are computed on scroll; a rAF loop eases toward them and stops once
   settled, so nothing runs while the section is idle or off screen. */

function initDevice() {
  const section = document.getElementById('device-tour');
  const device = document.getElementById('device');
  if (!section || !device) return;
  // The heading sits above the tall track that holds the pinned stage, so
  // scroll timing is measured on the track, not the whole section.
  const track = document.getElementById('deviceTrack') || section;
  const shots = Array.from(device.querySelectorAll('.screen-shot'));
  const steps = Array.from(section.querySelectorAll('.step-btn'));
  const caps = Array.from(section.querySelectorAll('.device-caption'));
  const n = shots.length;
  let index = 0;

  function show(i) {
    if (i === index) return;
    index = i;
    shots.forEach((el, k) => el.classList.toggle('is-on', k === i));
    steps.forEach((el, k) => {
      el.classList.toggle('is-on', k === i);
      if (k === i) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
    });
    caps.forEach((el, k) => el.classList.toggle('is-on', k === i));
  }

  // Scroll range during which the stage is pinned.
  const range = () => Math.max(1, track.offsetHeight - innerHeight);
  const progress = () => Math.min(1, Math.max(0, -track.getBoundingClientRect().top / range()));

  steps.forEach((btn, i) => btn.addEventListener('click', () => {
    const top = track.getBoundingClientRect().top + scrollY + range() * ((i + 0.5) / n);
    scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
  }));

  const smooth = t => t * t * (3 - 2 * t);
  const cur = { rx: 0, ry: 0, rz: 0, s: 1 };
  const tgt = { rx: 0, ry: 0, rz: 0, s: 1 };
  let running = false, visible = false;

  function computeTargets() {
    const rect = track.getBoundingClientRect();
    const vh = innerHeight;
    // Entry: from first sight until the stage pins, the device tilts flat.
    const enter = smooth(Math.min(1, Math.max(0, 1 - rect.top / vh)));
    const p = progress();
    const x = p * n;                               // 0..n across the screens
    show(Math.min(n - 1, Math.floor(x)));
    // Turn around each boundary (1..n-1): peaks exactly when the screen switches.
    let turn = 0;
    for (let b = 1; b < n; b++) {
      const d = Math.abs(x - b);
      if (d < 0.42) turn = smooth(1 - d / 0.42) * (b % 2 ? 1 : -1);
    }
    tgt.rx = (1 - enter) * 26 + Math.abs(turn) * 4;
    tgt.ry = turn * 18;
    tgt.rz = (1 - enter) * -5 + turn * -1.2;
    tgt.s = 0.9 + enter * 0.1 - Math.abs(turn) * 0.025;
  }

  function apply() {
    device.style.setProperty('--rx', cur.rx.toFixed(2) + 'deg');
    device.style.setProperty('--ry', cur.ry.toFixed(2) + 'deg');
    device.style.setProperty('--rz', cur.rz.toFixed(2) + 'deg');
    device.style.setProperty('--s', cur.s.toFixed(4));
  }

  function loop() {
    let moving = false;
    for (const k in cur) {
      const d = tgt[k] - cur[k];
      if (Math.abs(d) > 0.001) { cur[k] += d * 0.16; moving = true; } else cur[k] = tgt[k];
    }
    apply();
    if (moving && visible) raf(loop); else running = false;
  }

  function onScroll() {
    computeTargets();
    if (reduceMotion) return;
    if (!running && visible) { running = true; raf(loop); }
  }

  new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; if (visible) onScroll(); },
    { rootMargin: '200px 0px' }).observe(section);
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });

  // Start in the tilted pose so the first frame matches the entry animation.
  computeTargets();
  if (!reduceMotion) Object.assign(cur, tgt);
  apply();
}

/* ---------- Images + lightbox ---------- */

function initImageLoading() {
  document.querySelectorAll('.shot img').forEach(img => {
    const done = () => img.classList.add('loaded');
    if (img.complete && img.naturalWidth > 0) return done();
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', () => {
      const shot = img.closest('.shot');
      if (shot) { shot.classList.add('is-missing'); shot.setAttribute('aria-disabled', 'true'); }
    }, { once: true });
  });
}

function initLightbox() {
  const box = document.getElementById('lightbox');
  if (!box) return;
  const img = document.getElementById('lightboxImage');
  const title = document.getElementById('lightboxTitle');
  const desc = document.getElementById('lightboxDesc');
  const counter = document.getElementById('lightboxCounter');
  const closeBtn = document.getElementById('lightboxClose');
  const prev = document.getElementById('lightboxPrev');
  const next = document.getElementById('lightboxNext');
  let group = [], index = 0, last = null;

  function render() {
    const shot = group[index];
    if (!shot) return;
    const src = shot.querySelector('img');
    img.src = src.currentSrc || src.src;
    img.alt = src.alt;
    title.textContent = shot.querySelector('.shot-caption strong')?.textContent.trim() || '';
    desc.textContent = shot.querySelector('.shot-caption-text > span')?.textContent.trim() || '';
    counter.textContent = `${index + 1} / ${group.length}`;
    prev.hidden = next.hidden = group.length < 2;
  }
  function open(shot) {
    const container = shot.closest('[data-lightbox-group]');
    group = Array.from(container ? container.querySelectorAll('.shot:not(.is-missing)') : [shot]);
    index = Math.max(0, group.indexOf(shot));
    last = document.activeElement;
    box.hidden = false;
    render();
    raf(() => { box.classList.add('open'); document.body.classList.add('lightbox-open'); closeBtn.focus(); });
  }
  function close() {
    box.classList.remove('open');
    document.body.classList.remove('lightbox-open');
    const done = () => { box.hidden = true; img.removeAttribute('src'); };
    reduceMotion ? done() : setTimeout(done, 250);
    last?.focus();
  }
  const step = d => { if (group.length > 1) { index = (index + d + group.length) % group.length; render(); } };

  document.querySelectorAll('.shot').forEach(shot => shot.addEventListener('click', () => {
    if (!shot.classList.contains('is-missing')) open(shot);
  }));
  closeBtn.addEventListener('click', close);
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  box.addEventListener('click', e => { if (e.target === box) close(); });
  document.addEventListener('keydown', e => {
    if (box.hidden) return;
    if (e.key === 'Escape') return close();
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'Tab') {
      const f = [closeBtn, prev, next].filter(b => !b.hidden);
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
}

/* ---------- Contact form ----------
   Posts to the form's action (FormSubmit's AJAX endpoint, which emails the
   PATHOS inbox). Each field gets its own inline error; "sent" is shown only
   after the service confirms delivery, otherwise a specific error with the
   email address as a fallback. */

const FIELD_ERRORS = {
  name: () => 'Enter your name.',
  email: f => (f.value.trim() ? 'Enter an email address like name@example.org.' : 'Enter your email address.'),
  interest: () => 'Choose the type of interest.',
  message: () => 'Write a short message so we know how to help.',
};

function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  const status = document.getElementById('formStatus');
  const button = form.querySelector('button[type="submit"]');
  const label = button.textContent;
  const fields = Array.from(form.querySelectorAll('input[required], select[required], textarea[required]'));
  const show = (msg, type) => { status.textContent = msg; status.className = `form-status ${type}`; status.hidden = false; };
  const setError = (f, msg) => {
    const err = document.getElementById(`${f.id}Error`);
    f.setAttribute('aria-invalid', String(!!msg));
    if (err) { err.textContent = msg || ''; err.hidden = !msg; }
  };
  const check = f => {
    const ok = f.value.trim() !== '' && f.checkValidity();
    setError(f, ok ? '' : FIELD_ERRORS[f.name](f));
    return ok;
  };
  // Once a field has been flagged, re-check it as the visitor fixes it.
  fields.forEach(f => f.addEventListener(f.tagName === 'SELECT' ? 'change' : 'input', () => { if (f.getAttribute('aria-invalid') === 'true') check(f); }));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const invalid = fields.filter(f => !check(f));
    if (invalid.length) {
      show(invalid.length === 1 ? 'One field needs attention.' : `${invalid.length} fields need attention.`, 'error');
      invalid[0].focus();
      return;
    }
    const data = Object.fromEntries(new FormData(form));
    if (data._honey) return;                       // bots fill the hidden field
    const payload = {
      name: data.name.trim(), email: data.email.trim(), organization: (data.organization || '').trim() || 'Not given',
      interest: data.interest, message: data.message.trim(),
      _subject: `PATHOS: ${data.interest} from ${data.name.trim()}`, _replyto: data.email.trim(), _template: 'table',
    };
    button.disabled = true; button.textContent = 'Sending…';
    status.hidden = true;
    try {
      const res = await fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
      const out = await res.json().catch(() => ({}));
      if (res.ok && String(out.success) === 'true') {
        show(`Thanks, ${payload.name}. Your message was sent, and we'll reply to ${payload.email}.`, 'success');
        form.reset();
        fields.forEach(f => setError(f, ''));
      } else {
        show('Your message could not be sent. Please email rsignsv1279@gmail.com instead.', 'error');
      }
    } catch (_) {
      show('Your message could not be sent because the connection failed. Please try again, or email rsignsv1279@gmail.com.', 'error');
    } finally {
      button.disabled = false; button.textContent = label;
    }
  });
}

/* ---------- Init ---------- */

initNav();
initReveals();
initHalftones();
initDevice();
initImageLoading();
initLightbox();
initContactForm();
const year = document.getElementById('copyrightYear');
if (year) year.textContent = new Date().getFullYear();
startIntro();
