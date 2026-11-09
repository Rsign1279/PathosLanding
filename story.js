/* ==========================================================================
   Landing story animations.

   - Problem chart: a live drawing of the gap between what the body shows
     (skin conductance and heart rhythm shift early) and what people see
     (behaviour changes last). Draws left to right, holds, and repeats while
     on screen.
   - How it works: a small live scene that plays the three steps of the demo
     flow (place, verify, observe) in sync with the step list; clicking a
     step jumps to it.
   - FAQ: smooth open and close.
   - Feature visuals and the footer art only animate while on screen.
   Everything respects reduced motion.
   ========================================================================== */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const FONT = getComputedStyle(document.body).fontFamily;
const MONO = getComputedStyle(document.documentElement).getPropertyValue('--font-mono') || 'monospace';
const C = { gold: '210,175,112', pink: '240,163,187', cream: '246,239,231', green: '159,211,168' };

/* ---------- On-screen classes for CSS animations ---------- */

const live = (el, cls = 'is-live') => el && new IntersectionObserver(es => el.classList.toggle(cls, es[es.length - 1].isIntersecting), { rootMargin: '80px 0px' }).observe(el);
live(document.querySelector('.feats'));
live(document.getElementById('footCard'));

/* ---------- Canvas helper ---------- */

function stage(canvas, draw) {
  const ctx = canvas.getContext('2d');
  const s = { canvas, ctx, w: 1, h: 1, visible: false, t0: performance.now(), raf: 0 };
  const size = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    s.w = Math.max(1, r.width); s.h = Math.max(1, r.height);
    canvas.width = Math.round(s.w * dpr); canvas.height = Math.round(s.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(s, reduced ? Infinity : performance.now());
  };
  const loop = now => {
    s.raf = 0;
    if (!s.visible) return;
    draw(s, now);
    s.raf = requestAnimationFrame(loop);
  };
  new ResizeObserver(size).observe(canvas);
  new IntersectionObserver(es => {
    s.visible = es[es.length - 1].isIntersecting;
    if (s.visible && !reduced && !s.raf) { s.t0 = performance.now(); s.raf = requestAnimationFrame(loop); }
  }, { rootMargin: '40px 0px' }).observe(canvas);
  return s;
}
const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const noise = t => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; };

/* ---------- 3. Problem chart ---------- */

