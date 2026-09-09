/* ==========================================================================
   PATHOS IoT — Full 3D Upgrade
   GPU Particles (Instanced + Shaders) + Procedural Hero Watch
   ========================================================================== */

// ==========================================================================
// GLOBAL THREE STATE
// ==========================================================================

let threeScene, threeCamera, threeRenderer;
let heroWatch, heroSensorNodes = [], heroDataParticles;
let animationId = null;
let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
let isThreeInitialized = false;
let scrollProgress = 0;
let gpuParticles, gpuParticleMaterial, gpuParticleGeometry;

// ==========================================================================
// SHADERS
// ==========================================================================

// `position`, `modelViewMatrix` and `projectionMatrix` are injected by
// THREE.ShaderMaterial — redeclaring them is a compile error.
const GPU_PARTICLE_VERTEX = `
attribute vec3 velocity;
attribute float size;
attribute float life;
attribute float delay;
attribute vec3 colorStart;
attribute vec3 colorEnd;

uniform float uTime;
uniform float uProgress;
uniform float uScrollY;
uniform vec2 uResolution;

varying float vLife;
varying vec3 vColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  float t = uTime + delay;
  
  // Base position with velocity
  vec3 pos = position + velocity * t;
  
  // Scroll-reactive vertical drift
  pos.y += uScrollY * 0.0001;
  
  // Noise-based organic movement
  float n = noise(vec2(pos.x * 0.01, pos.z * 0.01 + t * 0.1));
  pos.x += sin(t * 0.5 + n * 6.28) * 0.5;
  pos.z += cos(t * 0.5 + n * 6.28) * 0.5;
  
  // Life cycle
  float lifeCycle = mod(t * life, 1.0);
  vLife = 1.0 - smoothstep(0.0, 1.0, lifeCycle);
  
  // Fade in/out
  float alpha = vLife;
  if (lifeCycle < 0.1) alpha *= lifeCycle * 10.0;
  
  // Color interpolation
  vColor = mix(colorStart, colorEnd, lifeCycle);
  
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

  // Perspective-correct point size, applied once.
  float scaledSize = size * (1.0 + vLife * 0.5);
  gl_PointSize = scaledSize * (300.0 / max(-mvPosition.z, 1.0));
  gl_Position = projectionMatrix * mvPosition;
}
`;

const GPU_PARTICLE_FRAGMENT = `
varying float vLife;
varying vec3 vColor;

void main() {
  // Circular point with soft edge
  vec2 center = gl_PointCoord - 0.5;
  float dist = length(center);
  float alpha = smoothstep(0.5, 0.0, dist) * vLife;
  
  // Additive glow
  vec3 finalColor = vColor * (1.0 + (1.0 - dist) * 2.0);
  
  gl_FragColor = vec4(finalColor, alpha);
  if (alpha < 0.01) discard;
}
`;

const WATCH_VERTEX = `
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vUv;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const WATCH_FRAGMENT = `
uniform float uTime;
uniform vec3 uAccentColor;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vUv;

void main() {
  // Base material: dark metal
  vec3 baseColor = vec3(0.08, 0.08, 0.09);
  
  // Fresnel rim lighting
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0);
  
  // Subtle accent rim
  vec3 rimColor = uAccentColor * fresnel * 0.6;
  
  // Ambient
  vec3 color = baseColor + rimColor;
  
  // Subtle screen reflection on "display" area (top face)
  if (vNormal.y > 0.9 && vWorldPos.y > 0.0) {
    color = mix(color, vec3(0.02, 0.02, 0.03), 0.5);
    // Fake screen content - subtle grid
    float grid = step(0.95, fract(vUv.x * 20.0)) + step(0.95, fract(vUv.y * 20.0));
    color += uAccentColor * grid * 0.02;
  }
  
  // Band texture (side faces)
  if (abs(vNormal.y) < 0.3) {
    float bandPattern = sin(vWorldPos.x * 10.0 + uTime * 2.0) * 0.02;
    color += bandPattern;
  }
  
  gl_FragColor = vec4(color, 1.0);
}
`;

const SENSOR_NODE_VERTEX = `
attribute float uPulsePhase;
uniform float uTime;

varying float vPulse;

