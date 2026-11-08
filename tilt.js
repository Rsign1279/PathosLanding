/* ==========================================================================
   Marble cards you can turn in your hand.

   - Hover: the card leans a few degrees toward the cursor. The marble sits a
     little deeper than the card face, so it slides the other way (parallax),
     and a soft light rolls across it.
   - Drag: the card turns with your hand, further than hover allows, and when
     you let go it settles back on a spring with a small, natural overshoot.
     A quick flick carries its speed into the settle.
   - All motion is spring-driven (no CSS transitions to lag behind the pointer),
     runs on one shared animation frame only while something is moving, and
     touches only transform and opacity. At rest the inline transform is
     removed so text renders perfectly crisp.
   - Touch: a sideways drag turns the card; vertical scrolling is untouched.
   - Bigger panels tilt less, so wide cards don't swing their far edge.
   - Off for prefers-reduced-motion.
   ========================================================================== */

const SELECTOR = '.card, .panel, .callout, .is-isnt p, .shot:not(.fl-face)';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

const HOVER_DEG = 5;       // lean toward the cursor (for a ~360px card)
const DRAG_DEG = 24;       // how far a drag can turn it
const DRAG_GAIN = 0.16;    // degrees per pixel dragged
const DEPTH_PX = 1.1;      // marble parallax, px per degree of tilt
const THRESHOLD = 5;       // px before a press becomes a drag (clicks stay clicks)

// Spring tunings: [stiffness, damping]. Hover follows tightly with no wobble;
// release has a touch of bounce so it feels like a real card settling.
const FOLLOW = [260, 30];
const SETTLE = [170, 13];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const cards = new Map();
const active = new Set();
let raf = 0, last = 0;

function sizeFactor(el) {
  // Normalise to a ~360px card: a 1000px panel tilts about a third as much.
  const r = el.getBoundingClientRect();
  return clamp(360 / Math.max(r.width, r.height * 1.4, 1), 0.28, 1.15);
}

function state(el) {
  let s = cards.get(el);
  if (!s) {
    s = {
      el,
      rx: 0, ry: 0, vx: 0, vy: 0,          // rotation (deg) and velocity
      tx: 0, ty: 0,                        // target rotation
      lx: 50, ly: 50, lvx: 0, lvy: 0,      // light position (%) and velocity
      tlx: 50, tly: 50,
      glow: 0, tglow: 0,                   // light strength
      hover: false, drag: null, spring: FOLLOW, k: 1, live: false,
    };
    cards.set(el, s);
  }
  return s;
}

function aimFromPointer(s, e) {
  const r = s.el.getBoundingClientRect();
  const nx = clamp((e.clientX - r.left) / r.width, 0, 1);
  const ny = clamp((e.clientY - r.top) / r.height, 0, 1);
  s.tlx = nx * 100;
  s.tly = ny * 100;
  if (!s.drag) {
    const m = HOVER_DEG * s.k;
    s.ty = (nx - 0.5) * 2 * m;
    s.tx = -(ny - 0.5) * 2 * m;
  }
}

function wake(s) {
  active.add(s);
  if (!s.live) {
    s.live = true;
    s.el.classList.add('is-tilting');
  }
  if (!raf) { last = 0; raf = requestAnimationFrame(tick); }
}

function step(x, v, target, [k, c], dt) {
  v += (k * (target - x) - c * v) * dt;
  return [x + v * dt, v];
}

function tick(now) {
  const dt = Math.min(1 / 30, last ? (now - last) / 1000 : 1 / 60);
  last = now;
  for (const s of active) {
    // Two substeps keep the bouncy settle stable on slow frames.
    for (let i = 0; i < 2; i++) {
      const h = dt / 2;
      [s.rx, s.vx] = step(s.rx, s.vx, s.tx, s.spring, h);
      [s.ry, s.vy] = step(s.ry, s.vy, s.ty, s.spring, h);
      [s.lx, s.lvx] = step(s.lx, s.lvx, s.tlx, FOLLOW, h);
      [s.ly, s.lvy] = step(s.ly, s.lvy, s.tly, FOLLOW, h);
    }
    s.glow += (s.tglow - s.glow) * (1 - Math.exp(-dt * 10));

    const resting = !s.hover && !s.drag &&
      Math.abs(s.rx) + Math.abs(s.ry) < 0.02 && Math.abs(s.vx) + Math.abs(s.vy) < 0.05 && s.glow < 0.01;
    const el = s.el;
    if (resting) {
      el.style.transform = '';
      el.style.removeProperty('--tilt-x');
      el.style.removeProperty('--tilt-y');
      el.style.removeProperty('--light-x');
      el.style.removeProperty('--light-y');
      el.style.removeProperty('--light');
      el.classList.remove('is-tilting');
      s.live = false;
      s.rx = s.ry = s.vx = s.vy = 0;
      active.delete(s);
      continue;
    }
    const lift = s.drag ? 1.012 : 1;
    const persp = Math.round(Math.max(900, el.offsetWidth * 2.6));
    el.style.transform = `perspective(${persp}px) rotateX(${s.rx.toFixed(3)}deg) rotateY(${s.ry.toFixed(3)}deg) scale(${lift})`;
    // The marble lies deeper than the face: it slides against the tilt.
    el.style.setProperty('--tilt-x', (-s.ry * DEPTH_PX).toFixed(2) + 'px');
    el.style.setProperty('--tilt-y', (s.rx * DEPTH_PX).toFixed(2) + 'px');
    el.style.setProperty('--light-x', s.lx.toFixed(1) + '%');
    el.style.setProperty('--light-y', s.ly.toFixed(1) + '%');
    el.style.setProperty('--light', s.glow.toFixed(3));
  }
  raf = active.size ? requestAnimationFrame(tick) : 0;
}

