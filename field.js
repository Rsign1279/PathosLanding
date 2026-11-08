/* ==========================================================================
   In the field: scroll-driven photo deck.

   Scroll position picks a point along the deck. The mapping eases in and out
   of every card (zero speed at each whole card), so the deck naturally rests
   with one photo square to you, without hijacking the scroll. The rendered
   position follows on a lightly damped spring, which is what makes it feel
   fluid rather than stepped.

   Each card's offset d from the centre places it on a U: x = d * spread,
   y = -rise * d^2. It banks with the curve's tangent, sinks back in depth and
   turns about its vertical axis (60 degrees per card), so by its second step
   out it has flipped to show the marble back with its caption.

   Sideways drag (mouse or touch) swipes the deck: the page scroll follows the
   drag and settles on the nearest card, with the flick's speed carried over.
   Vertical touch scrolling is left to the browser. Renders only while moving
   and on screen; transform and opacity only.
   ========================================================================== */

const section = document.querySelector('section.field');
const track = document.getElementById('flTrack');
const stage = document.getElementById('flStage');
const cards = [...document.querySelectorAll('#flDeck .fl-card')];
const capEl = document.getElementById('flCaption');
const countEl = document.getElementById('flCount');
const prevBtn = document.getElementById('flPrev');
const nextBtn = document.getElementById('flNext');
const N = cards.length;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const TURN = 50;           // turn at the first neighbour (degrees)
const FLIP = 110;          // extra turn from the first to the second neighbour
const OUTER = 0.42;        // horizontal step beyond the first neighbour, in spreads
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const TAU = Math.PI * 2;

// Dwell curve: linear on average, flat at whole cards.
const dwell = f => f - Math.sin(TAU * f) / TAU;
function dwellInv(p) {
  // Newton's method on f - sin(2πf)/2π = p within one card.
  const i = Math.floor(p), t = p - i;
  let f = t;
  for (let k = 0; k < 8; k++) {
    const g = f - Math.sin(TAU * f) / TAU - t, dg = 1 - Math.cos(TAU * f);
    if (Math.abs(g) < 1e-6) break;
    f = clamp(f - g / Math.max(dg, 0.15), 0, 1);
  }
  return i + f;
}

// The stage pins `top` px below the viewport edge: the deck runs from the
// moment it pins to the moment it releases.
let pinTop = 0;
const scrollRange = () => Math.max(1, track.offsetHeight - stage.offsetHeight);
const trackTop = () => track.getBoundingClientRect().top + scrollY - pinTop;
function scrollToP(p) { return trackTop() + (dwellInv(clamp(p, 0, N - 1)) / (N - 1)) * scrollRange(); }
function targetP() {
  const s = clamp((pinTop - track.getBoundingClientRect().top) / scrollRange(), 0, 1) * (N - 1);
  const i = Math.min(Math.floor(s), N - 2);
  return i + dwell(s - i);
}

const meta = cards.map(li => {
  const [a, b] = getComputedStyle(li).getPropertyValue('--ar').split('/').map(Number);
  return {
    li,
    ar: a && b ? a / b : 0.8,
    face: li.querySelector('.fl-front'),
    back: li.querySelector('.fl-back'),
    o: '',
    title: li.querySelector('.shot-caption strong').textContent,
    desc: li.querySelector('.shot-caption-text > span').textContent,
    w: 0, h: 0,
  };
});

let L = { W: 1, H: 1, spread: 1, rise: 1, cy: 1, depth: 1 };
function layout() {
  pinTop = parseFloat(getComputedStyle(stage).top) || 0;
  const W = stage.clientWidth, H = stage.clientHeight;
  const phone = W < 700;
  const ui = phone ? 150 : 110;                  // room for the caption bar
  const cardH = Math.min(phone ? H * 0.5 : H * 0.58, 540);
  const maxW = Math.min(phone ? W * 0.8 : W * 0.4, 600);
  for (const m of meta) {
    let h = cardH, w = h * m.ar;
    if (w > maxW) { w = maxW; h = w / m.ar; }
    m.w = Math.round(w); m.h = Math.round(h);
    m.li.style.width = m.w + 'px';
    m.li.style.height = m.h + 'px';
    m.li.style.marginLeft = -m.w / 2 + 'px';
    m.li.style.marginTop = -m.h / 2 + 'px';
  }
  // Space cards from their real widths so neighbours sit beside the centre
  // card (a turned card shows about half its width) instead of cutting into it.
  const widest = Math.max(...meta.map(m => m.w));
  L = {
    W, H,
    spread: phone ? Math.max(W * 0.62, widest * 0.8) : widest * 0.8 + 64,
    rise: (phone ? 0.075 : 0.11) * H,
    cy: (H - ui) * 0.56,
    depth: phone ? 200 : 260,
  };
  dirty = true;
  wake();
}

