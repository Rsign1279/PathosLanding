/* ==========================================================================
   PATHOS hardware in 3D: scroll-driven playback of the Blender scene
   (deliverables/pathos-hardware/PATHOS_Hardware_Detail_1080p60.blend,
   exported to assets/pathos-hardware.glb by export_web.py).

   - Scroll position maps to a timeline frame (1..2880 at 60 fps). Each chapter
     gets a share of the scroll proportional to its length in the film, so
     the camera's quick moves between shots stay quick and the holds breathe.
   - The rendered frame eases toward the scroll target every animation frame,
     so scrubbing is smooth in both directions and stops when it arrives.
   - Titles are HTML, revealed on the exact frames the Blender HUD used; each
     part of a chapter's signal route lights when its pulse reaches it.
   - Renders only when something changed and only while the section is on
     screen; pixel ratio adapts if frames get slow.
   ========================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const FPS = 60, FIRST = 1, LAST = 2880;
const MODEL = './assets/pathos-hardware.glb';

const section = document.getElementById('prototype');
const track = document.getElementById('hwTrack');
const stage = document.getElementById('hwStage');
const view = document.getElementById('hwView');
const poster = document.getElementById('hwPoster');
const statusEl = document.getElementById('hwStatus');
const tip = document.getElementById('hwTip');
const rail = document.getElementById('hwRail');
const scrubEl = document.getElementById('hwScrub');
const frameEl = document.getElementById('hwFrame');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = x => x * x * (3 - 2 * x);

/* ---------- Chapters (from the HTML) ---------- */

const chapters = [...document.querySelectorAll('#hwHud .hw-chapter')].map((el, i) => ({
  el, i,
  start: +el.dataset.start,
  end: +el.dataset.end,
  // The final card appears later in its shot, exactly as in the film (frame 2598).
  in: el.classList.contains('hw-chapter--final') ? 2598 : +el.dataset.start,
  parts: [...el.querySelectorAll('[data-on]')].map(p => ({ el: p, on: +p.dataset.on, off: +p.dataset.off })),
}));
document.documentElement.classList.add('hw-js');

// Scroll share per chapter: proportional to its length, with a floor so short
// shots still get enough scroll to read their titles.
const weights = chapters.map(c => Math.max(220, c.end - c.start));
const totalW = weights.reduce((a, b) => a + b, 0);
const cum = weights.reduce((acc, w) => (acc.push(acc[acc.length - 1] + w / totalW), acc), [0]);

function frameAt(p) {
  p = clamp(p, 0, 1);
  let i = 0;
  while (i < chapters.length - 1 && p > cum[i + 1]) i++;
  const u = (p - cum[i]) / (cum[i + 1] - cum[i] || 1);
  const c = chapters[i];
  return clamp(c.start + u * (c.end - c.start), FIRST, LAST);
}
function progressAt(frame) {
  const i = Math.max(0, chapters.findIndex(c => frame >= c.start && frame < c.end));
  const c = chapters[i];
  return cum[i] + ((frame - c.start) / (c.end - c.start)) * (cum[i + 1] - cum[i]);
}
const scrollRange = () => Math.max(1, track.offsetHeight - stage.offsetHeight);
const scrollProgress = () => clamp(-track.getBoundingClientRect().top / scrollRange(), 0, 1);

/* ---------- Rail + scrubber ---------- */

const railButtons = chapters.map(c => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'hw-rail-btn';
  b.innerHTML = `<span class="n">${String(c.i + 1).padStart(2, '0')}</span><span class="l">${c.el.dataset.rail}</span>`;
  b.setAttribute('aria-label', `Chapter ${c.i + 1}: ${c.el.dataset.rail}`);
  b.addEventListener('click', () => {
    const p = progressAt(c.in + 24);
    const top = track.getBoundingClientRect().top + scrollY + p * scrollRange() + 1;
    scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
  });
  rail.appendChild(b);
  return b;
});
const scrub = scrubEl.parentElement;
chapters.slice(1).forEach(c => {
  const t = document.createElement('i');
  t.style.left = (progressAt(c.start) * 100).toFixed(2) + '%';
  scrub.appendChild(t);
});

