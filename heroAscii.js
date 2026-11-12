/* ==========================================================================
   Hero background: the hand meeting the sensors, drawn in ASCII.

   One canvas behind the hero text. The scene is built from the PATHOS dot
   data (assets/halftone-hand.bin and assets/halftone-board.bin): every dot is
   a particle, particles are binned into a character grid every frame, and
   each cell is drawn as a character whose weight follows how many particles
   it holds (" .:-=+*#%@"), like a living ASCII film.

   Always moving: a director cycles through scenes (reach and touch with
   signal rings, data streaming across the board, quick taps, a scan line,
   the hand dissolving into dust and reforming), over a constant layer of
   breathing, shimmer and drifting dust.

   Interactive: moving the cursor over it parts the characters, dragging
   splits them apart along the drag, and a click (or tap) explodes them;
   springs bring everything back. The canvas never takes pointer events,
   so every link and button in the hero stays clickable. Characters behind
   the text are drawn faint so the copy stays readable. Reduced motion:
   one still frame, no animation.
   ========================================================================== */

const hero = document.getElementById('hero');
const canvas = document.getElementById('heroAscii');

const RAMP = ' .:-=+*#%@';
const COLORS = {
  board: '#2a241f',
  hand: '#a8521f',
  gold: '#a8761f',
  pink: '#c8547e',
  dust: '#8f8173',
};
const COLOR_KEYS = Object.keys(COLORS);

async function loadDots(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  const view = new DataView(buf);
  const headLen = view.getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, headLen)));
  let off = 4 + headLen;
  off += off % 2;
  const count = view.getUint32(off, true);
  off += 4;
  const x = new Float32Array(count), y = new Float32Array(count);
  for (let i = 0; i < count; i++, off += 6) {
    x[i] = view.getUint16(off, true) / 2;
    y[i] = view.getUint16(off + 2, true) / 2;
  }
  return { w: head.w, h: head.h, count, x, y };
}

const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

if (hero && canvas) init().catch(err => console.warn('Hero ASCII unavailable:', err.message));