const chart = document.getElementById('problemChart');
if (chart) {
  const body = x => 0.1 + 0.7 / (1 + Math.exp(-(x - 0.42) * 10)) + 0.025 * (noise(x * 28) - 0.5);
  const seen = x => 0.08 + 0.74 * smooth(0.72, 0.9, x);
  const GAP = [0.24, 0.74];
  stage(chart, (s, now) => {
    const { ctx, w, h } = s;
    const CYCLE = 8.5, DRAW = 4.6, FADE = 0.7;
    const t = now === Infinity ? DRAW : ((now - s.t0) / 1000) % CYCLE;
    const p = ease(t / DRAW);                              // how far the drawing has got
    const fade = 1 - smooth(CYCLE - FADE, CYCLE, t);
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = fade;
    const L = 6, R = w - 6, T = 34, B = h - 30;
    const X = x => L + x * (R - L), Y = v => B - v * (B - T);
    // Baseline and time label.
    ctx.strokeStyle = `rgba(${C.cream},0.18)`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, B + 0.5); ctx.lineTo(R, B + 0.5); ctx.stroke();
    ctx.font = `12px ${MONO}`; ctx.fillStyle = `rgba(${C.cream},0.45)`; ctx.textAlign = 'right';
    ctx.fillText('time →', R, B + 20);
    ctx.textAlign = 'left'; ctx.fillText('calm', L, B + 20);
    // The missed window.
    const gx0 = X(GAP[0]), gx1 = X(Math.min(GAP[1], Math.max(GAP[0], p)));
    if (p > GAP[0]) {
      const g = ctx.createLinearGradient(0, T, 0, B);
      g.addColorStop(0, `rgba(${C.gold},0.22)`); g.addColorStop(1, `rgba(${C.gold},0.04)`);
      ctx.fillStyle = g; ctx.fillRect(gx0, T - 18, gx1 - gx0, B - T + 18);
      ctx.strokeStyle = `rgba(${C.gold},0.5)`; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(gx0 + 0.5, T - 18); ctx.lineTo(gx0 + 0.5, B); ctx.stroke();
      if (p >= GAP[1]) { ctx.beginPath(); ctx.moveTo(X(GAP[1]) + 0.5, T - 18); ctx.lineTo(X(GAP[1]) + 0.5, B); ctx.stroke(); }
      ctx.setLineDash([]);
      const la = smooth(0.45, 0.6, p);
      if (la > 0) {
        ctx.globalAlpha = fade * la;
        ctx.font = `500 13px ${FONT}`; ctx.fillStyle = `rgb(${C.gold})`; ctx.textAlign = 'center';
        ctx.fillText('The window that gets missed', (gx0 + X(GAP[1])) / 2, T - 4);
        ctx.globalAlpha = fade;
      }
    }
    // A curve, drawn up to the current point.
    const curve = (fn, color, width, dash) => {
      const n = 140, end = Math.max(1, Math.round(n * p));
      ctx.beginPath();
      for (let i = 0; i <= end; i++) { const x = i / n; i ? ctx.lineTo(X(x), Y(fn(x))) : ctx.moveTo(X(x), Y(fn(x))); }
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
      const x = end / n;
      ctx.beginPath(); ctx.arc(X(x), Y(fn(x)), 3.5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    };
    curve(seen, `rgba(${C.cream},0.85)`, 2, [5, 4]);
    curve(body, `rgb(${C.pink})`, 2.6);
    // Markers.
    const mark = (x, v, label, align, show) => {
      const a = smooth(show, show + 0.08, p);
      if (a <= 0) return;
      ctx.globalAlpha = fade * a;
      ctx.beginPath(); ctx.arc(X(x), Y(v), 5.5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${C.cream},0.9)`; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = `13px ${FONT}`; ctx.fillStyle = `rgba(${C.cream},0.92)`; ctx.textAlign = align;
      ctx.fillText(label, X(x) + (align === 'left' ? 10 : -10), Y(v) - 10);
      ctx.globalAlpha = fade;
    };
    mark(0.3, body(0.3), w < 420 ? 'Body shifts' : 'Sweat and heart rhythm shift', 'left', 0.3);
    mark(0.8, seen(0.8), 'Others notice', 'right', 0.8);
    ctx.globalAlpha = 1;
  });
}

/* ---------- 5. How it works ---------- */

const scene = document.getElementById('howCanvas');
const stepsEl = document.getElementById('howSteps');
if (scene && stepsEl) {
  const STEP_MS = 3600;
  const buttons = [...stepsEl.querySelectorAll('.how-step')];
  const hudStep = document.querySelector('.how-hud-step'), hudText = document.querySelector('.how-hud-text');
  const NAMES = ['01 Place', '02 Verify', '03 Observe'];
  stepsEl.style.setProperty('--how-ms', STEP_MS + 'ms');
  let step = 0, stepT0 = performance.now(), onScreen = false;
  const setStep = (i, now = performance.now()) => {
    step = i; stepT0 = now;
    buttons.forEach((b, k) => {
      b.classList.toggle('is-on', k === i);
      b.setAttribute('aria-current', k === i ? 'step' : 'false');
      if (k === i) { b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; }
    });
    hudStep.textContent = NAMES[i];
  };
  buttons.forEach((b, i) => b.addEventListener('click', () => setStep(i)));
  setStep(0);

  const pulse = x => { const ph = x - Math.floor(x); return Math.exp(-(((ph - 0.16) / 0.06) ** 2)) + 0.3 * Math.exp(-(((ph - 0.42) / 0.09) ** 2)); };
  let lastText = '';
  const say = txt => { if (txt !== lastText) { lastText = txt; hudText.textContent = txt; } };

  stage(scene, (s, now) => {
    const { ctx, w, h } = s;
    const still = now === Infinity;
    if (!still && onScreen && now - stepT0 > STEP_MS) setStep((step + 1) % 3, now);
    const u = still ? 1 : clamp((now - stepT0) / STEP_MS, 0, 1);
    const T = still ? 20 : now / 1000;
    ctx.clearRect(0, 0, w, h);

    // Layout: monitor top-left, breadboard along the bottom, finger reaching
    // in from the top right.
    const boardW = Math.min(w * 0.74, 440), bx = (w - boardW) / 2, by = h * (w < 520 ? 0.7 : 0.74);
    const ex = bx + boardW * 0.7;                         // first electrode
    const narrow = w < 520;
    const mon = { x: w * 0.06, y: h * 0.07, w: w * (narrow ? 0.64 : 0.58), h: h * (narrow ? 0.36 : 0.4) };

    // Breadboard + controller + electrodes.
    ctx.fillStyle = 'rgba(246,239,231,0.88)';
    roundRect(ctx, bx, by, boardW, 26, 5); ctx.fill();
    ctx.fillStyle = 'rgba(20,16,12,0.25)';
    for (let i = 0; i < 26; i++) for (let j = 0; j < 2; j++) ctx.fillRect(bx + 12 + i * (boardW - 24) / 26, by + 8 + j * 8, 2, 2);
    ctx.fillStyle = '#2a2420'; roundRect(ctx, bx + boardW * 0.12, by - 9, 44, 12, 3); ctx.fill();
    ctx.fillStyle = `rgb(${C.pink})`; ctx.fillRect(bx + boardW * 0.12 + 6, by - 6, 4, 4);
    for (const dx of [0, 30]) {
      ctx.fillStyle = '#8f8a86'; roundRect(ctx, ex + dx - 11, by - 17, 22, 17, 6); ctx.fill();
      ctx.fillStyle = '#c9c4bf'; roundRect(ctx, ex + dx - 11, by - 17, 22, 5, 3); ctx.fill();
    }
    // Finger: reaches down onto the electrodes during "Place", rests after.
    const down = step === 0 ? ease(u / 0.45) : 1;
    const tipX = ex + 15, tipY = by - 19 - (1 - down) * h * 0.32;
    const baseX = w + 30, baseY = -40 - (1 - down) * h * 0.2;
    const ang = Math.atan2(tipY - baseY, tipX - baseX), len = Math.hypot(tipX - baseX, tipY - baseY), fw = 44;
    ctx.save();
    ctx.translate(tipX, tipY); ctx.rotate(ang + Math.PI);
    const skin = ctx.createLinearGradient(0, -fw / 2, 0, fw / 2);
    skin.addColorStop(0, '#d8ab90'); skin.addColorStop(1, '#a9755b');
    ctx.fillStyle = skin;
    roundRect(ctx, 0, -fw / 2, len + 40, fw, fw / 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,230,0.35)'; roundRect(ctx, 6, -fw / 2 + 7, 30, fw - 14, 9); ctx.fill();   // nail
    ctx.strokeStyle = 'rgba(90,50,35,0.35)'; ctx.lineWidth = 1.5;                                       // knuckle creases
    for (const k of [70, 76, 150, 156]) { ctx.beginPath(); ctx.moveTo(k, -fw / 2 + 8); ctx.lineTo(k, fw / 2 - 8); ctx.stroke(); }
    ctx.restore();
    const contact = step > 0 || u > 0.45;
    if (contact) {
      const a = step === 0 ? smooth(0.45, 0.6, u) : 1;
      ctx.strokeStyle = `rgba(${C.pink},${0.55 * a})`; ctx.lineWidth = 2;
      for (const dx of [0, 30]) { ctx.beginPath(); ctx.arc(ex + dx, by - 17, 12 + 5 * Math.sin(T * 6 + dx), Math.PI, 0); ctx.stroke(); }
    }

    // Monitor: three live traces, once the fingers are on.
    ctx.fillStyle = 'rgba(8,6,5,0.55)'; roundRect(ctx, mon.x, mon.y, mon.w, mon.h, 10); ctx.fill();
    const streamA = step === 0 ? smooth(0.5, 0.7, u) : 1;
    const traceW = mon.w * (step === 2 ? 0.66 : 0.94) - (step === 2 && narrow ? 24 : 0);
    const rows = [
      ['EDA', C.pink, x => 0.4 + 0.25 * noise(x * 3 + T * 0.4) + 0.1 * Math.sin(x * 9 + T)],
      ['TEMP', C.cream, x => 0.5 + 0.05 * Math.sin(x * 4 + T * 0.6)],
      ['PULSE', C.gold, x => 0.15 + 0.75 * pulse(x * 3.2 + T * 1.2)],
    ];
    rows.forEach(([name, col, fn], r) => {
      const ry = mon.y + 14 + r * (mon.h - 22) / 3, rh = (mon.h - 22) / 3 - 6;
      ctx.font = `10.5px ${MONO}`; ctx.fillStyle = `rgba(${C.cream},0.45)`; ctx.textAlign = 'left';
      ctx.fillText(name, mon.x + 10, ry + rh / 2 + 3);
      if (streamA <= 0) return;
      const x0 = mon.x + 56, x1 = mon.x + 56 + (traceW - 66) * streamA;
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const k = i / 80, x = x0 + (x1 - x0) * k;
        const y = ry + rh - clamp(fn(k), 0, 1) * rh;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = `rgba(${col},0.95)`; ctx.lineWidth = 1.6; ctx.stroke();
    });

    // Step 2: verify, a quality bar fills, then "still" ticks.
    if (step >= 1) {
      const q = step === 1 ? ease(u / 0.6) : 1;
      const vx = mon.x, vy = mon.y + mon.h + 14, vw = Math.min(200, mon.w * 0.6);
      ctx.font = `11px ${MONO}`; ctx.fillStyle = `rgba(${C.cream},0.6)`; ctx.textAlign = 'left';
      ctx.fillText('SIGNAL', vx, vy + 9);
      ctx.fillStyle = 'rgba(246,239,231,0.12)'; roundRect(ctx, vx + 58, vy + 2, vw, 8, 4); ctx.fill();
      ctx.fillStyle = `rgb(${C.green})`; roundRect(ctx, vx + 58, vy + 2, vw * q, 8, 4); ctx.fill();
      const stillA = step === 1 ? smooth(0.6, 0.75, u) : 1;
      if (stillA > 0) {
        ctx.globalAlpha = stillA * (step === 2 ? 0.55 : 1);
        ctx.fillStyle = `rgb(${C.green})`; ctx.font = `500 12.5px ${FONT}`;
        ctx.fillText('✓ Clean  ·  ✓ Sitting still', vx + 58, vy + 30);
        ctx.globalAlpha = 1;
      }
    }

    // Step 3: observe, a 60-second window, then the reading.
    if (step === 2) {
      const r = Math.min(mon.h * 0.26, 34), cx = mon.x + mon.w - r - 16, cy = mon.y + 12 + r;
      const k = ease(u / 0.8);
      ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(246,239,231,0.12)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgb(${C.gold})`; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillStyle = `rgb(${C.cream})`;
      ctx.font = `500 17px ${FONT}`; ctx.fillText(`${Math.round(60 * (1 - k))}s`, cx, cy + 6);
      const res = smooth(0.82, 0.92, u);
      if (res > 0) {
        ctx.globalAlpha = res;
        const pw = Math.min(104, mon.w * 0.36), px = cx - pw / 2, py = cy + r + 8;
        ctx.fillStyle = 'rgba(159,211,168,0.16)'; roundRect(ctx, px, py, pw, 26, 13); ctx.fill();
        ctx.fillStyle = `rgb(${C.green})`; ctx.font = `500 13px ${FONT}`; ctx.fillText('Baseline', cx, py + 17);
        ctx.globalAlpha = 1;
      }
      ctx.lineCap = 'butt';
    }
    say(step === 0 ? (contact ? 'Electrodes connected, signals streaming' : 'Fingertips on the electrodes')
      : step === 1 ? 'Checking the signal and that you’re still'
      : u > 0.85 ? 'Baseline, shown with the model’s confidence' : 'Watching a 60-second window');
  });
  new IntersectionObserver(es => {
    const was = onScreen;
    onScreen = es[es.length - 1].isIntersecting;
    if (onScreen && !was) setStep(0);
  }, { threshold: 0.3 }).observe(document.getElementById('howScene'));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* ---------- 6. FAQ ---------- */

for (const d of document.querySelectorAll('.faq-item')) {
  const sum = d.querySelector('summary'), ans = d.querySelector('.faq-a');
  let anim = null;
  sum.addEventListener('click', e => {
    if (reduced) return;
    e.preventDefault();
    anim?.cancel();
    const opts = { duration: 320, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' };
    if (d.open) {
      anim = ans.animate([{ height: ans.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }], opts);
      d.classList.add('is-closing');
      anim.onfinish = () => { d.open = false; d.classList.remove('is-closing'); anim = null; };
    } else {
      d.open = true;
      anim = ans.animate([{ height: '0px', opacity: 0 }, { height: ans.offsetHeight + 'px', opacity: 1 }], opts);
      anim.onfinish = () => { anim = null; };
    }
  });
}

/* ---------- Accurate in-page links ----------
   Sections further down render lazily (content-visibility), so their real
   height is only known once they scroll into view. A plain anchor jump aims
   at a stale position and stops short; this aims, checks where the target
   really landed, and corrects until it sits at the scroll padding. */

const padTop = () => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
let aimRun = 0;
function aimAt(el, smoothFirst, initial = false) {
  const run = ++aimRun;
  let tries = 0;
  // Opening the page at a link: the browser's own (smooth) fragment scroll is
  // still running and re-aims at a stale spot, so take over without easing.
  const started = performance.now();
  if (initial) document.documentElement.style.scrollBehavior = 'auto';
  // Render the lazy sections for a moment so every height is real before
  // aiming; their sizes are remembered afterwards, so nothing shifts later.
  const root = document.documentElement;
  root.classList.add('cv-open');
  void el.getBoundingClientRect();
  const done = () => {
    if (run === aimRun) root.classList.remove('cv-open');
    if (initial) document.documentElement.style.scrollBehavior = '';
  };
  let target = 0;
  const go = smoothNow => {
    const max = document.documentElement.scrollHeight - innerHeight;
    target = clamp(Math.round(el.getBoundingClientRect().top + scrollY - padTop()), 0, Math.max(0, max));
    scrollTo({ top: target, behavior: smoothNow ? 'smooth' : 'instant' });
  };
  const check = () => {
    if (run !== aimRun) { if (initial) document.documentElement.style.scrollBehavior = ''; return root.classList.remove('cv-open'); }
    // Someone else moved the page (scrollbar, keyboard, script): stop here.
    // (On first load the browser's own fragment scroll may still move it.)
    if (!initial && Math.abs(scrollY - target) > 4) { aimRun++; return root.classList.remove('cv-open'); }
    const off = el.getBoundingClientRect().top - padTop();
    if (Math.abs(off) <= 2 || tries >= (initial ? 10 : 6) || (initial && performance.now() - started > 1500)) return done();
    tries++;
    go(!reduced && Math.abs(off) < innerHeight * 1.5);
    settle(check);
  };
  go(smoothFirst && !reduced);
  settle(check);
}
// Calls back once scrolling has been still for a moment.
function settle(cb) {
  let last = scrollY, still = 0;
  const tick = () => {
    if (Math.abs(scrollY - last) < 1) { if (++still >= 6) return cb(); }
    else { still = 0; last = scrollY; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  const el = document.querySelector(id);
  if (!el) return;
  e.preventDefault();
  history.pushState(null, '', id);
  aimAt(el, true);
});
// Wheel or touch input from the visitor cancels any correction in progress.
for (const ev of ['wheel', 'touchstart', 'keydown']) addEventListener(ev, () => { aimRun++; document.documentElement.style.scrollBehavior = ''; document.documentElement.classList.remove('cv-open'); }, { passive: true });
if (location.hash.length > 1) {
  const el = document.querySelector(location.hash);
  if (el) {
    const start = () => aimAt(el, false, true);
    document.readyState === 'complete' ? start() : addEventListener('load', start, { once: true });
  }
}
// Back/forward between sections, or a hash typed into the address bar.
addEventListener('hashchange', () => {
  const el = location.hash.length > 1 && document.querySelector(location.hash);
  if (el) aimAt(el, false, true);
});
// Any direct input ends a correction at once.
addEventListener('pointerdown', () => { aimRun++; document.documentElement.style.scrollBehavior = ''; document.documentElement.classList.remove('cv-open'); }, { passive: true });

window.pathosStory = { get faqOpen() { return [...document.querySelectorAll('.faq-item')].filter(d => d.open).length; } };