function revealed(el) {
  // Wait for the scroll-in animation to finish owning the transform.
  return !el.matches('[data-reveal]:not(.in)');
}

function onEnter(e) {
  if (e.pointerType !== 'mouse' || !finePointer.matches) return;
  const s = state(e.currentTarget);
  if (!revealed(s.el)) return;
  s.k = sizeFactor(s.el);
  s.hover = true;
  s.spring = FOLLOW;
  s.tglow = 1;
  aimFromPointer(s, e);
  wake(s);
}

function onMove(e) {
  const s = cards.get(e.currentTarget);
  if (!s) return;
  if (s.drag && e.pointerId === s.drag.id) {
    const dx = e.clientX - s.drag.x, dy = e.clientY - s.drag.y;
    if (!s.drag.on) {
      if (Math.hypot(dx, dy) < THRESHOLD) return;
      // Touch: only a mostly-sideways drag turns the card; let vertical scroll be.
      if (e.pointerType !== 'mouse' && Math.abs(dy) > Math.abs(dx)) { s.drag = null; return; }
      s.drag.on = true;
      s.el.classList.add('is-dragging');
      try { s.el.setPointerCapture(e.pointerId); } catch (_) {}
      getSelection()?.removeAllRanges();
    }
    const m = DRAG_DEG * Math.max(0.55, s.k);
    s.ty = clamp(s.drag.ry + dx * DRAG_GAIN, -m, m);
    s.tx = clamp(s.drag.rx - dy * DRAG_GAIN, -m, m);
    s.spring = FOLLOW;
    s.tglow = 1;
    aimFromPointer(s, e);
    wake(s);
    return;
  }
  if (s.hover) { aimFromPointer(s, e); wake(s); }
}

function onDown(e) {
  if (e.button !== 0) return;
  const s = state(e.currentTarget);
  if (!revealed(s.el)) return;
  // Leave form fields and text inputs alone.
  if (e.target.closest('input, textarea, select')) return;
  s.k = sizeFactor(s.el);
  s.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, rx: s.rx, ry: s.ry, on: false };
}

function release(e) {
  const s = cards.get(e.currentTarget);
  if (!s || !s.drag || e.pointerId !== s.drag.id) return;
  const was = s.drag.on;
  s.drag = null;
  s.el.classList.remove('is-dragging');
  if (!was) return;
  // Settle: back to the hover lean if the pointer is still over it, else flat.
  s.spring = SETTLE;
  const over = e.type === 'pointerup' && e.pointerType === 'mouse' && s.el.matches(':hover');
  s.hover = over;
  if (over) aimFromPointer(s, e);
  else { s.tx = s.ty = 0; s.tglow = 0; s.tlx = s.tly = 50; }
  // A drag isn't a click: swallow the click that follows it.
  // The click (if any) fires right after pointerup, before this timeout runs,
  // so a later genuine click is never eaten.
  const swallow = ev => { ev.preventDefault(); ev.stopPropagation(); };
  s.el.addEventListener('click', swallow, { capture: true, once: true });
  setTimeout(() => s.el.removeEventListener('click', swallow, { capture: true }), 0);
  wake(s);
}

function onLeave(e) {
  const s = cards.get(e.currentTarget);
  if (!s || s.drag?.on) return;
  s.hover = false;
  s.spring = SETTLE;
  s.tx = s.ty = 0;
  s.tglow = 0;
  s.tlx = s.tly = 50;
  wake(s);
}

function init() {
  if (reduced.matches) return;
  document.documentElement.classList.add('has-tilt');
  for (const el of document.querySelectorAll(SELECTOR)) {
    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('dragstart', ev => ev.preventDefault());
  }
}

init();

window.pathosTilt = {
  get active() { return active.size; },
  state: el => { const s = cards.get(el); return s && { rx: s.rx, ry: s.ry, hover: s.hover, dragging: !!s.drag?.on, live: s.live }; },
};