/* ---------- State + render ---------- */

let p = 0, v = 0, tgt = 0, spin = 0, spinV = 0;
let raf = 0, last = 0, visible = false, dirty = true, shown = -1;
let drag = null;

function place() {
  for (let i = 0; i < N; i++) {
    const m = meta[i];
    const d = i - p, ad = Math.abs(d), sd = Math.sign(d);
    // Beyond the first neighbour, cards bunch toward the edges and climb the
    // arms of the U, so their flip happens on screen.
    const ax = ad <= 1 ? ad : 1 + (ad - 1) * OUTER;
    const x = sd * ax * L.spread;
    const y = -L.rise * d * d;
    const z = -ad * L.depth;
    // Bank with the curve's tangent at this point.
    const slope = (2 * L.rise * ad) / ((ad <= 1 ? 1 : OUTER) * L.spread);
    const bank = -sd * Math.atan(slope) * 180 / Math.PI;
    // Turn: 50 degrees at the first neighbour, through edge-on near 1.35,
    // to the marble back (160 degrees) at the second.
    const turn = ad <= 1 ? TURN * ad : TURN + (ad - 1) * FLIP;
    const ry = -sd * turn + (ad < 0.5 ? spin * (1 - ad * 2) : 0);
    const op = clamp((2.75 - ad) / 0.5, 0, 1);
    const li = m.li;
    if (op <= 0) {
      if (li.style.visibility !== 'hidden') li.style.visibility = 'hidden';
      continue;
    }
    if (li.style.visibility) li.style.visibility = '';
    li.style.transform =
      `translate3d(${x.toFixed(1)}px, ${(L.cy + y).toFixed(1)}px, ${z.toFixed(1)}px) rotateZ(${bank.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    // Fade on the faces, never on the card: opacity on a 3D container
    // flattens it and both sides would show. Also hide the hairline a card
    // makes in the instant it is edge-on.
    // How squarely the card faces the eye, from its real view direction
    // (the stage's perspective is 1500px from an origin 42% down).
    const r = ry * Math.PI / 180, b = bank * Math.PI / 180;
    const nx = Math.sin(r) * Math.cos(b), ny = Math.sin(r) * Math.sin(b), nz = Math.cos(r);
    const vx = x, vy = L.cy + y - L.H * 0.42, vz = z - 1500;
    const facing = Math.abs(nx * vx + ny * vy + nz * vz) / Math.hypot(vx, vy, vz);
    const edge = clamp((facing - 0.03) / 0.07, 0, 1);
    const o = (op * edge).toFixed(3);
    if (m.o !== o) { m.o = o; m.face.style.opacity = o; m.back.style.opacity = o; }
    li.style.zIndex = String(100 - Math.round(ad * 10));
    // Light catch strongest as the face turns through 30–60 degrees.
    const catchA = Math.sin(clamp(Math.abs(ry) / 90, 0, 1) * Math.PI);
    li.style.setProperty('--sheen', (Math.sign(ry) * 0.5).toFixed(2));
    li.style.setProperty('--sheen-a', (catchA * 0.9).toFixed(3));
    // Only the card facing you takes clicks and focus order priority.
    const ti = ad < 0.5 ? 0 : -1;
    if (m.face.tabIndex !== ti) m.face.tabIndex = ti;
  }
  const cur = clamp(Math.round(p), 0, N - 1);
  if (cur !== shown) {
    shown = cur;
    capEl.querySelector('strong').textContent = meta[cur].title;
    capEl.querySelector('span').textContent = meta[cur].desc;
    capEl.classList.remove('is-swap'); void capEl.offsetWidth; capEl.classList.add('is-swap');
    countEl.textContent = `${String(cur + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
    prevBtn.disabled = cur === 0;
    nextBtn.disabled = cur === N - 1;
  }
}

function tick(now) {
  raf = 0;
  const dt = Math.min(1 / 30, last ? (now - last) / 1000 : 1 / 60);
  last = now;
  tgt = drag?.on ? drag.p : targetP();
  // Lightly underdamped follow: quick, with a whisper of settle.
  const k = 170, c = 2 * Math.sqrt(k) * 0.86;
  for (let s = 0; s < 2; s++) {
    const h = dt / 2;
    v += (k * (tgt - p) - c * v) * h; p += v * h;
    spinV += (220 * (0 - spin) - 18 * spinV) * h; spin += spinV * h;
  }
  const moving = Math.abs(tgt - p) > 0.0005 || Math.abs(v) > 0.001 || Math.abs(spin) > 0.02 || Math.abs(spinV) > 0.05;
  if (!moving) { p = tgt; v = 0; spin = spinV = 0; }
  if (moving || dirty) { place(); dirty = false; }
  if ((moving || drag?.on) && visible) raf = requestAnimationFrame(tick);
  else last = 0;
}
function wake() { if (!raf && visible) raf = requestAnimationFrame(tick); }

/* ---------- Navigation ---------- */

function goTo(i, smooth = true) {
  i = clamp(i, 0, N - 1);
  scrollTo({ top: scrollToP(i) + 1, behavior: smooth && !reduced.matches ? 'smooth' : 'auto' });
}
prevBtn.addEventListener('click', () => goTo(Math.round(targetP()) - 1));
nextBtn.addEventListener('click', () => goTo(Math.round(targetP()) + 1));
// Keyboard focus on a card brings it to the centre.
meta.forEach((m, i) => m.face.addEventListener('focus', () => { if (Math.round(targetP()) !== i) goTo(i); }));
stage.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') { e.preventDefault(); nextBtn.click(); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); prevBtn.click(); }
});