async function init() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (document.fonts && document.fonts.load) {
    try { await Promise.all([document.fonts.load("700 12px 'Geist Mono'"), document.fonts.load("500 12px 'Geist Mono'")]); } catch (_) {}
  }
  const [hand, board] = await Promise.all([
    loadDots('assets/halftone-hand.bin'),
    loadDots('assets/halftone-board.bin'),
  ]);

  // ---- Particles: hand first, then board, then free dust ----
  const NH = hand.count, NB = board.count, ND = coarse ? 220 : 420;
  const N = NH + NB + ND;
  const kind = new Uint8Array(N);              // 0 hand, 1 board, 2 dust
  const bx = new Float32Array(N), by = new Float32Array(N);  // base, figure units
  const px = new Float32Array(N), py = new Float32Array(N);  // drawn position (css px)
  const ox = new Float32Array(N), oy = new Float32Array(N);  // displacement
  const vx = new Float32Array(N), vy = new Float32Array(N);
  const phase = new Float32Array(N), loose = new Float32Array(N);
  for (let i = 0; i < NH; i++) { kind[i] = 0; bx[i] = hand.x[i]; by[i] = hand.y[i]; }
  for (let j = 0; j < NB; j++) { const i = NH + j; kind[i] = 1; bx[i] = board.x[j]; by[i] = board.y[j]; }
  for (let k = 0; k < ND; k++) { const i = NH + NB + k; kind[i] = 2; bx[i] = Math.random(); by[i] = Math.random(); }
  for (let i = 0; i < N; i++) phase[i] = Math.random() * Math.PI * 2;

  // Dots per data unit² inside each figure (measured on a 10-unit grid), so
  // the character weight stays the same however large a figure is drawn.
  const unitDensity = d => {
    const occ = new Set();
    for (let i = 0; i < d.count; i++) occ.add(((d.x[i] / 10) | 0) * 4096 + ((d.y[i] / 10) | 0));
    return d.count / (occ.size * 100);
  };
  const DH = unitDensity(hand), DB = unitDensity(board);
  let wHand = 1, wBoard = 1;

  // Landmarks in the source images: the index fingertip and the electrodes.
  const TIP = { x: 738, y: 118 };
  const PADS = { x: 52, y: 300 };

  // ---- Canvas, grid and glyph atlas ----
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, cell = 9, cols = 0, rows = 0;
  let geo = null;                 // scene placement
  let mask = null;                // Uint8Array per cell: 1 = behind text
  let atlas = null, tile = 0;
  let dens = null, hl = null, colr = null;   // per-cell accumulators

  const buildAtlas = () => {
    tile = Math.ceil(cell * dpr);
    atlas = document.createElement('canvas');
    atlas.width = tile * RAMP.length;
    atlas.height = tile * COLOR_KEYS.length * 2;
    const a = atlas.getContext('2d');
    a.textAlign = 'center';
    a.textBaseline = 'middle';
    COLOR_KEYS.forEach((key, ci) => {
      // The hand is the subject: bold glyphs at full strength.
      const bold = key === 'hand';
      a.font = `${bold ? 700 : 500} ${Math.round(tile * (bold ? 1.12 : 1.08))}px 'Geist Mono', ui-monospace, monospace`;
      for (const faint of [0, 1]) {
        a.globalAlpha = bold ? (faint ? 0.32 : 1) : faint ? 0.3 : (key === 'dust' ? 0.55 : 0.8);
        a.fillStyle = COLORS[key];
        for (let li = 1; li < RAMP.length; li++) {
          a.fillText(RAMP[li], li * tile + tile / 2, (ci * 2 + faint) * tile + tile / 2 + tile * 0.04);
        }
      }
    });
  };

  const textRects = () => {
    const hr = hero.getBoundingClientRect();
    const out = [];
    const lines = el => { const r = document.createRange(); r.selectNodeContents(el); return [...r.getClientRects()]; };
    hero.querySelectorAll('.hero-title, .hero-sub').forEach(el => lines(el).forEach(q => q.width && out.push(q)));
    hero.querySelectorAll('.announce, .hero-cta .btn, .logos li').forEach(el => out.push(el.getBoundingClientRect()));
    return out.map(q => ({ l: q.left - hr.left - 18, r: q.right - hr.left + 18, t: q.top - hr.top - 10, b: q.bottom - hr.top + 10 }));
  };

  const layout = () => {
    const r = hero.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
    dpr = Math.min(2, devicePixelRatio || 1);
    cell = W < 700 ? 7 : W < 1100 ? 8 : 9;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    cols = Math.ceil(W / cell); rows = Math.ceil(H / cell);
    dens = new Float32Array(cols * rows); hl = new Float32Array(cols * rows); colr = new Uint8Array(cols * rows);

    // Scene: the board on the right, the hand reaching in from the lower left.
    // On wide screens the touch happens just right of the text block, so it
    // is clearly visible; the board then extends to the right.
    const narrow = W < 1000;
    const rects = textRects();
    const textRight = rects.length ? Math.max(...rects.map(q => q.r)) : W * 0.7;
    const bw = narrow ? W * 0.78 : Math.min(W * 0.42, 660);
    const sb = bw / board.w;
    let padX, padY;
    if (narrow) { padX = W * 0.58; padY = H * 0.6; }
    else { padX = Math.min(textRight + 48, W * 0.82); padY = H * 0.6; }
    const boardX = padX - PADS.x * sb, boardY = padY - PADS.y * sb;
    // Wide screens: the hand spans from near the left edge to the pads.
    const hw = clamp((padX - W * 0.04) / (TIP.x / hand.w), W * 0.4, 1100);
    const sh = hw / hand.w;
    const rest = narrow ? W * 0.14 : W * 0.11;
    geo = { sb, boardX, boardY, padX, padY, sh, rest, narrow };
    // Weight each dot so a fully covered cell holds about 4 units either way.
    wHand = 3.8 / Math.max(0.05, DH * cell * cell / (sh * sh));
    wBoard = 2.6 / Math.max(0.05, DB * cell * cell / (sb * sb));

    mask = new Uint8Array(cols * rows);
    for (const q of textRects()) {
      const c0 = clamp(Math.floor(q.l / cell), 0, cols), c1 = clamp(Math.ceil(q.r / cell), 0, cols);
      const r0 = clamp(Math.floor(q.t / cell), 0, rows), r1 = clamp(Math.ceil(q.b / cell), 0, rows);
      for (let rr = r0; rr < r1; rr++) for (let cc = c0; cc < c1; cc++) mask[rr * cols + cc] = 1;
    }
    buildAtlas();
  };

  // ---- Director: scenes that keep the picture changing ----
  // Each returns { gap 0..1 (1 = resting away, 0 = touching), dissolve 0..1,
  // scan (y in 0..1 or -1), pulses: [age s], packets: [progress 0..1] }.
  const SCENES = [
    { name: 'reach', dur: 6.5, at(t) {
      const gap = t < 1.8 ? 1 - ease(t / 1.8) : t < 4.4 ? 0 : ease((t - 4.4) / 2);
      const pulses = [];
      for (let s = 1.8; s < 4.4; s += 0.55) if (t >= s && t - s < 1.6) pulses.push(t - s);
      return { gap, dissolve: 0, scan: -1, pulses, packets: [] };
    } },
    { name: 'stream', dur: 6, at(t) {
      const gap = t < 1.2 ? 1 - ease(t / 1.2) : t < 4.6 ? 0 : ease((t - 4.6) / 1.4);
      const packets = [];
      for (let s = 1.2; s < 4.6; s += 0.45) if (t >= s && t - s < 1.4) packets.push((t - s) / 1.4);
      return { gap, dissolve: 0, scan: -1, pulses: t > 1.2 && t < 2.6 ? [t - 1.2] : [], packets };
    } },
    { name: 'tap', dur: 4.2, at(t) {
      const tap = (s) => { const k = (t - s) / 0.7; return k < 0 || k > 1 ? 1 : 1 - Math.sin(k * Math.PI); };
      const gap = Math.min(tap(0.4), tap(1.5), tap(2.6)) * 0.75 + 0.25 * (t < 3.6 ? 1 : 1);
      const pulses = [0.75, 1.85, 2.95].filter(s => t >= s && t - s < 1.2).map(s => t - s);
      return { gap: clamp(gap, 0, 1), dissolve: 0, scan: -1, pulses, packets: [] };
    } },
    { name: 'scan', dur: 4.5, at(t) {
      return { gap: 1, dissolve: 0, scan: t < 3.6 ? t / 3.6 : -1, pulses: [], packets: [] };
    } },
    { name: 'dissolve', dur: 6, at(t) {
      const dissolve = t < 2.2 ? ease(t / 2.2) : t < 3.4 ? 1 : 1 - ease((t - 3.4) / 2.2);
      return { gap: 1, dissolve, scan: -1, pulses: [], packets: [] };
    } },
  ];
  const TOTAL = SCENES.reduce((s, x) => s + x.dur, 0);
  const director = time => {
    let t = time % TOTAL;
    for (const s of SCENES) { if (t < s.dur) return s.at(t); t -= s.dur; }
    return SCENES[0].at(0);
  };

  // ---- Pointer ----
  const ptr = { x: 0, y: 0, px: 0, py: 0, on: false, down: false, moved: 0, vx: 0, vy: 0 };
  const local = (cx, cy) => { const r = hero.getBoundingClientRect(); return [cx - r.left, cy - r.top]; };
  const interactive = t => t && t.closest && t.closest('a, button, input, textarea, select, label');
  const explode = (x, y) => {
    const R = 240;
    for (let i = 0; i < N; i++) {
      const dx = px[i] - x, dy = py[i] - y, d2 = dx * dx + dy * dy;
      if (d2 > R * R) continue;
      const d = Math.sqrt(d2) || 1, f = (1 - d / R);
      const sp = (10 + Math.random() * 16) * f;
      const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.9;
      vx[i] += Math.cos(a) * sp; vy[i] += Math.sin(a) * sp - 2 * f;
      loose[i] = 1;
    }
    const ring = document.createElement('div');
    ring.className = 'blast-ring';
    const hr = hero.getBoundingClientRect();
    ring.style.left = (hr.left + x) + 'px';
    ring.style.top = (hr.top + y) + 'px';
    ring.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });
    wake();
  };

  if (!reduced) {
    hero.addEventListener('pointermove', e => {
      const [x, y] = local(e.clientX, e.clientY);
      ptr.vx = x - ptr.x; ptr.vy = y - ptr.y;
      ptr.x = x; ptr.y = y; ptr.on = true;
      if (ptr.down) ptr.moved += Math.hypot(ptr.vx, ptr.vy);
      wake();
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { ptr.on = false; ptr.down = false; });
    hero.addEventListener('pointerdown', e => {
      if (e.button !== 0 || interactive(e.target)) return;
      const [x, y] = local(e.clientX, e.clientY);
      ptr.x = x; ptr.y = y; ptr.down = true; ptr.moved = 0; ptr.on = true;
    });
    addEventListener('pointerup', e => {
      if (!ptr.down) return;
      ptr.down = false;
      // A click (not a drag) explodes; a drag already split the characters.
      if (ptr.moved < 8 && !interactive(e.target)) explode(ptr.x, ptr.y);
    });
    // Touch: dragging a finger splits; scrolling is never blocked.
    hero.addEventListener('touchmove', e => {
      const t = e.touches[0]; if (!t) return;
      const [x, y] = local(t.clientX, t.clientY);
      ptr.vx = x - ptr.x; ptr.vy = y - ptr.y; ptr.x = x; ptr.y = y; ptr.on = true; ptr.down = true; ptr.moved = 99;
      wake();
    }, { passive: true });
    hero.addEventListener('touchend', () => { ptr.on = false; ptr.down = false; }, { passive: true });
  }

  // ---- Simulation and drawing ----
  let raf = 0, visible = true, last = 0, start = performance.now(), intro = reduced ? 0 : 1;
  if (!reduced) for (let i = 0; i < N; i++) {   // start scattered, then assemble
    ox[i] = (Math.random() - 0.5) * 900; oy[i] = (Math.random() - 0.5) * 500; loose[i] = 1;
  }

  const step = (now, dtRaw) => {
    const dt = Math.min(2.5, dtRaw / 16.67);    // frames at 60 Hz
    const time = (now - start) / 1000;
    const sc = reduced ? { gap: 0, dissolve: 0, scan: -1, pulses: [], packets: [] } : director(time);
    const g = geo;
    const bob = reduced ? 0 : Math.sin(time * 1.3) * 4;
    const float = reduced ? 0 : Math.sin(time * 0.7 + 1) * 3;
    const gapPx = g.rest * sc.gap;
    // Hand placed so its fingertip sits on the pads when gap = 0.
    const handX = g.padX - TIP.x * g.sh - gapPx;
    const handY = g.padY - TIP.y * g.sh + bob;
    const padX = g.padX, padY = g.padY + float;

    const spring = 0.055, damp = Math.pow(0.86, dt);
    const R = ptr.down ? 130 : 85;
    const pR2 = R * R;
    const sp = Math.hypot(ptr.vx, ptr.vy) || 1;
    const nx = -ptr.vy / sp, ny = ptr.vx / sp;  // normal to the drag

    dens.fill(0); hl.fill(0); colr.fill(0);

    for (let i = 0; i < N; i++) {
      const k = kind[i];
      let hx, hy;
      const w = reduced ? 0 : Math.sin(time * 1.7 + phase[i]);
      if (k === 0) {
        hx = handX + bx[i] * g.sh + w * 0.8;
        hy = handY + by[i] * g.sh + Math.cos(time * 1.3 + phase[i]) * 0.8;
        if (sc.dissolve > 0) {
          // Dust blows off toward the board and comes back.
          const s = sc.dissolve * (0.35 + 0.65 * ((phase[i] * 7) % 1));
          hx += s * (90 + 160 * Math.sin(phase[i] * 3) + 80 * Math.sin(time + phase[i]));
          hy += s * (-60 + 120 * Math.cos(phase[i] * 5) + 40 * Math.sin(time * 1.4 + phase[i]));
        }
      } else if (k === 1) {
        hx = g.boardX + bx[i] * g.sb + w * 0.6;
        hy = g.boardY + by[i] * g.sb + float;
      } else {
        // Drifting dust across the whole hero, wrapping around.
        const sx = (bx[i] * W + time * (10 + 14 * ((phase[i] * 3) % 1))) % W;
        hx = sx; hy = (by[i] * H + Math.sin(time * 0.6 + phase[i]) * 18 + H) % H;
      }

      // Interaction forces.
      if (ptr.on && !reduced) {
        const dx = px[i] - ptr.x, dy = py[i] - ptr.y, d2 = dx * dx + dy * dy;
        if (d2 < pR2) {
          const d = Math.sqrt(d2) || 1, f = 1 - d / R;
          if (ptr.down) {
            // Split: push away from the drag line, plus a little along it.
            const side = (dx * nx + dy * ny) >= 0 ? 1 : -1;
            vx[i] += (nx * side * 2.6 + ptr.vx * 0.08) * f * dt;
            vy[i] += (ny * side * 2.6 + ptr.vy * 0.08) * f * dt;
            loose[i] = Math.max(loose[i], 0.6);
          } else {
            vx[i] += (dx / d) * 1.4 * f * dt; vy[i] += (dy / d) * 1.4 * f * dt;
          }
        }
      }

      const kk = spring * (1 - 0.8 * loose[i]) * dt;
      vx[i] = (vx[i] - ox[i] * kk) * damp; vy[i] = (vy[i] - oy[i] * kk) * damp;
      ox[i] += vx[i] * dt; oy[i] += vy[i] * dt;
      loose[i] = Math.max(0, loose[i] - 0.012 * dt);
      const x = px[i] = hx + ox[i], y = py[i] = hy + oy[i];

      const c = (x / cell) | 0, r = (y / cell) | 0;
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      const idx = r * cols + c;
      if (k === 2) dens[idx] += 0.55;
      else {
        // Splat over a 2x2 block so halftone gaps fill into a solid figure.
        const wv = k === 0 ? wHand : wBoard;
        dens[idx] += wv;
        const fx = x / cell - c, fy = y / cell - r;
        const cn = fx < 0.5 ? c - 1 : c + 1, rn = fy < 0.5 ? r - 1 : r + 1;
        if (cn >= 0 && cn < cols) { dens[r * cols + cn] += wv * 0.5; if (!colr[r * cols + cn]) colr[r * cols + cn] = k === 0 ? 2 : 1; }
        if (rn >= 0 && rn < rows) { dens[rn * cols + c] += wv * 0.5; if (!colr[rn * cols + c]) colr[rn * cols + c] = k === 0 ? 2 : 1; }
      }
      if (k !== 2 && colr[idx] !== 1) colr[idx] = k === 0 ? 2 : 1;  // board ink wins ties
      else if (k === 2 && !colr[idx]) colr[idx] = 3;

      // Highlights: signal rings from the pads, packets along the board, scan line.
      if (k !== 2) {
        let h = 0;
        for (const a of sc.pulses) {
          const rr = a * 260, dd = Math.hypot(x - padX, y - padY);
          h = Math.max(h, (1 - Math.min(1, Math.abs(dd - rr) / 26)) * (1 - a / 1.6));
        }
        if (k === 1) for (const p of sc.packets) {
          const tx = padX + p * (W - padX) * 0.95, ty = padY - p * 140;
          const dd = Math.hypot(x - tx, y - ty);
          if (dd < 40) h = Math.max(h, 1 - dd / 40);
        }
        if (sc.scan >= 0) h = Math.max(h, 1 - Math.min(1, Math.abs(y - sc.scan * H) / 22));
        if (h > hl[idx]) hl[idx] = h;
      }
    }
    if (intro > 0) intro = Math.max(0, intro - 0.01 * dt);
  };

  const draw = (time) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const shimmer = !reduced;
    const t = tile;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c, d = dens[idx];
        if (d <= 0.3) continue;
        let li = Math.min(RAMP.length - 1, 1 + Math.floor(Math.sqrt(d) * 2.1));
        if (shimmer && Math.random() < 0.035) li = clamp(li + (Math.random() < 0.5 ? -1 : 1), 1, RAMP.length - 1);
        const h = hl[idx];
        let ci;
        if (h > 0.25) { ci = h > 0.7 && ((c + r + (time * 6 | 0)) % 5 === 0) ? 3 : 2; li = Math.min(RAMP.length - 1, li + 2); }
        else ci = colr[idx] === 2 ? 1 : colr[idx] === 3 ? 4 : 0;
        const faint = mask[idx];
        ctx.drawImage(atlas, li * t, (ci * 2 + faint) * t, t, t, c * cell * dpr, r * cell * dpr, t, t);
      }
    }
  };

  const frame = now => {
    raf = 0;
    if (!visible) return;
    const dt = last ? now - last : 16.67;
    // ~30 fps on phones: skip a refresh unless enough time has passed.
    if (coarse && last && dt < 30) { raf = requestAnimationFrame(frame); return; }
    last = now;
    step(now, dt);
    draw(now / 1000);
    if (!reduced) raf = requestAnimationFrame(frame);
  };
  const wake = () => { if (!raf && visible && !reduced) { last = 0; raf = requestAnimationFrame(frame); } };

  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layout(); if (reduced) { step(performance.now(), 16.67); draw(0); } });
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layout(); if (reduced) { step(performance.now(), 16.67); draw(0); } }, 120); });
  new IntersectionObserver(es => {
    visible = es[es.length - 1].isIntersecting;
    if (visible) wake();
  }).observe(hero);
  canvas.classList.add('is-on');
  if (reduced) { step(performance.now(), 16.67); draw(0); } else wake();
}
