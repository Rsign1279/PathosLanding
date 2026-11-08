/* ==========================================================================
   PATHOS hardware in 3D: scroll-driven playback of the finished Blender film
   (deliverables/pathos-hardware/PATHOS_Final_Complete.blend, exported to
   assets/pathos-hardware.glb and a lighter assets/pathos-hardware-mobile.glb).

   - Scroll position maps to a film frame (1..2880 at 60 fps). Each shot gets a
     share of the scroll proportional to its length in the film.
   - The rendered frame eases toward the scroll target, so scrubbing is smooth
     in both directions and stops when it arrives.
   - The titles are HTML copies of the film's HUD, placed in the same 16:9
     frame and switched on the exact frames the film uses.
   - The film's node-based materials are rebuilt here: the MacBook screen steps
     through the four v1 screenshots on the film's frames, the wallpaper is the
     marble artwork, and the table carries the marble panel at the right edge
     of the frame during the opening and closing shots.
   - Renders only when something changed and only while on screen; pixel
     ratio adapts if frames get slow.
   ========================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const FPS = 60, FIRST = 1, LAST = 2880;
// The film's frame: 16:9 on a 36 mm-wide sensor.
const FILM_ASPECT = 16 / 9;
const MOBILE = innerWidth < 820 || matchMedia('(pointer: coarse)').matches;
const MODEL = MOBILE ? './assets/pathos-hardware-mobile.glb' : './assets/pathos-hardware.glb';
const SHOT = MOBILE ? '-sm' : '';
const PAGES = ['live-instrument', 'model-study', 'source-data', 'diagnostics'].map(p => `./assets/v1-${p}${SHOT}.webp`);
const MARBLE = MOBILE ? './assets/marble-sm.webp' : './assets/marble.webp';

const section = document.getElementById('prototype');
const track = document.getElementById('hwTrack');
const stage = document.getElementById('hwStage');
const view = document.getElementById('hwView');
const statusEl = document.getElementById('hwStatus');
const tip = document.getElementById('hwTip');
const rail = document.getElementById('hwRail');
const scrubEl = document.getElementById('hwScrub');
const frameEl = document.getElementById('hwFrame');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- Film timing (from the Blender file) ---------- */

// "Screen page" value on the MacBook display (constant interpolation).
const pageAt = f => (f >= 2163 && f < 2520 ? 3 : f >= 2092 && f < 2520 ? 2 : f >= 2020 && f < 2520 ? 1 : 0);
// The camera's focal length changes per shot (glTF can't carry lens animation).
const LENS = [[2519, 44], [2249, 43], [1949, 47], [1679, 42], [1499, 72], [1199, 52], [899, 55], [689, 62], [299, 52], [1, 44]];
const lensAt = f => LENS.find(([k]) => f >= k)[1];
// Vertical half-angle tangent for a lens on the film's 36 mm-wide sensor.
const tanHalf = lens => 18 / lens / FILM_ASPECT;
// "Artwork timing": the marble panel on the table, opening and closing shots only.
const artAt = f => (f <= 285 || f >= 2520 ? 1 : 0);

/* ---------- Chapters (from the HTML) ---------- */

const chapters = [...document.querySelectorAll('#hwHud .hw-chapter')].map((el, i) => ({
  el, i,
  shotStart: +el.dataset.shotStart,
  shotEnd: +el.dataset.shotEnd,
  start: +el.dataset.start,      // titles on (0 = this shot has no titles)
  end: +el.dataset.end,          // titles off
}));
document.documentElement.classList.add('hw-js');

// Scroll share per shot: proportional to its length, with a floor so short
// shots still get enough scroll to read their titles.
const weights = chapters.map(c => Math.max(220, c.shotEnd - c.shotStart));
const totalW = weights.reduce((a, b) => a + b, 0);
const cum = weights.reduce((acc, w) => (acc.push(acc[acc.length - 1] + w / totalW), acc), [0]);

