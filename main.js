/* ==========================================================================
   PATHOS — page behaviour
   Small on purpose: nav menu, intro + scroll reveals, halftone hero art,
   device tilt, lightbox and the mailto contact form. The 3D prototype
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
const REPEL_RADIUS = 78;          // CSS px; matches the visible cursor ring

function halftone(canvas, data, from) {
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
  let running = false, displaced = false;

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    scale = w / data.w;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(data.h * scale * dpr);
  }

  function draw(progress) {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.clearRect(0, 0, data.w, data.h);
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
    let mx = -1e6, my = -1e6, R = 0;
    if (pointer.active) {
      const rect = canvas.getBoundingClientRect();
      const k = rect.width / data.w;               // CSS px per data unit (includes drift transform)
      R = REPEL_RADIUS / k;
      mx = (pointer.x - rect.left) / k;
      my = (pointer.y - rect.top) / k;
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
      vx[i] = (vx[i] - ox[i] * 0.055) * 0.78;
      vy[i] = (vy[i] - oy[i] * 0.055) * 0.78;
      ox[i] += vx[i];
      oy[i] += vy[i];
      if (Math.abs(ox[i]) > 0.05 || Math.abs(oy[i]) > 0.05 || Math.abs(vx[i]) > 0.02 || Math.abs(vy[i]) > 0.02) moving = true;
      else { ox[i] = oy[i] = vx[i] = vy[i] = 0; }
    }
    return moving;
  }

  function near() {
    if (!pointer.active) return false;
    const r = canvas.getBoundingClientRect();
    const m = REPEL_RADIUS;
    return pointer.x > r.left - m && pointer.x < r.right + m && pointer.y > r.top - m && pointer.y < r.bottom + m;
  }

  function frame(now) {
    const p = introDone ? 2 : (now - introStart) / 1000;
    if (!introDone && p >= 1.8) { introDone = true; canvas.classList.add('settled'); }
    displaced = (near() || displaced) ? physics() : false;
    draw(p);
    if (!introDone || displaced || near()) raf(frame);
    else running = false;
  }
  function wake() { if (!running) { running = true; raf(frame); } }

  size();
  if (reduceMotion) { draw(2); canvas.classList.add('settled'); }
  else wake();

  return {
    resize() { size(); draw(introDone ? 2 : 0); },
    poke() { if (!reduceMotion && (near() || displaced)) wake(); },
  };
}

async function initHalftones() {
  const hand = document.getElementById('htHand');
  const board = document.getElementById('htBoard');
  const hero = document.getElementById('hero');
  if (!hand || !board || !hero) return;

  // Pause the idle drift once the hero is off screen.
  new IntersectionObserver(([e]) => document.documentElement.classList.toggle('hero-off', !e.isIntersecting)).observe(hero);

  let arts = [];
  try {
    const [handData, boardData] = await Promise.all([
      loadDots('assets/halftone-hand.bin'),
      loadDots('assets/halftone-board.bin'),
    ]);
    arts = [halftone(hand, handData, 'left'), halftone(board, boardData, 'right')];
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

  // Cursor ring showing the repel radius (mouse/pen only).
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  ring.style.setProperty('--r', REPEL_RADIUS + 'px');
  ring.setAttribute('aria-hidden', 'true');
  document.body.appendChild(ring);

  let ringQueued = false;
  const placeRing = () => {
    ringQueued = false;
    ring.style.transform = `translate3d(${pointer.x - REPEL_RADIUS}px, ${pointer.y - REPEL_RADIUS}px, 0)`;
  };
  const move = (x, y) => {
    pointer.x = x; pointer.y = y; pointer.active = true;
    arts.forEach(a => a.poke());
    if (!ringQueued) { ringQueued = true; raf(placeRing); }
  };
  const leave = () => {
    pointer.active = false;
    ring.classList.remove('on');
    arts.forEach(a => a.poke());
  };

  // Track the pointer on the whole document: the hand hangs below the hero's
  // bottom edge, where the next section sits on top of it, so hero-only
  // listeners would miss the cursor there.
  const canvases = [hand, board];
  const overArt = (x, y) => {
    const pad = REPEL_RADIUS;
    if (canvases.some(c => {
      const r = c.getBoundingClientRect();
      return x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
    })) return true;
    const h = hero.getBoundingClientRect();
    return x >= h.left && x <= h.right && y >= h.top && y <= h.bottom;
  };

  document.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    if (overArt(e.clientX, e.clientY)) {
      move(e.clientX, e.clientY);
      ring.classList.add('on');
    } else if (pointer.active) {
      leave();
    }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { if (pointer.active) leave(); });
  // Touch: dragging a finger across the art parts the dots too (no ring).
  document.addEventListener('touchmove', e => {
    const t = e.touches[0];
    if (t && overArt(t.clientX, t.clientY)) move(t.clientX, t.clientY);
  }, { passive: true });
  document.addEventListener('touchend', () => { if (pointer.active) leave(); }, { passive: true });
  addEventListener('scroll', () => { if (pointer.active) arts.forEach(a => a.poke()); }, { passive: true });
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
  const shots = Array.from(device.querySelectorAll('.screen-shot'));
  const steps = Array.from(section.querySelectorAll('.step-btn'));
  const caps = Array.from(section.querySelectorAll('.device-caption'));
  const n = shots.length;
  let index = 0;

  function show(i) {
    if (i === index) return;
    index = i;
    shots.forEach((el, k) => el.classList.toggle('is-on', k === i));
    steps.forEach((el, k) => el.classList.toggle('is-on', k === i));
    caps.forEach((el, k) => el.classList.toggle('is-on', k === i));
  }

  // Scroll range during which the stage is pinned.
  const range = () => Math.max(1, section.offsetHeight - innerHeight);
  const progress = () => Math.min(1, Math.max(0, -section.getBoundingClientRect().top / range()));

  steps.forEach((btn, i) => btn.addEventListener('click', () => {
    const top = section.getBoundingClientRect().top + scrollY + range() * ((i + 0.5) / n);
    scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
  }));

  const smooth = t => t * t * (3 - 2 * t);
  const cur = { rx: 0, ry: 0, rz: 0, s: 1 };
  const tgt = { rx: 0, ry: 0, rz: 0, s: 1 };
  let running = false, visible = false;

  function computeTargets() {
    const rect = section.getBoundingClientRect();
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

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) onScroll(); },
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

/* ---------- Contact form (mailto) ---------- */

function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  const status = document.getElementById('formStatus');
  const fields = Array.from(form.querySelectorAll('input, textarea'));
  const show = (msg, type) => { status.textContent = msg; status.className = `form-status ${type}`; status.hidden = false; };

  form.addEventListener('submit', e => {
    e.preventDefault();
    const invalid = fields.filter(f => !f.checkValidity());
    fields.forEach(f => f.setAttribute('aria-invalid', String(!f.checkValidity())));
    if (invalid.length) {
      show('Please fill in every field with a valid email address.', 'error');
      invalid[0].focus();
      return;
    }
    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    const message = form.elements.message.value.trim();
    const subject = encodeURIComponent(`PATHOS inquiry from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
    location.href = `mailto:rahul@pathos.io?subject=${subject}&body=${body}`;
    show('Your email app should now be open with the message ready to send.', 'success');
    form.reset();
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