/* ---------- HUD: frame-accurate titles ---------- */

let shownFrame = -1, activeChapter = -1;
function updateHud(f) {
  const fi = Math.round(f);
  if (fi === shownFrame) return;
  shownFrame = fi;
  frameEl.textContent = String(fi).padStart(4, '0');
  scrubEl.style.transform = `scaleX(${progressAt(f).toFixed(4)})`;

  let current = -1;
  for (const c of chapters) {
    const on = f >= c.in && f < c.end;
    if (on) current = c.i;
    if (!on) {
      if (c.el.classList.contains('is-on')) c.el.classList.remove('is-on');
      continue;
    }
    // --t: frames since the titles came in; --x: 1 → 0 over the last 12 frames.
    c.el.classList.add('is-on');
    c.el.style.setProperty('--t', Math.min(90, f - c.in).toFixed(1));
    c.el.style.setProperty('--x', clamp((c.end - 2 - f) / 12, 0, 1).toFixed(3));
    for (const part of c.parts) {
      const lit = f >= part.on;
      part.el.classList.toggle('is-lit', lit);
      part.el.classList.toggle('is-live', lit && f < Math.min(part.off, part.on + 70));
      part.el.style.setProperty('--p', clamp((f - part.on) / Math.max(1, part.off - part.on), 0, 1).toFixed(3));
    }
  }
  // The rail follows the shot, even while a chapter's titles are still hidden.
  const shot = chapters.findIndex(c => f >= c.start && f < c.end);
  if (shot !== -1) current = shot;
  if (current !== activeChapter) {
    activeChapter = current;
    railButtons.forEach((b, i) => b.classList.toggle('is-on', i === current));
    railButtons.forEach((b, i) => b.classList.toggle('is-past', i < current));
  }
}

/* ---------- Three.js ---------- */

const stats = { ready: false, frames: 0, drawCalls: 0, triangles: 0, quality: 0 };
let renderer, scene, camera, mixer, baseFov = 26, baseAspect = 16 / 9;
let cur = FIRST, tgt = FIRST, visible = false, dirty = true, raf = 0, last = 0, slow = 0, quality = 1;
const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
const qPar = new THREE.Quaternion(), ePar = new THREE.Euler();
const pickables = [];

const LABELS = {
  ESP32_S3: 'ESP32-S3 · controller',
  TMP117: 'TMP117 · skin temperature',
  ADS1115: 'ADS1115 · 16-bit ADC',
  MPU6050: 'MPU6050 · motion',
  MAX30102: 'MAX30102 · pulse and HRV',
  BME280: 'BME280 · environment',
  GSR_Module: 'GSR module · skin conductance',
  MicroSD_Breakout: 'microSD · local storage',
  Laptop: 'Laptop · PATHOS dashboard',
};

// Site palette for the scene's signal and studio materials.
const RECOLOUR = {
  'Signal • aqua': { color: 0xd2af70, emissive: 0xd2af70, intensity: 3.2 },   // gold: SDA / data
  'Signal • blue': { color: 0xf0a3bb, emissive: 0xf0a3bb, intensity: 3.0 },   // pink: SCL / clock
  'Signal • amber': { color: 0xeab873, emissive: 0xeab873, intensity: 2.6 },  // warm amber: SPI / analog
  'Studio charcoal': { color: 0x0f0c0a, roughness: 0.62, metalness: 0.05 },
  'Dashboard deep navy': { color: 0x0e0b09, emissive: 0x0e0b09, intensity: 0.5 },
  'Dashboard panel': { color: 0x1a1511, emissive: 0x1a1511, intensity: 0.5 },
};

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function fail(message) {
  statusEl.textContent = message;
  statusEl.classList.add('is-error');
  stage.classList.add('is-static');
  // Still let the titles follow the scroll over the poster.
  addEventListener('scroll', () => updateHud(frameAt(scrollProgress())), { passive: true });
  updateHud(frameAt(scrollProgress()));
}

