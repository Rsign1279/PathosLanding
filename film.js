/* ==========================================================================
   The PATHOS film, driven by scroll.

   The founder's 44 second film sits right after the results panel, full
   screen. Scrolling plays it, and every single frame reaches the screen,
   in order, at any scroll speed:

   - The film is advanced one frame at a time by this script. The next frame
     is only requested once the previous one is actually on screen
     (requestVideoFrameCallback), so a frame can never be skipped, forward
     or backward.
   - After a fast flick that leaves the film more than ~0.8 s of screen time
     behind, it moves several frames per step (in order) to catch up in under
     a second; ordinary scrolling still shows every frame.
   - Speed follows the scroll: the further the scroll is ahead of the film,
     the faster frames are stepped, eased so it accelerates and coasts like
     inertia, then stops when it reaches the scroll position. The top speed
     is one film frame per screen refresh (2x at 60 Hz) or whatever this
     device can decode, whichever is lower.
   - One 1080p encode with a keyframe every 4 frames and no B-frames, so each
     step decodes very little. Fetched whole into memory first, so no step
     ever waits on the network.
   - Until the film is ready, small preview stills follow the scroll with a
     loading percentage. Without JavaScript it is an ordinary video with
     controls (see film.css).
   ========================================================================== */

const track = document.getElementById('filmTrack');
const stage = document.getElementById('filmStage');
const video = document.getElementById('filmVideo');
const still = document.getElementById('filmStill');
const status = document.getElementById('filmStatus');
const bar = document.getElementById('filmScrub');

