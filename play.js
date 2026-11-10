/* ==========================================================================
   Small interactive pieces that make the explanations tangible.

   - Live signal traces: each signal (pulse, skin conductance, skin
     temperature, motion, room) is drawn as a scrolling trace on a tiny
     canvas, in the shape that signal really has. Calm by default; "active"
     shows what changes under stress (or, for motion, while walking).
   - Signal explorer ("One reading can mean anything"): tap the signals you
     would see together and a meter reads the combination the way the copy
     explains it. Only heart rate + sweat + cold fingers while still lights it.
   - Model pipeline: the four steps run in sequence while on screen; hovering
     or focusing a step holds it.
   - Project log: a rail fills as you scroll and each milestone lights up.
   - Counters count up the first time they come into view.
   - Copy button for the contact email.
   Canvases only draw while visible; everything respects reduced motion.
   ========================================================================== */

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = x => 1 - Math.pow(1 - x, 3);

/* ---------- Signal shapes ---------- */

// Smooth value noise, deterministic in time so traces scroll consistently.
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const noise = t => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; };

// Photoplethysmogram beat: systolic peak, then the dicrotic notch and wave.
const beat = x => Math.exp(-(((x - 0.16) / 0.065) ** 2)) + 0.32 * Math.exp(-(((x - 0.44) / 0.09) ** 2));

// Each returns roughly 0..1 for time t (s), activity a (0 calm .. 1 active)
// and x, the position across the trace (0 oldest .. 1 now), for trends.
const SIGNALS = {
  hr(t, a) {
    const rate = 1.05 + a * 0.75;                       // ~63 to ~108 bpm
    const phase = t * rate + 0.08 * Math.sin(t * 0.9);  // a little variability
    return 0.18 + 0.62 * beat(phase - Math.floor(phase)) * (0.85 + 0.15 * noise(t * 0.7));
  },
  eda(t, a, x) {
    // Tonic level plus phasic responses (fast rise, slow decay). Under
    // stress the level climbs toward "now" and responses come more often.
    let v = 0.12 + 0.08 * noise(t * 0.15) + a * 0.3 * x;
    const gap = 2.6 - a * 1.3;
    for (let k = Math.floor(t / gap) - 4; k <= Math.floor(t / gap); k++) {
      const onset = k * gap + hash(k) * gap * 0.6;
      const dt = t - onset;
      if (dt > 0) v += (0.13 + a * 0.13) * (1 - Math.exp(-dt / 0.3)) * Math.exp(-dt / 1.8) * (0.6 + 0.8 * hash(k + 7));
    }
    return v;
  },
  temp(t, a, x) {
    // Skin temperature drifts slowly; under stress the fingers cool toward "now".
    const drift = 0.05 * (noise(t * 0.25) - 0.5) + 0.012 * Math.sin(t * 2.1);
    return 0.7 + drift - a * 0.48 * Math.pow(x, 1.15);
  },
  motion(t, a) {
    // Accelerometer: small jitter when still, steps (~1.9 Hz) when walking.
    const still = 0.04 * (noise(t * 9) - 0.5) + 0.02 * (noise(t * 23) - 0.5);
    const walk = a * (0.34 * Math.sin(t * Math.PI * 2 * 1.9) * (0.8 + 0.4 * noise(t * 3)) + 0.12 * (noise(t * 17) - 0.5));
    return 0.5 + still + walk;
  },
  env(t) {
    return 0.5 + 0.12 * Math.sin(t * 0.5) + 0.04 * (noise(t * 1.3) - 0.5);
  },
};

const COLORS = {
  calm: [210, 175, 112],      // gold
  active: [240, 163, 187],    // pink
  env: [159, 211, 168],       // the "working" green
};
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));

/* ---------- Trace renderer ---------- */

const traces = [];
function makeTrace(canvas, signal, getActive) {
  const tr = { canvas, ctx: canvas.getContext('2d'), signal, getActive, a: 0, visible: false, w: 0, h: 0, dpr: 1 };
  const size = () => {
    const r = canvas.getBoundingClientRect();
    tr.dpr = Math.min(2, devicePixelRatio || 1);
    tr.w = Math.max(1, Math.round(r.width)); tr.h = Math.max(1, Math.round(r.height));
    canvas.width = tr.w * tr.dpr; canvas.height = tr.h * tr.dpr;
    draw(tr, performance.now() / 1000);
  };
  new ResizeObserver(size).observe(canvas);
  traces.push(tr);
  return tr;
}