void main() {
  vPulse = sin(uTime * 3.0 + uPulsePhase) * 0.5 + 0.5;
  vec3 pos = position * (1.0 + vPulse * 0.3);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const SENSOR_NODE_FRAGMENT = `
uniform vec3 uColor;
varying float vPulse;

void main() {
  float alpha = 0.6 + vPulse * 0.4;
  gl_FragColor = vec4(uColor, alpha);
}
`;

const DATA_STREAM_VERTEX = `
attribute float uProgress;
uniform float uTime;

varying float vProgress;

void main() {
  vProgress = uProgress;
  vec3 pos = position;
  // Animate along path
  pos.y += sin(uProgress * 3.14159 + uTime * 2.0) * 0.05;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const DATA_STREAM_FRAGMENT = `
uniform vec3 uColor;
varying float vProgress;

void main() {
  float alpha = smoothstep(0.0, 0.1, vProgress) * smoothstep(1.0, 0.9, vProgress);
  alpha *= 0.8;
  gl_FragColor = vec4(uColor, alpha);
}
`;

// ==========================================================================
// INIT THREE + GPU PARTICLES
// ==========================================================================

async function initThree() {
  if (isThreeInitialized) return;
  
  try {
    const THREE = await import('three');
    
    const container = document.getElementById('canvas-container');
    if (!container) return;
    
    // Scene
    threeScene = new THREE.Scene();
    
    // Camera
    threeCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
    threeCamera.position.set(0, 0, 60);
    
    // Renderer
    threeRenderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true, 
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });
    threeRenderer.setSize(window.innerWidth, window.innerHeight);
    threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    threeRenderer.toneMappingExposure = 1.0;
    container.appendChild(threeRenderer.domElement);
    
    // ===== GPU PARTICLES (25k instanced) =====
    await initGPUParticles(THREE);
    
    // ===== HERO WATCH =====
    await initHeroWatch(THREE);
    
    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    threeScene.add(ambient);
    
    const keyLight = new THREE.DirectionalLight(0xffffee, 1.2);
    keyLight.position.set(10, 20, 15);
    threeScene.add(keyLight);
    
    const rimLight = new THREE.DirectionalLight(0xffd600, 0.3);
    rimLight.position.set(-15, 5, -10);
    threeScene.add(rimLight);
    
    // Resize
    window.addEventListener('resize', onThreeResize);
    document.addEventListener('mousemove', onMouseMove);
    
    animateThree();
    isThreeInitialized = true;
    
  } catch (err) {
    console.warn('Three.js init failed:', err);
  }
}

async function initGPUParticles(THREE) {
  // Point sprites rather than instanced quads: gl_PointSize only applies to
  // THREE.Points, and one vertex per particle is cheaper than six.
  const COUNT = 25000;

  gpuParticleGeometry = new THREE.BufferGeometry();

  // Per-particle attributes
  const positions = new Float32Array(COUNT * 3);
  const velocities = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  const lives = new Float32Array(COUNT);
  const delays = new Float32Array(COUNT);
  const colorStarts = new Float32Array(COUNT * 3);
  const colorEnds = new Float32Array(COUNT * 3);
  
  const accent = new THREE.Color(0xffd600);
  const accentDim = new THREE.Color(0xe6c200);
  const white = new THREE.Color(0xffffff);
  
  for (let i = 0; i < COUNT; i++) {
    // Spherical distribution
    const radius = 15 + Math.random() * 80;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
    
    // Velocity - slow outward + orbital
    velocities[i * 3] = (Math.random() - 0.5) * 0.02;
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    
    sizes[i] = 0.5 + Math.random() * 1.5;
    lives[i] = 0.3 + Math.random() * 0.7;
    delays[i] = Math.random() * 100;
    
    // Color variation
    const colorMix = Math.random();
    colorStarts[i * 3] = accent.r * colorMix + white.r * (1 - colorMix);
    colorStarts[i * 3 + 1] = accent.g * colorMix + white.g * (1 - colorMix);
    colorStarts[i * 3 + 2] = accent.b * colorMix + white.b * (1 - colorMix);
    
    colorEnds[i * 3] = accentDim.r;
    colorEnds[i * 3 + 1] = accentDim.g;
    colorEnds[i * 3 + 2] = accentDim.b;
  }
  
  gpuParticleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  gpuParticleGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
  gpuParticleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  gpuParticleGeometry.setAttribute('life', new THREE.BufferAttribute(lives, 1));
  gpuParticleGeometry.setAttribute('delay', new THREE.BufferAttribute(delays, 1));
  gpuParticleGeometry.setAttribute('colorStart', new THREE.BufferAttribute(colorStarts, 3));
  gpuParticleGeometry.setAttribute('colorEnd', new THREE.BufferAttribute(colorEnds, 3));
  
  gpuParticleMaterial = new THREE.ShaderMaterial({
    vertexShader: GPU_PARTICLE_VERTEX,
    fragmentShader: GPU_PARTICLE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uScrollY: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    }
  });
  
  gpuParticles = new THREE.Points(gpuParticleGeometry, gpuParticleMaterial);
  gpuParticles.rotation.order = 'YXZ';
  threeScene.add(gpuParticles);
}

async function initHeroWatch(THREE) {
  heroWatch = new THREE.Group();
  
  // Watch materials
  const watchMaterial = new THREE.ShaderMaterial({
    vertexShader: WATCH_VERTEX,
    fragmentShader: WATCH_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uAccentColor: { value: new THREE.Color(0xffd600) }
    }
  });
  
  // Watch case (rounded rectangle)
  const caseGeo = new THREE.BoxGeometry(3.2, 4.0, 1.0, 8, 8, 4);
  const caseMesh = new THREE.Mesh(caseGeo, watchMaterial);
  caseMesh.position.y = 0;
  heroWatch.add(caseMesh);
  
  // Crown
  const crownGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.6, 8);
  const crownMesh = new THREE.Mesh(crownGeo, watchMaterial);
  crownMesh.position.set(1.8, 0.5, 0);
  crownMesh.rotation.z = -Math.PI / 2;
  heroWatch.add(crownMesh);
  
  // Band - top
  const bandGeo = new THREE.BoxGeometry(3.6, 1.5, 0.6, 4, 2, 2);
  const bandTop = new THREE.Mesh(bandGeo, watchMaterial);
  bandTop.position.set(0, -3.2, 0);
  heroWatch.add(bandTop);
  
  // Band - bottom
  const bandBottom = new THREE.Mesh(bandGeo, watchMaterial);
  bandBottom.position.set(0, -5.5, 0);
  heroWatch.add(bandBottom);
  
  // Band connector (curved)
  const connectorGeo = new THREE.TorusGeometry(0.8, 0.3, 4, 16, Math.PI);
  const connectorTop = new THREE.Mesh(connectorGeo, watchMaterial);
  connectorTop.position.set(0, -2.4, 0);
  connectorTop.rotation.x = Math.PI / 2;
  heroWatch.add(connectorTop);
  
  const connectorBottom = new THREE.Mesh(connectorGeo, watchMaterial);
  connectorBottom.position.set(0, -6.3, 0);
  connectorBottom.rotation.x = -Math.PI / 2;
  heroWatch.add(connectorBottom);
  
  // Sensor nodes (6 positions around watch)
  const sensorPositions = [
    { x: -1.3, y: 1.5, z: 0.6 },   // top-left
    { x: 1.3, y: 1.5, z: 0.6 },    // top-right
    { x: -1.3, y: -1.0, z: 0.6 },  // mid-left
    { x: 1.3, y: -1.0, z: 0.6 },   // mid-right
    { x: 0, y: 2.2, z: 0.6 },      // top-center
    { x: 0, y: -2.2, z: 0.6 },     // bottom-center
  ];
  
  const sensorColors = [
    0x00ff88,  // EDA - green
    0xff3366,  // HR - red
    0xffaa00,  // Temp - amber
    0x00aaff,  // Motion - blue
    0xffd600,  // Env - yellow
    0xaa44ff,  // HRV - purple
  ];
  
  const sensorGeometry = new THREE.SphereGeometry(0.15, 16, 12);
  
  sensorPositions.forEach((pos, i) => {
    const sensorMat = new THREE.ShaderMaterial({
      vertexShader: SENSOR_NODE_VERTEX,
      fragmentShader: SENSOR_NODE_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(sensorColors[i]) }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    
    const sensor = new THREE.Mesh(sensorGeometry, sensorMat);
    sensor.position.set(pos.x, pos.y, pos.z);
    sensor.userData = { pulsePhase: i * 1.0 };
    heroWatch.add(sensor);
    heroSensorNodes.push(sensor);
  });
  
  // Data stream particles (flowing from sensors to center)
  const streamCount = 200;
  const streamGeo = new THREE.BufferGeometry();
  const streamPositions = new Float32Array(streamCount * 3);
  const streamProgress = new Float32Array(streamCount);
  
  for (let i = 0; i < streamCount; i++) {
    const sensorIdx = Math.floor(Math.random() * sensorPositions.length);
    const sp = sensorPositions[sensorIdx];
    streamPositions[i * 3] = sp.x + (Math.random() - 0.5) * 0.2;
    streamPositions[i * 3 + 1] = sp.y + (Math.random() - 0.5) * 0.2;
    streamPositions[i * 3 + 2] = sp.z + (Math.random() - 0.5) * 0.2;
    streamProgress[i] = Math.random();
  }
  
  streamGeo.setAttribute('position', new THREE.BufferAttribute(streamPositions, 3));
  streamGeo.setAttribute('uProgress', new THREE.BufferAttribute(streamProgress, 1));
  
  const streamMat = new THREE.ShaderMaterial({
    vertexShader: DATA_STREAM_VERTEX,
    fragmentShader: DATA_STREAM_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xffd600) }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  
  heroDataParticles = new THREE.Points(streamGeo, streamMat);
  heroWatch.add(heroDataParticles);
  
  // Position watch in hero area
  heroWatch.position.set(0, 0, 0);
  heroWatch.rotation.x = -0.3;
  heroWatch.rotation.y = 0.4;
  heroWatch.scale.setScalar(2.5);
  
  threeScene.add(heroWatch);
}

function onThreeResize() {
  if (!threeCamera || !threeRenderer) return;
  threeCamera.aspect = window.innerWidth / window.innerHeight;
  threeCamera.updateProjectionMatrix();
  threeRenderer.setSize(window.innerWidth, window.innerHeight);
  threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  if (gpuParticleMaterial) {
    gpuParticleMaterial.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  }
}

function onMouseMove(e) {
  mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
}

function animateThree() {
  if (!threeScene || !threeRenderer || !threeCamera) return;
  
  animationId = requestAnimationFrame(animateThree);
  // The opaque sections hide the decorative hero scene; spare the GPU there.
  if (document.querySelector('#hero').getBoundingClientRect().bottom < 0) return;
  
  const time = performance.now() * 0.001;
  
  // Smooth mouse follow
  targetX += (mouseX - targetX) * 0.02;
  targetY += (mouseY - targetY) * 0.02;
  
  // Camera parallax
  threeCamera.position.x += (targetX * 5 - threeCamera.position.x) * 0.02;
  threeCamera.position.y += (-targetY * 5 - threeCamera.position.y) * 0.02;
  threeCamera.lookAt(0, 0, 0);
  
  // GPU particles
  if (gpuParticleMaterial) {
    gpuParticleMaterial.uniforms.uTime.value = time;
    gpuParticleMaterial.uniforms.uScrollY.value = window.scrollY;
    gpuParticleMaterial.uniforms.uProgress.value = scrollProgress;
    
    // Slow rotation
    gpuParticles.rotation.y += 0.00005;
    gpuParticles.rotation.x += 0.00002;
  }
  
  // Hero watch
  if (heroWatch) {
    heroWatch.rotation.y += 0.001;
    heroWatch.rotation.x = -0.3 + Math.sin(time * 0.5) * 0.05;
  }
  
  // Sensor nodes
  heroSensorNodes.forEach((node, i) => {
    if (node.material.uniforms) {
      node.material.uniforms.uTime.value = time;
    }
  });
  
  // Data streams
  if (heroDataParticles && heroDataParticles.material.uniforms) {
    heroDataParticles.material.uniforms.uTime.value = time;
    // Cycle progress
    const progressAttr = heroDataParticles.geometry.attributes.uProgress;
    const array = progressAttr.array;
    for (let i = 0; i < array.length; i++) {
      array[i] = (array[i] + 0.003) % 1.0;
    }
    progressAttr.needsUpdate = true;
  }
  
  // Update watch shader time
  heroWatch.traverse(obj => {
    if (obj.isMesh && obj.material.uniforms?.uTime) {
      obj.material.uniforms.uTime.value = time;
    }
  });
  
  threeRenderer.render(threeScene, threeCamera);
}

// ==========================================================================
// SCROLL PROGRESS (for GPU particles)
// ==========================================================================

function initScrollProgress() {
  const progressBar = document.getElementById('scrollProgress');
  let ticking = false;

  function update() {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = docHeight > 0 ? Math.min(window.scrollY / docHeight, 1) : 0;

    if (progressBar) {
      progressBar.style.transform = `scaleX(${scrollProgress})`;
    }
    ticking = false;
  }

  // Coalesce scroll events into one write per frame so the bar never fights
  // the browser's own paint scheduling.
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });

  update();
}

// ==========================================================================
// MOTION PREFERENCE
// ==========================================================================

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const prefersReducedMotion = () => reducedMotionQuery.matches;

// ==========================================================================
// INTERSECTION OBSERVER (reveals)
// ==========================================================================

const observerOptions = {
  root: null,
  // Start the reveal slightly before the element reaches the fold so it is
  // already settling by the time it is comfortably in view.
  rootMargin: '0px 0px -12% 0px',
  threshold: 0.12
};

const scrollObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;

    const el = entry.target;
    el.classList.add('visible');
    scrollObserver.unobserve(el);

    // Drop the compositor hint once the entrance has finished so long pages
    // don't hold hundreds of promoted layers.
    const delayMs = parseFloat(getComputedStyle(el).transitionDelay) * 1000 || 0;
    setTimeout(() => el.classList.add('settled'), 950 + delayMs);
  });
}, observerOptions);

// Children of a [data-stagger] container inherit an incremental delay so groups
// cascade instead of arriving as a single block.
function applyStagger() {
  document.querySelectorAll('[data-stagger]').forEach(container => {
    const step = parseInt(container.dataset.stagger, 10) || 70;
    Array.from(container.children).forEach((child, i) => {
      child.style.setProperty('--delay', `${(i * step) / 1000}s`);
    });
  });
}

function initScrollAnimations() {
  applyStagger();

  if (prefersReducedMotion()) {
    document.querySelectorAll('[data-animate]').forEach(el => {
      el.classList.add('visible', 'settled');
    });
    return;
  }

  document.querySelectorAll('[data-animate]').forEach(el => {
    scrollObserver.observe(el);
  });
}

// ==========================================================================
// SMOOTH SCROLL TARGET (used by inline onclick handlers in the markup)
// ==========================================================================

function scrollToSection(selector) {
  const target = document.querySelector(selector);
  if (!target) return;

  const nav = document.getElementById('nav');
  const offset = nav ? nav.offsetHeight : 0;
  const top = target.getBoundingClientRect().top + window.scrollY - offset;

  window.scrollTo({
    top,
    behavior: prefersReducedMotion() ? 'auto' : 'smooth'
  });
}

// The markup calls this from inline onclick attributes; a module's scope is not
// global, so it has to be published explicitly.
window.scrollToSection = scrollToSection;

// ==========================================================================
// IMAGE LOADING
// ==========================================================================

// Photographs fade in once decoded rather than popping in mid-scroll, and a
// missing file degrades to a labelled placeholder instead of a broken icon.
function initImageLoading() {
  document.querySelectorAll('.shot img').forEach(img => {
    const markLoaded = () => img.classList.add('loaded');

    if (img.complete && img.naturalWidth > 0) {
      markLoaded();
      return;
    }

    img.addEventListener('load', markLoaded, { once: true });
    img.addEventListener('error', () => {
      const shot = img.closest('.shot');
      if (shot) {
        shot.classList.add('is-missing');
        shot.setAttribute('aria-disabled', 'true');
      }
    }, { once: true });
  });
}

// ==========================================================================
// LIGHTBOX
// ==========================================================================

function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;

  const imageEl = document.getElementById('lightboxImage');
  const titleEl = document.getElementById('lightboxTitle');
  const descEl = document.getElementById('lightboxDesc');
  const counterEl = document.getElementById('lightboxCounter');
  const closeBtn = document.getElementById('lightboxClose');
  const prevBtn = document.getElementById('lightboxPrev');
  const nextBtn = document.getElementById('lightboxNext');

  let group = [];
  let index = 0;
  let lastFocused = null;

  function render() {
    const shot = group[index];
    if (!shot) return;

    const img = shot.querySelector('img');
    const strong = shot.querySelector('.shot-caption strong');
    // The caption's own wrapper is a <span>, so target the sub-line directly.
    const sub = shot.querySelector('.shot-caption-text > span');

    imageEl.src = img.src;
    imageEl.alt = img.alt;
    titleEl.textContent = strong ? strong.textContent.trim() : '';
    descEl.textContent = sub ? sub.textContent.trim() : '';
    counterEl.textContent = `${index + 1} / ${group.length}`;

    const multiple = group.length > 1;
    prevBtn.hidden = !multiple;
    nextBtn.hidden = !multiple;
  }

  // A lazily-loaded image that 404s is not detected until it scrolls into view,
  // so the viewer can still be handed a broken entry. Drop it on error rather
  // than showing the user a broken frame.
  imageEl.addEventListener('error', () => {
    if (lightbox.hidden || !imageEl.getAttribute('src')) return;

    const broken = group[index];
    if (broken) {
      broken.classList.add('is-missing');
      broken.setAttribute('aria-disabled', 'true');
      group.splice(index, 1);
    }

    if (!group.length) { close(); return; }
    index = index % group.length;
    render();
  });

  function open(shot) {
    const container = shot.closest('[data-lightbox-group]');
    group = Array.from(container ? container.querySelectorAll('.shot:not(.is-missing):not(.is-placeholder)') : [shot]);
    index = Math.max(0, group.indexOf(shot));

    lastFocused = document.activeElement;
    lightbox.hidden = false;
    render();

    // Let the browser paint the hidden->shown swap before transitioning in.
    requestAnimationFrame(() => {
      lightbox.classList.add('open');
      document.body.classList.add('lightbox-open');
      closeBtn.focus();
    });
  }

  function close() {
    lightbox.classList.remove('open');
    document.body.classList.remove('lightbox-open');

    const done = () => {
      lightbox.hidden = true;
      imageEl.src = '';
    };
    prefersReducedMotion() ? done() : setTimeout(done, 320);

    if (lastFocused) lastFocused.focus();
  }

  function step(delta) {
    if (group.length < 2) return;
    index = (index + delta + group.length) % group.length;
    render();
  }

  // Reserved slots carry no image, so they stay inert rather than opening an
  // empty lightbox frame.
  document.querySelectorAll('.shot:not(.is-placeholder)').forEach(shot => {
    shot.addEventListener('click', () => {
      if (!shot.classList.contains('is-missing')) open(shot);
    });
  });

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });

  document.addEventListener('keydown', (e) => {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'Tab') {
      // Keep focus inside the dialog while it is open.
      const focusable = [closeBtn, prevBtn, nextBtn].filter(b => !b.hidden);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

// ==========================================================================
// NAV SCROLL SPY
// ==========================================================================

function initScrollSpy() {
  const links = Array.from(document.querySelectorAll('.nav-link'));
  const sections = links
    .map(link => {
      const id = link.getAttribute('href');
      const section = id && id.length > 1 ? document.querySelector(id) : null;
      return section ? { link, section } : null;
    })
    .filter(Boolean);

  if (!sections.length) return;

  const spy = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const match = sections.find(s => s.section === entry.target);
      if (!match) return;
      match.link.classList.toggle('active', entry.isIntersecting);
    });
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

  sections.forEach(({ section }) => spy.observe(section));
}

// ==========================================================================
// COUNTER ANIMATION
// ==========================================================================

function animateCounter(el, target, duration = 2000) {
  const start = 0;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(start + (target - start) * eased);
    
    el.textContent = target >= 10000 ? current.toLocaleString() : current;
    
    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = target.toLocaleString();
  }
  requestAnimationFrame(update);
}

function initCounters() {
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = parseInt(entry.target.dataset.count, 10);
        if (!isNaN(target)) animateCounter(entry.target, target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  
  document.querySelectorAll('[data-count]').forEach(el => counterObserver.observe(el));
}

// ==========================================================================
// NAV
// ==========================================================================

function initNav() {
  const nav = document.getElementById('nav');
  const navLinks = document.getElementById('navLinks');
  const navToggle = document.getElementById('navToggle');
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  }, { passive: true });
  
  if (navToggle && navLinks) {
    const setMenuOpen = (open) => {
      navLinks.classList.toggle('open', open);
      navToggle.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
      document.body.classList.toggle('menu-open', open);
    };

    navToggle.addEventListener('click', () => {
      setMenuOpen(!navLinks.classList.contains('open'));
    });
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        setMenuOpen(false);
      });
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && navLinks.classList.contains('open')) {
        setMenuOpen(false);
        navToggle.focus();
      }
    });
  }
  
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const navHeight = nav.offsetHeight;
        const targetPos = target.getBoundingClientRect().top + window.scrollY - navHeight;
        window.scrollTo({ top: targetPos, behavior: 'smooth' });
      }
    });
  });
}

// ==========================================================================
// CURSOR GLOW
// ==========================================================================

function initCursorGlow() {
  const glow = document.getElementById('cursorGlow');
  if (!glow) return;
  
  let mx = 0, my = 0, gx = 0, gy = 0;
  
  document.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    glow.classList.add('active');
  });
  
  function animate() {
    gx += (mx - gx) * 0.15;
    gy += (my - gy) * 0.15;
    glow.style.transform = `translate(${gx - 200}px, ${gy - 200}px)`;
    requestAnimationFrame(animate);
  }
  animate();
}

// ==========================================================================
// SENSOR CAROUSEL
// ==========================================================================

function initSensorCarousel() {
  const carousel = document.getElementById('sensorsCarousel');
  const navButtons = document.querySelectorAll('.carousel-btn');
  if (!carousel || !navButtons.length) return;
  
  const cards = carousel.querySelectorAll('.sensor-card');
  let currentIndex = 0;
  let autoTimer;
  
  function showCard(index) {
    cards.forEach((c, i) => c.classList.toggle('active', i === index));
    navButtons.forEach((b, i) => b.classList.toggle('active', i === index));
    currentIndex = index;
  }
  
  function next() { showCard((currentIndex + 1) % cards.length); }
  
  function reset() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => { next(); reset(); }, 6000);
  }
  
  navButtons.forEach((b, i) => b.addEventListener('click', () => { showCard(i); reset(); }));
  carousel.addEventListener('mouseenter', () => clearTimeout(autoTimer));
  carousel.addEventListener('mouseleave', reset);
  reset();
}

// ==========================================================================
// TIMELINE STAGGER
// ==========================================================================

function initTimelineStagger() {
  const phases = document.querySelectorAll('.timeline-phase');
  if (!phases.length) return;
  
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const idx = Array.from(phases).indexOf(entry.target);
        setTimeout(() => entry.target.classList.add('visible'), idx * 150);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  
  phases.forEach(p => obs.observe(p));
}

// ==========================================================================
// CONTACT FORM
// ==========================================================================

function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const status = document.getElementById('formStatus');
  const fields = Array.from(form.querySelectorAll('input, textarea'));
  const showStatus = (message, type) => {
    status.textContent = message;
    status.className = `form-status ${type}`;
    status.hidden = false;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const invalidFields = fields.filter(field => !field.checkValidity());
    fields.forEach(field => field.setAttribute('aria-invalid', String(!field.checkValidity())));

    if (invalidFields.length) {
      showStatus('Please complete each required field with a valid email address before sending.', 'error');
      invalidFields[0].focus();
      return;
    }

    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    const message = form.elements.message.value.trim();
    const subject = encodeURIComponent(`PATHOS inquiry from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
    window.location.href = `mailto:rahul@pathos.io?subject=${subject}&body=${body}`;
    showStatus('Your email app should now be open with your message ready to send.', 'success');
    form.reset();
  });
}

function initCopyrightYear() {
  const year = document.getElementById('copyrightYear');
  if (year) year.textContent = new Date().getFullYear();
}

// ==========================================================================
// PERFORMANCE CHECK
// ==========================================================================

function checkPerformance() {
  const isLowEnd = navigator.hardwareConcurrency <= 4 || 
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isLowEnd) document.documentElement.classList.add('low-end');
  return !isLowEnd;
}

// ==========================================================================
// INIT
// ==========================================================================

async function init() {
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r));
  }
  
  const canRun = checkPerformance() && !prefersReducedMotion();

  initNav();
  initScrollProgress();
  initScrollSpy();
  initScrollAnimations();
  initCounters();
  initSensorCarousel();
  initTimelineStagger();
  initImageLoading();
  initLightbox();
  initContactForm();
  initCopyrightYear();

  if (!prefersReducedMotion()) initCursorGlow();

  if (canRun) setTimeout(initThree, 100);
  
  // Pause the render loop off-screen. Guarding on animationId prevents a second
  // rAF chain being started on every tab focus, which compounded into dropped
  // frames after a few switches.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    } else if (isThreeInitialized && animationId === null) {
      animateThree();
    }
  });
}

init();

window.PATHOS = { initThree, initScrollAnimations, initCounters };
