/* ==========================================================================
   The PATHOS film, driven by scroll.

   The founder's 44 second film sits right after the results panel, full
   screen. Scrolling plays it: real playback, every frame in order, faster
   for faster scrolls, coasting to a pause when the scroll stops. Scrolling
   up steps it back.

   - Three encodes of the same film (2160p, 1440p, 1080p), each with a
     keyframe every 10 frames so any frame decodes quickly. The page picks
     the smallest one that still covers every device pixel of the stage, so
     a 4K or retina screen gets the full 4K film.
   - The chosen file is fetched whole into memory (a blob) before use, so
     every seek is local; there are no network waits mid-scrub.
   - If this machine can't decode the chosen encode quickly (median seek over
     100ms across 20 seeks), the next smaller encode loads in the background
     and takes over on the same frame. This happens at most once.
   - Until the film is ready, small preview stills follow the scroll so the
     stage is never empty, with a loading percentage.
   - One seek at a time: the next waits for "seeked", and the target is eased
     slightly so fast flicks don't queue a pile of seeks.
   - Without JavaScript the same file shows as an ordinary video with
     controls (see the html:not(.js) rules in film.css).
   ========================================================================== */

const track = document.getElementById('filmTrack');
const stage = document.getElementById('filmStage');
const first = document.getElementById('filmVideo');
const still = document.getElementById('filmStill');
const status = document.getElementById('filmStatus');
const bar = document.getElementById('filmScrub');