/* ---------- Drag / swipe ---------- */

stage.addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.target.closest('.fl-nav')) return;
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, p0: targetP(), p: targetP(), on: false, t: performance.now(), lastX: e.clientX, vx: 0 };
});
stage.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.on) {
    if (Math.hypot(dx, dy) < 6) return;
    if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; }   // a vertical gesture is a scroll
    drag.on = true;
    stage.classList.add('is-dragging');
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  }
  const now = performance.now();
  const ddt = Math.max(1, now - drag.t);
  drag.vx = 0.75 * drag.vx + 0.25 * ((e.clientX - drag.lastX) / ddt);   // px per ms
  drag.t = now; drag.lastX = e.clientX;
  drag.p = clamp(drag.p0 - dx / L.spread, -0.35, N - 1 + 0.35);
  // The centre card twists a little with the hand.
  spin = clamp(dx * 0.06, -18, 18);
  wake();
});
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const was = drag.on, fling = drag.vx, at = drag.p;
  drag = null;
  stage.classList.remove('is-dragging');
  if (!was) return;
  // A quick flick steps one card in its direction from where you let go;
  // a slow release lands on the nearest card.
  const fast = Math.abs(fling) > 0.35;   // px per ms
  const i = clamp(fast ? (fling < 0 ? Math.ceil(at - 0.05) : Math.floor(at + 0.05)) : Math.round(at), 0, N - 1);
  spinV += -fling * 40;
  goTo(i);
  // A drag is not a tap: the click that follows it (same task) is ignored.
  justDragged = true;
  setTimeout(() => { justDragged = false; }, 0);
  wake();
}
// Tapping a side card brings it to the centre; tapping the centre card opens it.
let justDragged = false;
stage.addEventListener('click', e => {
  if (justDragged) { e.preventDefault(); e.stopImmediatePropagation(); return; }
  const li = e.target.closest('.fl-card');
  if (!li) return;
  const i = cards.indexOf(li);
  if (i !== Math.round(targetP())) { e.preventDefault(); e.stopImmediatePropagation(); goTo(i); }
}, { capture: true });
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
stage.addEventListener('dragstart', e => e.preventDefault());

/* ---------- Start ---------- */

function start() {
  if (reduced.matches) return;          // static grid of photos instead
  section.classList.add('is-live');
  layout();
  new ResizeObserver(layout).observe(stage);
  // Use the latest entry: a fast jump can queue several in one callback.
  new IntersectionObserver(entries => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) { dirty = true; wake(); }
  }, { rootMargin: '200px 0px' }).observe(stage);
  addEventListener('scroll', () => {
    if (!visible) {
      const r = stage.getBoundingClientRect();
      if (r.bottom > -200 && r.top < innerHeight + 200) visible = true;
    }
    wake();
  }, { passive: true });
  p = tgt = targetP();
  place();
}
start();

window.pathosField = {
  get state() { return { p, target: tgt, shown, visible, rendering: !!raf, dragging: !!drag?.on }; },
  get layout() { return L; },
  scrollToP, goTo, count: N,
};