if (track && stage && video) {
  const FPS = 30;
  const FRAMES = 1318;
  const LASTF = FRAMES - 1;
  const PREVIEWS = 45;                    // one still per second, 0..44
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const CATCHUP_S = 0.8;                  // longest a catch-up should take
  const timeOf = f => (f + 0.5) / FPS;    // middle of a frame: never rounds to a neighbour

  video.removeAttribute('controls');
  video.muted = true;
  video.playsInline = true;
  video.pause();

  let ready = false;
  let started = false;
  let near = false;
  let raf = 0;
  let shown = 0;              // frame currently on screen
  let busy = false;           // a step is decoding; wait until it is shown
  let speed = 0;              // eased frames per second
  let credit = 0;             // fractional frames owed at the current speed
  let lastNow = 0;
  let stepId = 0;
  let stride = 1;             // frames per step during a catch-up
  const stepMs = [];          // how long recent steps took to reach the screen

  const progress = () => {
    const r = track.getBoundingClientRect();
    const run = r.height - innerHeight;
    return run > 0 ? clamp(-r.top / run, 0, 1) : 0;
  };
  const targetFrame = () => Math.round(progress() * LASTF);

  const showStill = p => {
    if (!still) return;
    const i = Math.round(p * (PREVIEWS - 1));
    const src = still.dataset.base + String(i).padStart(2, '0') + '.webp';
    if (still.getAttribute('src') !== src) still.setAttribute('src', src);
  };

  // Show exactly frame f, then let the loop continue once it is on screen.
  const stepTo = f => {
    busy = true;
    const id = ++stepId;
    const t0 = performance.now();
    const done = () => {
      if (id !== stepId || !busy) return;
      busy = false; shown = f;
      stepMs.push(performance.now() - t0); if (stepMs.length > 30) stepMs.shift();
      wake();
    };
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(done);
    else video.addEventListener('seeked', () => requestAnimationFrame(done), { once: true });
    // Safety: never wait forever if a callback is missed.
    setTimeout(done, 250);
    video.currentTime = timeOf(f);
  };

  // Refresh interval, measured while running (top speed = 1 frame/refresh).
  const gaps = [];
  const refreshFps = () => {
    if (gaps.length < 10) return 60;
    return 1000 / gaps.slice().sort((a, b) => a - b)[gaps.length >> 1];
  };

  const frame = now => {
    raf = 0;
    const dt = lastNow ? Math.min(100, now - lastNow) : 16;
    lastNow = now;
    if (dt > 4 && dt < 60) { gaps.push(dt); if (gaps.length > 60) gaps.shift(); }
    const p = progress();
    if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;
    if (!ready) { showStill(p); lastNow = 0; return; }

    const r = track.getBoundingClientRect();
    const onScreen = r.bottom > 0 && r.top < innerHeight;
    const goal = targetFrame();
    const gap = goal - shown;

    if (!onScreen) {
      // Off screen (a link or the skip jumped past it): nobody sees these
      // frames, so go straight there.
      speed = 0; credit = 0;
      if (gap !== 0 && !busy) stepTo(goal);
    } else if (gap !== 0) {
      // Speed grows with how far behind the film is, eased for inertia,
      // and never above one film frame per screen refresh.
      const want = clamp(Math.abs(gap) * 2.2, 10, refreshFps());
      speed += (want - speed) * Math.min(1, dt / 120);
      credit = Math.min(1, credit + speed * dt / 1000);
      if (!busy && credit >= 1) {
        credit -= 1;
        // Normal scrolling: the very next frame, every frame. After a fast
        // flick (more than ~0.8 s of screen time behind), move several frames
        // per step, still in order, so it catches up in under a second, then
        // eases back to single frames as it lands.
        // Steps per second this device really manages (decode or refresh).
        const perStep = stepMs.length >= 5 ? stepMs.slice().sort((a, b) => a - b)[stepMs.length >> 1] : 1000 / refreshFps();
        const stepsPerSec = Math.min(refreshFps(), 1000 / Math.max(1, perStep));
        // Hold the big stride for the whole catch-up (so it closes in a
        // straight line, not an ever slower tail), then land frame by frame
        // over the last ~0.3 s.
        if (Math.abs(gap) <= stepsPerSec * 0.3) stride = 1;
        else stride = Math.max(stride, Math.ceil(Math.abs(gap) / (stepsPerSec * CATCHUP_S)));
        const k = stride;
        stepTo(shown + Math.sign(gap) * Math.min(k, Math.abs(gap)));
      }
    } else {
      speed = 0; credit = 0; stride = 1;
    }

    if (gap !== 0 || busy) raf = requestAnimationFrame(frame);
    else lastNow = 0;
  };
  const wake = () => { if (!raf && near) raf = requestAnimationFrame(frame); };

  addEventListener('scroll', wake, { passive: true });
  addEventListener('resize', wake);

  const once = (el, ev) => new Promise(res => el.addEventListener(ev, res, { once: true }));

  const load = async () => {
    if (started) return;
    started = true;
    const url = video.dataset.src1080;
    let src = url;
    try {
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
        if (total && status) status.textContent = `Loading the film… ${Math.round(got / total * 100)}%`;
      }
      src = URL.createObjectURL(new Blob(parts, { type: 'video/mp4' }));
    } catch (_) { /* fall back to streaming the file directly */ }
    video.src = src;
    video.load();
    if (video.readyState < 2) await once(video, 'loadeddata');
    // iOS only paints seeks after the element has been played once.
    try { await video.play(); } catch (_) {}
    video.pause();
    shown = targetFrame();
    video.currentTime = timeOf(shown);
    await once(video, 'seeked');
    ready = true;
    stage.classList.add('is-ready');
    if (status) status.textContent = '';
    wake();
  };

  new IntersectionObserver(es => {
    near = es[es.length - 1].isIntersecting;
    if (near) { load(); wake(); }
  }, { rootMargin: '150% 0px' }).observe(track);

  // The film is the second thing on the page: start once the page has loaded.
  const early = () => (window.requestIdleCallback || setTimeout)(load, { timeout: 2000 });
  if (document.readyState === 'complete') early(); else addEventListener('load', early, { once: true });

  frame(performance.now());
}