if (track && stage && first) {
  const FPS = 30;
  const FRAMES = 1318;
  const LAST = (FRAMES - 1) / FPS;        // time of the final frame
  const PREVIEWS = 45;                    // one still per second, 0..44
  const SLOW_MS = 100;                    // median seek time that counts as slow (under ~10 updates/s)
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  // Frame shown at a time (floor when reading the decoder), and the time to ask for.
  const frameAt = (t, shown) => clamp(shown ? Math.floor(t * FPS + 1e-4) : Math.round(t * FPS), 0, FRAMES - 1);
  const timeOf = f => (f + 0.5) / FPS;

  // Encodes, smallest first: [pixel width, url]
  const TIERS = [
    [1920, first.dataset.src1080],
    [2560, first.dataset.src1440],
    [3840, first.dataset.src2160],
  ].filter(t => t[1]);

  // Smallest encode that covers the stage's device pixels.
  const pickTier = () => {
    // Full screen with cover: the film's width on screen is the larger of
    // the viewport width and the 16:9 width that fills its height.
    const cssW = Math.max(innerWidth, innerHeight * 16 / 9);
    const px = cssW * Math.min(devicePixelRatio || 1, 3);
    const saveData = navigator.connection && navigator.connection.saveData;
    if (saveData) return 0;
    let i = TIERS.findIndex(t => t[0] >= px * 0.98);
    if (i === -1) i = TIERS.length - 1;
    // Phones: at most 1440p (a 45 MB 4K download is too much on mobile data).
    if (matchMedia('(pointer: coarse)').matches && innerWidth < 900) i = Math.min(i, 1);
    return i;
  };

  // The visible video. It is ours to drive: no controls, never plays.
  let video = first;
  video.removeAttribute('controls');
  video.muted = true;
  video.playsInline = true;
  video.pause();

  let tier = -1;
  let ready = false;          // a film is loaded and showing the right frame
  let started = false;        // first download begun
  let swapping = false;       // a smaller encode is loading in the background
  let steppedDown = false;    // the one allowed step down has happened
  let seeking = false;
  let seekStart = 0;
  let seekTimes = [];
  let target = 0;             // time the scroll asks for
  let eased = 0;              // time we are heading to
  let raf = 0;
  let near = false;

  const progress = () => {
    const r = track.getBoundingClientRect();
    const run = r.height - innerHeight;
    return run > 0 ? clamp(-r.top / run, 0, 1) : 0;
  };

  const showStill = p => {
    if (!still) return;
    const i = Math.round(p * (PREVIEWS - 1));
    const src = still.dataset.base + String(i).padStart(2, '0') + '.webp';
    if (still.getAttribute('src') !== src) still.setAttribute('src', src);
  };

  const onSeeked = e => {
    if (e.target !== video || !seeking) return;
    seeking = false;
    seekTimes.push(performance.now() - seekStart);
    // After 20 seeks, step down one encode if this machine is slow; at most
    // once, so a 4K screen never drops below 1440p.
    if (seekTimes.length >= 20 && !swapping && !steppedDown && tier > 0) {
      const sorted = seekTimes.slice().sort((a, b) => a - b);
      if (sorted[sorted.length >> 1] > SLOW_MS) { steppedDown = true; swapTo(tier - 1); }
      seekTimes = [];
    }
  };

  const seek = () => {
    if (!ready || seeking) return;
    // Work in whole frames: seek into the middle of the wanted frame so the
    // decoder can never round to its neighbour, and only when it changes.
    const f = frameAt(eased);
    if (frameAt(video.currentTime, true) === f) return;
    seeking = true;
    seekStart = performance.now();
    video.currentTime = timeOf(f);
  };

  // Scroll drives real playback. The scroll position sets where the film
  // should be; when that is ahead, the video actually plays (every frame,
  // in order) at a speed that grows with the gap, so a fast scroll plays
  // fast and the film coasts to a stop after the scroll ends (inertia).
  // When the target is behind (scrolling up) it steps backward, since
  // browsers can't play in reverse. Caught up: it pauses.
  let rate = 1;
  const MAX_RATE = 4;
  const frame = () => {
    raf = 0;
    const p = progress();
    target = p * LAST;
    if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;
    if (!ready) { showStill(p); eased = target; return; }
    const ct = video.currentTime;
    const gap = target - ct;
    if (Math.abs(gap) > 12) {
      // A leap (link, skip, refresh mid page): go straight there. Ordinary
      // scrolling, however fast, always plays through every frame.
      if (!video.paused) video.pause();
      eased = target; seek();
    } else if (gap > 1 / FPS) {
      // Ahead: play. Speed follows the gap, eased so it never lurches.
      const want = clamp(gap * 1.6, 0.35, MAX_RATE);
      rate += (want - rate) * 0.15;
      if (Math.abs(video.playbackRate - rate) > 0.02) video.playbackRate = rate;
      if (video.paused && !seeking) video.play().catch(() => {});
    } else if (gap < -1 / FPS) {
      // Behind: step back smoothly, frame by frame.
      if (!video.paused) video.pause();
      const d = target - eased;
      eased = Math.abs(d) < 0.5 / FPS ? target : (eased > ct ? ct : eased) + d * 0.3;
      seek();
    } else {
      if (!video.paused) video.pause();
      rate = 1; eased = ct;
    }
    if (Math.abs(target - video.currentTime) > 1 / FPS || !video.paused || seeking) raf = requestAnimationFrame(frame);
  };
  const wake = () => { if (!raf && near) raf = requestAnimationFrame(frame); };

  addEventListener('scroll', wake, { passive: true });
  addEventListener('resize', wake);

  // Download a whole encode into memory, reporting progress if asked.
  const fetchBlob = async (url, report) => {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
    const total = +res.headers.get('content-length') || 0;
    const reader = res.body.getReader();
    const parts = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      got += value.length;
      if (report && total) report(got / total);
    }
    return URL.createObjectURL(new Blob(parts, { type: 'video/mp4' }));
  };

  const once = (el, ev) => new Promise(res => el.addEventListener(ev, res, { once: true }));

  // Point an element at a source and park it on the frame the scroll wants.
  const prime = async (el, src) => {
    el.dataset.priming = '1';
    el.src = src;
    el.load();
    if (el.readyState < 2) await once(el, 'loadeddata');
    // iOS only paints seeks after the element has been played once.
    try { await el.play(); } catch (_) {}
    el.pause();
    const t = clamp(progress() * LAST, 0, LAST);
    el.currentTime = timeOf(frameAt(t));
    await once(el, 'seeked');
    delete el.dataset.priming;
    return t;
  };

  const setup = el => {
    el.addEventListener('seeked', onSeeked);
  };
  setup(video);

  const load = async () => {
    if (started) return;
    started = true;
    tier = pickTier();
    const url = TIERS[tier][1];
    let src = url;
    try {
      src = await fetchBlob(url, f => { if (status) status.textContent = `Loading the film… ${Math.round(f * 100)}%`; });
    } catch (_) { /* fall back to streaming the file directly */ }
    eased = target = await prime(video, src);
    ready = true;
    stage.classList.add('is-ready');
    if (status) status.textContent = '';
    wake();
  };

  // Load a smaller encode behind the current one and swap on the same frame.
  const swapTo = async next => {
    swapping = true;
    try {
      const src = await fetchBlob(TIERS[next][1]);
      const el = video.cloneNode(false);
      el.removeAttribute('id');
      el.removeAttribute('src');
      el.style.opacity = '0';
      video.after(el);
      setup(el);
      await prime(el, src);
      // Let any seek on the old one finish, then match its frame exactly.
      if (seeking) await once(video, 'seeked');
      const f = frameAt(eased);
      if (frameAt(el.currentTime, true) !== f) { el.currentTime = timeOf(f); await once(el, 'seeked'); }
      const old = video;
      el.style.opacity = '';
      el.id = old.id;
      video = el;
      tier = next;
      seeking = false;          // any seek left on the old element no longer matters
      seekTimes = [];
      // Detach the old element from its file before freeing it.
      const oldSrc = old.src;
      old.pause();
      old.removeAttribute('src');
      old.load();
      old.remove();
      if (oldSrc.startsWith('blob:')) URL.revokeObjectURL(oldSrc);
      wake();
    } catch (_) { /* keep the current encode */ }
    swapping = false;
  };

  new IntersectionObserver(es => {
    near = es[es.length - 1].isIntersecting;
    if (near) { load(); wake(); }
  }, { rootMargin: '150% 0px' }).observe(track);

  // The film is the second thing on the page: start once the page has loaded.
  const early = () => (window.requestIdleCallback || setTimeout)(load, { timeout: 2000 });
  if (document.readyState === 'complete') early(); else addEventListener('load', early, { once: true });

  frame();
}