function frameAt(p) {
  p = clamp(p, 0, 1);
  let i = 0;
  while (i < chapters.length - 1 && p > cum[i + 1]) i++;
  const u = (p - cum[i]) / (cum[i + 1] - cum[i] || 1);
  const c = chapters[i];
  return clamp(c.shotStart + u * (c.shotEnd - c.shotStart), FIRST, LAST);
}
function progressAt(frame) {
  let i = chapters.findIndex(c => frame >= c.shotStart && frame < c.shotEnd);
  if (i === -1) i = frame < FIRST + 1 ? 0 : chapters.length - 1;
  const c = chapters[i];
  return clamp(cum[i] + ((frame - c.shotStart) / (c.shotEnd - c.shotStart)) * (cum[i + 1] - cum[i]), 0, 1);
}
// The stage pins `top` px below the viewport edge, so the film runs from the
// moment it pins until the moment it releases.
let pinTop = parseFloat(getComputedStyle(stage).top) || 0;
addEventListener('resize', () => { pinTop = parseFloat(getComputedStyle(stage).top) || 0; });
const scrollRange = () => Math.max(1, track.offsetHeight - stage.offsetHeight);
const scrollProgress = () => clamp((pinTop - track.getBoundingClientRect().top) / scrollRange(), 0, 1);
const scrollYForFrame = f => track.getBoundingClientRect().top + scrollY - pinTop + progressAt(f) * scrollRange() + 1;

/* ---------- Rail + scrubber ---------- */

const railButtons = chapters.map(c => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'hw-rail-btn';
  b.innerHTML = `<span class="n">${String(c.i + 1).padStart(2, '0')}</span><span class="l">${c.el.dataset.rail}</span>`;
  b.setAttribute('aria-label', `Chapter ${c.i + 1}: ${c.el.dataset.rail}`);
  b.addEventListener('click', () => {
    // Land where the shot's titles are up (or a moment into a shot without titles).
    const f = c.start ? Math.min(c.start + 40, c.end - 12) : c.shotStart + 40;
    scrollTo({ top: scrollYForFrame(f), behavior: reduced ? 'auto' : 'smooth' });
  });
  rail.appendChild(b);
  return b;
});
const scrub = scrubEl.parentElement;
chapters.slice(1).forEach(c => {
  const t = document.createElement('i');
  t.style.left = (progressAt(c.shotStart) * 100).toFixed(2) + '%';
  scrub.appendChild(t);
});

/* ---------- HUD: frame-accurate titles ---------- */

let shownFrame = -1, activeChapter = -1;
function updateHud(f) {
  // The film evaluates whole frames; so do the titles and the screen.
  const fi = clamp(Math.round(f), FIRST, LAST);
  if (fi === shownFrame) return;
  shownFrame = fi;
  frameEl.textContent = String(fi).padStart(4, '0');
  scrubEl.style.transform = `scaleX(${progressAt(f).toFixed(4)})`;

  for (const c of chapters) {
    const on = c.start > 0 && fi >= c.start && fi < c.end;
    c.el.classList.toggle('is-on', on);
    if (!on) continue;
    // --t: frames since the titles came in; --x: 1 → 0 over the last 3 frames.
    c.el.style.setProperty('--t', Math.min(30, fi - c.start));
    c.el.style.setProperty('--x', clamp((c.end - fi) / 3, 0, 1).toFixed(3));
  }
  // The rail follows the shot.
  const current = chapters.findIndex(c => fi >= c.shotStart && fi < c.shotEnd);
  if (current !== activeChapter && current !== -1) {
    activeChapter = current;
    railButtons.forEach((b, i) => {
      b.classList.toggle('is-on', i === current);
      b.classList.toggle('is-past', i < current);
    });
  }
}

/* ---------- Film frame: where the 16:9 picture sits in the view ---------- */

// The whole film frame always stays in view (letterboxed by more of the
// table when the view is taller or wider than 16:9). On phones the picture
// is lifted so the titles fit underneath.
const film = { x: 0, y: 0, w: 1, h: 1, zoom: 1, lift: 0, compact: false };
const MAX_TAN = Math.tan(THREE.MathUtils.degToRad(84) / 2);
function layoutFilm(w, h) {
  const aspect = w / h;
  // How much taller the view's field is than the film's (1 when the view is
  // 16:9 or wider). The same for every lens, so the film frame never moves.
  film.zoom = Math.min(MAX_TAN / tanHalf(42), Math.max(1, FILM_ASPECT / aspect));
  const tH = 1, tW = FILM_ASPECT, tV = film.zoom;
  film.w = w * tW / (tV * aspect);
  film.h = h * tH / tV;
  // Too small for the film's own title sizes: stack the titles under the picture.
  film.compact = film.w < 880;
  view.classList.toggle('is-compact', film.compact);
  film.lift = film.compact ? Math.min(h * 0.2, Math.max(0, (h - film.h) / 2 - 8)) : 0;
  film.x = (w - film.w) / 2;
  film.y = (h - film.h) / 2 - film.lift;
  const s = view.style;
  s.setProperty('--fx', film.x.toFixed(1) + 'px');
  s.setProperty('--fy', film.y.toFixed(1) + 'px');
  s.setProperty('--fw', film.w.toFixed(1) + 'px');
  s.setProperty('--fh', film.h.toFixed(1) + 'px');
}
layoutFilm(view.clientWidth || 1, view.clientHeight || 1);