function resize() {
  if (!renderer) return;
  const w = view.clientWidth, h = view.clientHeight;
  if (!w || !h) return;
  const mobile = innerWidth < 800;
  const dpr = Math.min(devicePixelRatio || 1, mobile ? 1.35 : 1.75) * quality;
  renderer.setPixelRatio(Math.max(1, dpr));
  renderer.setSize(w, h, false);
  const aspect = w / h;
  camera.aspect = aspect;
  // Keep the film's horizontal framing on narrower screens.
  const hHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov) / 2) * baseAspect);
  const fov = aspect < baseAspect ? 2 * Math.atan(Math.tan(hHalf) / aspect) : THREE.MathUtils.degToRad(baseFov);
  camera.fov = Math.min(68, THREE.MathUtils.radToDeg(fov));
  // Lift the subject above the titles on phones.
  if (mobile) camera.setViewOffset(w, h, 0, h * 0.2, w, h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  dirty = true;
  wake();
}

function apply(frame) {
  mixer.setTime(frame / FPS);
  if (parallax.x || parallax.y) {
    ePar.set(parallax.y, parallax.x, 0, 'YXZ');
    qPar.setFromEuler(ePar);
    camera.quaternion.multiply(qPar);
  }
  updateHud(frame);
}

function render(now) {
  raf = 0;
  if (!visible) return;
  const dt = Math.min(0.1, (now - (last || now)) / 1000);
  last = now;

  tgt = frameAt(scrollProgress());
  const k = reduced ? 1 : 1 - Math.exp(-dt * 11);
  cur += (tgt - cur) * k;
  if (Math.abs(tgt - cur) < 0.08) cur = tgt;
  parallax.x += (parallax.tx - parallax.x) * (reduced ? 1 : 1 - Math.exp(-dt * 6));
  parallax.y += (parallax.ty - parallax.y) * (reduced ? 1 : 1 - Math.exp(-dt * 6));
  const moving = cur !== tgt || Math.abs(parallax.tx - parallax.x) > 1e-4 || Math.abs(parallax.ty - parallax.y) > 1e-4;

  if (moving || dirty) {
    apply(cur);
    renderer.render(scene, camera);
    stats.frames++;
    stats.drawCalls = renderer.info.render.calls;
    stats.triangles = renderer.info.render.triangles;
    dirty = false;
    // Adaptive quality: drop the pixel ratio if frames stay slow.
    if (dt > 0.034) { if (++slow > 24 && quality > 0.6) { quality -= 0.2; slow = 0; resize(); } }
    else slow = Math.max(0, slow - 1);
  }
  if (moving) raf = requestAnimationFrame(render);
  else last = 0;
}
function wake() { if (!raf && visible) raf = requestAnimationFrame(render); }

