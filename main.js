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

function halftone(canvas, data, from) {
  const ctx = canvas.getContext('2d');
  const n = data.count;
  // Pre-group dots by colour so each frame is one path per colour.
  const groups = data.palette.map(() => []);
  for (let i = 0; i < n; i++) groups[data.c[i]].push(i);

  // Each dot starts scattered off to one side and settles in, wrist/cable first.
  const sx = new Float32Array(n), sy = new Float32Array(n), delay = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = data.x[i] / data.w;
    const lead = from === 'left' ? t : 1 - t;
    sx[i] = (from === 'left' ? -1 : 1) * (120 + Math.random() * 420);
    sy[i] = (Math.random() - 0.5) * 260;
    delay[i] = lead * 0.55 + Math.random() * 0.25;
  }

  let scale = 1, dpr = 1;
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
    for (let g = 0; g < groups.length; g++) {
      const ids = groups[g];
      if (!ids.length) continue;
      ctx.fillStyle = data.palette[g];
      ctx.beginPath();
      for (let k = 0; k < ids.length; k++) {
        const i = ids[k];
        let px = data.x[i], py = data.y[i];
        if (progress < 1.8) {
          let t = (progress - delay[i]) / 1.0;
          t = t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
          if (t < 1) { px += sx[i] * (1 - t); py += sy[i] * (1 - t); }
          if (t === 0) continue;
        }
        ctx.moveTo(px + data.r[i], py);
        ctx.arc(px, py, data.r[i], 0, 6.2832);
      }
      ctx.fill();
    }
  }

  size();
  if (reduceMotion) { draw(2); canvas.classList.add('settled'); return { resize() { size(); draw(2); } }; }

  const t0 = performance.now();
  function frame(now) {
    const p = (now - t0) / 1000;
    draw(p);
    if (p < 1.8) raf(frame);
    else canvas.classList.add('settled');
  }
  raf(frame);
  return { resize() { size(); draw(2); } };
}

async function initHalftones() {
  const hand = document.getElementById('htHand');
  const board = document.getElementById('htBoard');
  if (!hand || !board) return;
  try {
    const [handData, boardData] = await Promise.all([
      loadDots('assets/halftone-hand.bin'),
      loadDots('assets/halftone-board.bin'),
    ]);
    const a = halftone(hand, handData, 'left');
    const b = halftone(board, boardData, 'right');
    let timer;
    addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { a.resize(); b.resize(); }, 120);
    }, { passive: true });
  } catch (err) {
    console.warn('Halftone art unavailable:', err.message);
  }

  // Gentle pointer parallax on desktop; the canvases are composited layers.
  if (reduceMotion || !matchMedia('(pointer: fine)').matches) return;
  const hero = document.getElementById('hero');
  let tx = 0, ty = 0, pending = false;
  hero.addEventListener('pointermove', e => {
    tx = (e.clientX / innerWidth - 0.5);
    ty = (e.clientY / innerHeight - 0.5);
    if (pending) return;
    pending = true;
    raf(() => {
      hand.style.translate = `${tx * 14}px ${ty * 10}px`;
      board.style.translate = `${tx * -14}px ${ty * -10}px`;
      pending = false;
    });
  });
}

/* ---------- Device tilt ---------- */

function initDevice() {
  const device = document.getElementById('device');
  if (!device) return;

  const io = new IntersectionObserver(([entry]) => {
    device.classList.toggle('live', entry.isIntersecting);
  });
  io.observe(device);

  if (reduceMotion) { device.style.transform = 'none'; return; }

  let ticking = false;
  function update() {
    ticking = false;
    const rect = device.getBoundingClientRect();
    const vh = innerHeight;
    if (rect.top > vh || rect.bottom < 0) return;
    const p = Math.min(1, Math.max(0, (vh - rect.top) / (vh * 0.75)));
    const e = 1 - Math.pow(1 - p, 2);
    device.style.transform = `perspective(1600px) rotateX(${(1 - e) * 16}deg) scale(${0.93 + e * 0.07})`;
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; raf(update); } }, { passive: true });
  addEventListener('resize', update, { passive: true });
  update();
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