function draw(tr, t) {
  const { ctx, w, h, dpr } = tr;
  const fn = SIGNALS[tr.signal];
  if (!fn || !w) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const span = tr.signal === 'motion' ? 3 : tr.signal === 'hr' ? 4 : 9;   // seconds across the width
  const n = Math.min(160, Math.round(w / 2));
  const pad = 3;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    const v = clamp(fn(t - (1 - x) * span, tr.a, x), 0, 1);
    pts.push([x * w, pad + (1 - v) * (h - pad * 2)]);
  }
  const col = tr.signal === 'env' ? COLORS.env : mix(COLORS.calm, COLORS.active, tr.a);
  // Flat, faint fill under the line (no gradient).
  ctx.beginPath();
  ctx.moveTo(pts[0][0], h);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = `rgba(${col}, ${0.12 + tr.a * 0.08})`;
  ctx.fill();
  // The trace, one solid color.
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = `rgb(${col})`;
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // "Now" dot.
  const [lx, ly] = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(lx - 2, ly, 2.4, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${col})`;
  ctx.fill();
}

let raf = 0, last = 0;
function loop(now) {
  raf = 0;
  const dt = Math.min(0.1, last ? (now - last) / 1000 : 0.016);
  last = now;
  let any = false;
  for (const tr of traces) {
    if (!tr.visible) continue;
    any = true;
    const target = tr.getActive() ? 1 : 0;
    tr.a += (target - tr.a) * (1 - Math.exp(-dt * 4));
    draw(tr, now / 1000);
  }
  if (any) raf = requestAnimationFrame(loop);
  else last = 0;
}
const io = new IntersectionObserver(entries => {
  for (const e of entries) {
    const tr = traces.find(x => x.canvas === e.target);
    if (tr) tr.visible = e.isIntersecting;
  }
  if (!reduced && !raf && traces.some(x => x.visible)) raf = requestAnimationFrame(loop);
}, { rootMargin: '60px 0px' });

/* ---------- Signal explorer ---------- */

const sigCards = [...document.querySelectorAll('.sig-card')];
const meter = document.querySelector('.sig-meter');
const statement = meter && meter.nextElementSibling;
const selected = new Set();

const READINGS = {
  none: [0, 'Tap the signals you’d see together.', 'See how PATHOS reads the combination.'],
  motion: [0.1, 'Just moving.', 'Walking to class looks like this. On its own it isn’t a stress sign.'],
  motionMixed: [0.16, 'Moving explains most of this.', 'PATHOS waits until you’re still before it reads the body.'],
  one: [0.26, 'One signal on its own.', 'Could be coffee, a warm room or the stairs.'],
  two: [0.6, 'Two signals agree.', 'Worth watching, but not enough to call it.'],
  three: [1, 'All three, while sitting still.', 'That’s the pattern PATHOS flags as a much stronger sign.'],
};
function readMeter() {
  if (!meter) return;
  const body = ['hr', 'eda', 'temp'].filter(s => selected.has(s)).length;
  const moving = selected.has('motion');
  const key = !selected.size ? 'none' : moving ? (body ? 'motionMixed' : 'motion') : ['none', 'one', 'two', 'three'][body];
  const [fill, title, text] = READINGS[key];
  meter.style.setProperty('--fill', fill);
  meter.dataset.state = key;
  meter.querySelector('strong').textContent = title;
  meter.querySelector('span:not(.sig-meter-fill)').textContent = text;
  statement && statement.classList.toggle('is-lit', key === 'three');
}
for (const card of sigCards) {
  const sig = card.dataset.signal;
  const dot = document.createElement('span');
  dot.className = 'sig-dot';
  dot.setAttribute('aria-hidden', 'true');
  card.prepend(dot);
  const toggle = () => {
    selected.has(sig) ? selected.delete(sig) : selected.add(sig);
    card.setAttribute('aria-pressed', String(selected.has(sig)));
    readMeter();
    if (!raf && !reduced) raf = requestAnimationFrame(loop);
    if (reduced) traces.forEach(tr => { tr.a = tr.getActive() ? 1 : 0; draw(tr, 12); });
  };
  card.addEventListener('click', toggle);
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });
  const canvas = card.querySelector('.sig-trace');
  if (canvas) io.observe(makeTrace(canvas, sig, () => selected.has(sig)).canvas);
}
readMeter();

/* ---------- Sensor table traces ---------- */

for (const canvas of document.querySelectorAll('.sig-trace--row')) {
  const row = canvas.closest('.sensor-row');
  let hover = false;
  row.addEventListener('pointerenter', () => { hover = true; if (!raf && !reduced) raf = requestAnimationFrame(loop); });
  row.addEventListener('pointerleave', () => { hover = false; });
  // Hovering a row shows what that signal looks like when it reacts.
  io.observe(makeTrace(canvas, canvas.dataset.signal, () => hover && canvas.dataset.signal !== 'env').canvas);
}
if (reduced) requestAnimationFrame(() => traces.forEach(tr => draw(tr, 12)));

/* ---------- Model pipeline ---------- */

const pipe = document.querySelector('.pipeline');
if (pipe) {
  const steps = [...pipe.children];
  steps.forEach(li => {
    const bar = document.createElement('span');
    bar.className = 'step-bar';
    bar.setAttribute('aria-hidden', 'true');
    li.append(bar);
  });
  const STEP_MS = 1700;
  let cur = -1, timer = 0, held = false, onScreen = false;
  const show = i => {
    cur = i;
    steps.forEach((li, k) => {
      li.classList.toggle('is-active', k === i);
      li.classList.toggle('is-done', k < i);
    });
    // Restart the progress bar for the active step.
    const bar = steps[i].querySelector('.step-bar');
    bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';
  };
  const run = () => {
    clearTimeout(timer);
    if (held || !onScreen || reduced || document.hidden) return;
    show((cur + 1) % steps.length);
    timer = setTimeout(run, STEP_MS);
  };
  pipe.style.setProperty('--step-ms', STEP_MS + 'ms');
  steps.forEach((li, i) => {
    const hold = () => { held = true; clearTimeout(timer); show(i); pipe.classList.add('is-held'); };
    const release = () => { held = false; pipe.classList.remove('is-held'); timer = setTimeout(run, 900); };
    li.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hold(); });
    li.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') release(); });
    li.addEventListener('focusin', hold);
    li.addEventListener('focusout', release);
    li.tabIndex = 0;
  });
  new IntersectionObserver(es => {
    onScreen = es[es.length - 1].isIntersecting;
    if (onScreen && !reduced) { pipe.classList.add('is-running'); run(); }
    else clearTimeout(timer);
  }, { threshold: 0.35 }).observe(pipe);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); });
}

/* ---------- Project log rail ---------- */

const log = document.querySelector('.log');
if (log) {
  const rail = document.createElement('span');
  rail.className = 'log-rail';
  rail.setAttribute('aria-hidden', 'true');
  rail.innerHTML = '<span class="log-rail-fill"></span>';
  log.prepend(rail);
  const items = [...log.querySelectorAll('li')];
  let ticking = false;
  const update = () => {
    ticking = false;
    const line = innerHeight * 0.62;
    const r = log.getBoundingClientRect();
    log.style.setProperty('--fill', clamp((line - r.top) / Math.max(1, r.height), 0, 1).toFixed(4));
    for (const li of items) li.classList.toggle('is-reached', li.getBoundingClientRect().top + 26 < line);
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  new IntersectionObserver(es => {
    if (es[es.length - 1].isIntersecting) { addEventListener('scroll', onScroll, { passive: true }); update(); }
    else removeEventListener('scroll', onScroll);
  }, { rootMargin: '100px 0px' }).observe(log);
  update();
}

/* ---------- Counters ---------- */

const fmt = (v, d) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const counters = [...document.querySelectorAll('.count')];
if (!reduced) {
  const cio = new IntersectionObserver(es => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      cio.unobserve(e.target);
      const el = e.target, to = +el.dataset.count, d = +(el.dataset.decimals || 0), suf = el.dataset.suffix || '';
      const final = el.textContent;
      el.style.minWidth = el.offsetWidth + 'px';    // no reflow while digits change
      const t0 = performance.now();
      const tick = now => {
        const k = clamp((now - t0) / 1100, 0, 1);
        el.textContent = k < 1 ? fmt(to * ease(k), d) + suf : final;
        if (k < 1) requestAnimationFrame(tick);
        else el.style.minWidth = '';
      };
      requestAnimationFrame(tick);
    }
  }, { threshold: 1 });
  counters.forEach(c => cio.observe(c));
}

/* ---------- Copy email ---------- */

for (const btn of document.querySelectorAll('.copy-btn')) {
  const label = btn.querySelector('span');
  let t = 0;
  btn.addEventListener('click', async () => {
    const text = btn.dataset.copy;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; }
    catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.append(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (_) {}
      ta.remove();
    }
    label.textContent = ok ? 'Copied' : 'Press ⌘C';
    btn.classList.toggle('is-done', ok);
    btn.setAttribute('aria-label', ok ? 'Email address copied' : 'Copy email address');
    clearTimeout(t);
    t = setTimeout(() => { label.textContent = 'Copy'; btn.classList.remove('is-done'); btn.setAttribute('aria-label', 'Copy email address'); }, 1800);
  });
}

window.pathosPlay = { get selected() { return [...selected]; }, get traces() { return traces.length; } };