/* ---------- Three.js ---------- */

const stats = { ready: false, frames: 0, drawCalls: 0, triangles: 0, quality: 0, model: MODEL, page: 0 };
let renderer, scene, camera, mixer;
let cur = FIRST, tgt = FIRST, visible = false, dirty = true, raf = 0, last = 0, slow = 0, quality = 1;
const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
const qPar = new THREE.Quaternion(), ePar = new THREE.Euler();
const pickables = [];
const uFilm = { value: new THREE.Vector4(0, 0, 1, 1) }, uArt = { value: 1 };
let screenMat = null, pageTex = [], shownPage = -1;

const LABELS = {
  ESP32_S3: 'ESP32-S3 · controller',
  TMP117: 'TMP117 · skin temperature',
  ADS1115: 'ADS1115 · 16-bit ADC',
  MPU6050: 'MPU6050 · motion',
  MAX30102: 'MAX30102 · pulse and HRV',
  BME280: 'BME280 · environment',
  GSR_Module: 'GSR module · skin conductance',
  MicroSD_Breakout: 'microSD · local storage',
  Laptop: 'MacBook · PATHOS Stress-Lysis Monitor',
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
  const w = view.clientWidth, h = view.clientHeight;
  if (!w || !h) return;
  layoutFilm(w, h);
  if (!renderer) return;
  const dpr = Math.min(devicePixelRatio || 1, MOBILE ? 1.35 : 1.75) * quality;
  renderer.setPixelRatio(Math.max(1, dpr));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  setLens(lensAt(Math.round(cur)));
  if (film.lift) camera.setViewOffset(w, h, 0, film.lift, w, h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  // Film frame in drawing-buffer pixels, origin bottom-left (gl_FragCoord).
  const k = renderer.getDrawingBufferSize(new THREE.Vector2()).x / w;
  uFilm.value.set(film.x * k, (h - film.y - film.h) * k, film.w * k, film.h * k);
  stats.quality = quality;
  dirty = true;
  wake();
}

function showPage(n) {
  if (!screenMat) return;
  if (!pageTex[n]) n = 0;          // a later page still on its way: hold the first
  if (n === shownPage || !pageTex[n]) return;
  shownPage = stats.page = n;
  screenMat.map = pageTex[n];
  screenMat.color.setScalar(0.955); // emission + 4.5% glossy in the film
  screenMat.needsUpdate = true;
}

let shownLens = 0;
function setLens(lens) {
  shownLens = lens;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanHalf(lens) * film.zoom));
  camera.updateProjectionMatrix();
}

function apply(frame) {
  mixer.setTime(frame / FPS);
  const fi = Math.round(frame);
  if (lensAt(fi) !== shownLens) setLens(lensAt(fi));
  showPage(pageAt(fi));
  uArt.value = artAt(fi);
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

const texLoader = new THREE.TextureLoader();
function loadTexture(url, { flipY = false, wrap = THREE.ClampToEdgeWrapping } = {}) {
  return texLoader.loadAsync(url).then(t => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = flipY;
    t.wrapS = t.wrapT = wrap;
    t.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
    return t;
  });
}

// Light from the film's five disc area lights: position (Blender, Z up),
// aim direction, power in watts, colour.
const LIGHTS = [
  { name: 'Neutral overhead softbox', p: [-0.11, -0.07, 0.38], d: [0.271, 0.222, -0.937], w: 3.05, c: [1, 0.975, 0.94], shadow: true },
  { name: 'Warm edge reflector', p: [0.27, 0, 0.22], d: [-0.795, 0.147, -0.589], w: 1.0, c: [1, 0.94, 0.83] },
  { name: 'Soft front fill', p: [-0.18, -0.25, 0.14], d: [0.538, 0.777, -0.329], w: 0.79, c: [0.87, 0.925, 1] },
  { name: 'Display lid rim', p: [0.04, 0.48, 0.3], d: [0.119, -0.559, -0.82], w: 1.15, c: [0.88, 0.94, 1] },
  { name: 'Edge strip', p: [0.08, 0.3, 0.25], d: [-0.229, -0.716, -0.659], w: 0.95, c: [1, 0.85, 0.8] },
];
const LIGHT_SCALE = window.__hwTune?.light ?? 0.8;
const yUp = ([x, y, z]) => new THREE.Vector3(x, z, -y);