async function init() {
  if (!window.WebGLRenderingContext) throw new Error('WebGL unavailable');
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e) { throw new Error('WebGL unavailable'); }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0f0c0a, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environmentIntensity = 0.42;

  // Studio lighting in the site palette: warm key, gold rim, faint pink kicker.
  const key = new THREE.DirectionalLight(0xfff1e0, 2.6);
  key.position.set(-0.35, 0.9, 0.55);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -0.45;
  key.shadow.camera.right = key.shadow.camera.top = 0.45;
  key.shadow.camera.near = 0.05; key.shadow.camera.far = 3;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.002; key.shadow.radius = 4;
  const rim = new THREE.DirectionalLight(0xd2af70, 1.6);
  rim.position.set(0.6, 0.35, -0.7);
  const kick = new THREE.DirectionalLight(0xf0a3bb, 0.55);
  kick.position.set(-0.8, 0.25, -0.4);
  const fill = new THREE.HemisphereLight(0xf3e9e1, 0x0f0c0a, 0.35);
  scene.add(key, key.target, rim, kick, fill);

  const draco = new DRACOLoader();
  draco.setDecoderPath('./assets/vendor/draco/');
  draco.setDecoderConfig({ type: 'wasm' });
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  const gltf = await loader.loadAsync(MODEL, e => {
    if (e.total) statusEl.textContent = `Loading the 3D model · ${Math.round((e.loaded / e.total) * 100)}%`;
  });
  draco.dispose();

  scene.add(gltf.scene);
  camera = gltf.cameras[0];
  if (!camera) throw new Error('Model has no camera');
  baseFov = camera.fov; baseAspect = camera.aspect || 16 / 9;
  camera.near = 0.004; camera.far = 20;

  const glow = glowTexture();
  gltf.scene.traverse(o => {
    if (LABELS[o.name]) pickables.push({ obj: o, label: LABELS[o.name] });
    if (!o.isMesh) return;
    const fx = /^(DataPulse__|WiFi_packet_|Highlight__)/.test(o.name);
    // Shape-keyed wires would need their morphs recomputed in the shadow pass too; skip them.
    o.castShadow = !fx && !o.morphTargetInfluences && !/Dark studio sweep/.test(o.name);
    o.receiveShadow = !fx;
    o.frustumCulled = !o.morphTargetInfluences;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      const r = RECOLOUR[m.name];
      if (r && !m.userData.recoloured) {
        m.userData.recoloured = true;
        if (r.color !== undefined) m.color.setHex(r.color);
        if (r.emissive !== undefined) { m.emissive.setHex(r.emissive); m.emissiveIntensity = r.intensity; }
        if (r.roughness !== undefined) m.roughness = r.roughness;
        if (r.metalness !== undefined) m.metalness = r.metalness;
      }
    }
    // Soft additive halo on travelling pulses and Wi-Fi packets.
    if (/^(DataPulse__|WiFi_packet_)/.test(o.name)) {
      o.geometry.computeBoundingSphere();
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glow, color: mat.emissive || mat.color, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85,
      }));
      const r = o.geometry.boundingSphere.radius * 7;
      s.scale.set(r, r, r);
      s.position.copy(o.geometry.boundingSphere.center);
      o.add(s);
    }
  });

  mixer = new THREE.AnimationMixer(gltf.scene);
  for (const clip of gltf.animations) {
    const a = mixer.clipAction(clip);
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.play();
  }

  view.appendChild(renderer.domElement);
  // Warm the GPU: compile shaders and upload geometry before the first scroll frame.
  apply(FIRST);
  renderer.compile(scene, camera);
  resize();
  new ResizeObserver(resize).observe(view);

  cur = tgt = frameAt(scrollProgress());
  apply(cur);
  renderer.render(scene, camera);
  stats.ready = true;
  stage.classList.add('is-ready');
  statusEl.hidden = true;

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) { dirty = true; wake(); }
  }, { rootMargin: '120px 0px' }).observe(stage);
  addEventListener('scroll', wake, { passive: true });

  // Pointer: gentle parallax + hover labels for the modules.
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), box = new THREE.Box3(), hit = new THREE.Vector3();
  let tipTimer = 0;
  view.addEventListener('pointermove', e => {
    const r = view.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
    if (!reduced) { parallax.tx = (0.5 - nx) * 0.045; parallax.ty = (0.5 - ny) * 0.03; wake(); }
    if (e.pointerType !== 'mouse' || tipTimer) return;
    tipTimer = requestAnimationFrame(() => {
      tipTimer = 0;
      ndc.set(nx * 2 - 1, -(ny * 2 - 1));
      ray.setFromCamera(ndc, camera);
      let best = null, bestD = Infinity;
      for (const p of pickables) {
        box.setFromObject(p.obj);
        if (ray.ray.intersectBox(box, hit)) {
          const d = hit.distanceTo(ray.ray.origin);
          if (d < bestD) { bestD = d; best = p; }
        }
      }
      if (best) {
        tip.textContent = best.label;
        tip.style.transform = `translate(${(e.clientX - r.left + 14).toFixed(0)}px, ${(e.clientY - r.top + 14).toFixed(0)}px)`;
        tip.hidden = false;
      } else tip.hidden = true;
    });
  });
  view.addEventListener('pointerleave', () => { parallax.tx = parallax.ty = 0; tip.hidden = true; wake(); });

  visible = true; wake();
}

updateHud(FIRST);
init().catch(err => {
  console.warn('PATHOS 3D fallback:', err.message);
  fail('The interactive model could not load, so this is a still of it. The titles still follow your scroll.');
});

window.pathosPrototype = {
  stats,
  get state() { return { frame: cur, target: tgt, chapter: activeChapter, visible, rendering: !!raf }; },
  frameAt, progressAt,
};