async function init() {
  if (!window.WebGLRenderingContext) throw new Error('WebGL unavailable');
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e) { throw new Error('WebGL unavailable'); }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // The film is graded with AgX at -0.12 EV.
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = Math.pow(2, -0.12);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x060607, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environmentIntensity = 0.22;

  for (const L of LIGHTS) {
    const pos = yUp(L.p), dir = yUp(L.d).normalize();
    const s = new THREE.SpotLight(new THREE.Color().setRGB(...L.c, THREE.LinearSRGBColorSpace), (L.w / Math.PI) * LIGHT_SCALE, 0, 1.3, 1, 2);
    s.name = L.name;
    s.position.copy(pos);
    s.target.position.copy(pos).addScaledVector(dir, 0.4);
    if (L.shadow) {
      s.castShadow = true;
      s.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
      s.shadow.camera.near = 0.05; s.shadow.camera.far = 2;
      s.shadow.focus = 0.62;
      s.shadow.bias = -0.0003; s.shadow.normalBias = 0.0015; s.shadow.radius = 5;
    }
    scene.add(s, s.target);
  }

  const draco = new DRACOLoader();
  draco.setDecoderPath('./assets/vendor/draco/');
  draco.setDecoderConfig({ type: 'wasm' });
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  // Model, first screenshot and the marble artwork load together.
  const [gltf, page0, marbleUV, marbleWin] = await Promise.all([
    loader.loadAsync(MODEL, e => {
      if (e.total) statusEl.textContent = `Loading the 3D model · ${Math.round((e.loaded / e.total) * 100)}%`;
    }),
    loadTexture(PAGES[0]),
    loadTexture(MARBLE),
    loadTexture(MARBLE, { flipY: true, wrap: THREE.MirroredRepeatWrapping }),
  ]);
  draco.dispose();
  pageTex[0] = page0;

  scene.add(gltf.scene);
  camera = gltf.cameras[0];
  if (!camera) throw new Error('Model has no camera');
  camera.near = 0.004; camera.far = 20;

  // MacBook wallpaper: the marble, with the film's mapping (u' = 0.865u + 0.067).
  marbleUV.repeat.set(0.8653846, 1);
  marbleUV.offset.set(0.0673077, 0);
  const wallpaper = new THREE.MeshBasicMaterial({ map: marbleUV, name: 'MacBook wallpaper' });
  screenMat = new THREE.MeshBasicMaterial({ color: 0x000000, name: 'PATHOS dashboard window' });

  // The table: near-black matte, with the marble panel in screen space at the
  // right of the frame (window x > 0.82, sampled at x - 0.107) while it's on.
  // The film's world is near black, so the table reflects only the lights.
  const T = window.__hwTune || {};
  const table = new THREE.MeshPhysicalMaterial({ name: 'Natural matte black tabletop', roughness: T.rough ?? 0.7, metalness: 0, specularIntensity: T.spec ?? 0.3, envMapIntensity: 0.05 });
  table.color.setRGB(0.0032, 0.0032, 0.0032, THREE.LinearSRGBColorSpace);
  table.onBeforeCompile = sh => {
    sh.uniforms.uMarble = { value: marbleWin };
    sh.uniforms.uFilm = uFilm;
    sh.uniforms.uArt = uArt;
    sh.fragmentShader = 'uniform sampler2D uMarble;\nuniform vec4 uFilm;\nuniform float uArt;\n' +
      sh.fragmentShader.replace('#include <opaque_fragment>', `
        vec2 wc = (gl_FragCoord.xy - uFilm.xy) / uFilm.zw;
        float px = 0.75 / uFilm.z;
        float art = uArt * smoothstep(0.82 - px, 0.82 + px, wc.x);
        if (art > 0.0) outgoingLight = mix(outgoingLight, texture2D(uMarble, vec2(wc.x - 0.107, wc.y)).rgb * 0.85, art);
        #include <opaque_fragment>`);
  };

  const glow = glowTexture();
  const found = { screen: false, wallpaper: false, table: false };
  gltf.scene.traverse(o => {
    if (LABELS[o.name]) pickables.push({ obj: o, label: LABELS[o.name] });
    if (!o.isMesh) return;
    // GLTFLoader turns spaces in node names into underscores; compare without them.
    const key = o.name.replace(/[\s_]+/g, ' ').trim();
    if (key === 'PATHOS dashboard • inset rounded window') { o.material = screenMat; found.screen = true; }
    else if (key === 'Liquid Retina active display') { o.material = wallpaper; found.wallpaper = true; }
    else if (key === 'Dark studio sweep') { o.material = table; found.table = true; }
    // Dark glossy parts (display glass, the notch, keys, epoxy) would mirror the
    // bright studio environment; in the film they only mirror a near-black world.
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m.isMeshStandardMaterial || m.userData.env) continue;
      m.userData.env = true;
      // Brushed-metal anisotropy needs mesh tangents the export doesn't carry;
      // without them it blows out to white, so render those parts isotropic.
      if (m.anisotropy) { m.anisotropy = 0; m.anisotropyMap = null; }
      if (/black|glass|epoxy|lens/i.test(m.name) && !/Midnight/.test(m.name)) m.envMapIntensity = 0.15;
      // Bare metals (RF shield, pins, solder) mirror the lights, not a bright room.
      else if (/shield|nickel|tin|solder|Brushed|springs/i.test(m.name)) m.envMapIntensity = window.__hwTune?.metal ?? 0.35;
    }
    const fx = /^(DataPulse__|WiFi_packet_|Highlight__)/.test(o.name);
    // Shape-keyed wires would need their morphs recomputed in the shadow pass too; skip them.
    o.castShadow = !fx && !o.morphTargetInfluences && o.material !== table && o.material !== screenMat && o.material !== wallpaper;
    o.receiveShadow = !fx && o.material !== screenMat && o.material !== wallpaper;
    o.frustumCulled = !o.morphTargetInfluences;
    // Soft additive halo on travelling pulses and Wi-Fi packets.
    if (/^(DataPulse__|WiFi_packet_)/.test(o.name)) {
      o.geometry.computeBoundingSphere();
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glow, color: mat.emissive || mat.color, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8,
      }));
      const r = o.geometry.boundingSphere.radius * 7;
      s.scale.set(r, r, r);
      s.position.copy(o.geometry.boundingSphere.center);
      o.add(s);
    }
  });
  stats.materials = found;
  if (!found.screen || !found.wallpaper || !found.table) console.warn('PATHOS 3D: film materials not found', found);

  mixer = new THREE.AnimationMixer(gltf.scene);
  for (const clip of gltf.animations) {
    const a = mixer.clipAction(clip);
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.play();
  }

  view.appendChild(renderer.domElement);
  resize();
  // Warm the GPU: compile shaders and upload geometry before the first scroll frame.
  apply(FIRST);
  renderer.compile(scene, camera);
  new ResizeObserver(resize).observe(view);

  cur = tgt = frameAt(scrollProgress());
  apply(cur);
  renderer.render(scene, camera);
  stats.ready = true;
  stage.classList.add('is-ready');
  statusEl.hidden = true;

  // The other three screenshots arrive in the background, well before the
  // laptop shot; the screen holds the first page until they do.
  PAGES.slice(1).forEach((url, i) => loadTexture(url).then(t => {
    pageTex[i + 1] = t;
    renderer.initTexture(t);
    shownPage = -1; dirty = true; wake();
  }).catch(() => {}));

  // Use the latest entry: a fast jump can queue several in one callback.
  new IntersectionObserver(entries => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) { dirty = true; wake(); }
  }, { rootMargin: '120px 0px' }).observe(stage);
  // Backstop for a missed observer callback: on scroll, confirm visibility directly.
  addEventListener('scroll', () => {
    if (!visible) {
      const r = stage.getBoundingClientRect();
      if (r.bottom > -120 && r.top < innerHeight + 120) { visible = true; dirty = true; }
    }
    wake();
  }, { passive: true });

  // Pointer: gentle parallax + hover labels for the modules.
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), box = new THREE.Box3(), hit = new THREE.Vector3();
  let tipTimer = 0;
  view.addEventListener('pointermove', e => {
    const r = view.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
    if (!reduced) { parallax.tx = (0.5 - nx) * 0.03; parallax.ty = (0.5 - ny) * 0.02; wake(); }
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
addEventListener('resize', () => { if (!renderer) layoutFilm(view.clientWidth || 1, view.clientHeight || 1); });
init().catch(err => {
  console.warn('PATHOS 3D fallback:', err.message);
  fail('The interactive model could not load, so this is a still of it. The titles still follow your scroll.');
});

window.pathosPrototype = {
  stats, film,
  get state() { return { frame: cur, target: tgt, chapter: activeChapter, visible, rendering: !!raf, page: shownPage, art: uArt.value }; },
  frameAt, progressAt, scrollProgress, scrollYForFrame,
};
