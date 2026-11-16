/* ==========================================================================
   The PATHOS film: plays on its own, on every device.

   The video autoplays muted and loops with no controls (set in the markup,
   so the browser starts it even before this script runs). This script:
   - pauses it off screen and plays it on screen;
   - restarts it if playback ever stalls while it is on screen;
   - moves the thin gold progress line.
   ========================================================================== */

const stage = document.getElementById('filmStage');
const video = document.getElementById('filmVideo');
const bar = document.getElementById('filmScrub');

if (stage && video) {
  video.muted = true;
  video.controls = false;
  let onScreen = false, raf = 0, lastT = -1, stuck = 0;

  const tryPlay = () => {
    if (!onScreen || document.hidden) return;
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  };

  const draw = () => {
    raf = 0;
    if (bar && video.duration) bar.style.transform = `scaleX(${(video.currentTime / video.duration).toFixed(4)})`;
    if (!video.paused) raf = requestAnimationFrame(draw);
  };
  video.addEventListener('play', () => { if (!raf) raf = requestAnimationFrame(draw); });
  video.addEventListener('seeked', draw);

  new IntersectionObserver(es => {
    onScreen = es[es.length - 1].isIntersecting;
    if (onScreen) tryPlay(); else video.pause();
  }, { threshold: 0.15 }).observe(stage);

  // Watchdog: on screen but paused or frozen for ~3 s means something stopped
  // it (a stall, a lost decoder, a browser pause); start it again.
  setInterval(() => {
    if (!onScreen || document.hidden) { stuck = 0; return; }
    const frozen = video.paused || video.currentTime === lastT;
    lastT = video.currentTime;
    if (frozen && ++stuck >= 3) { stuck = 0; tryPlay(); }
    else if (!frozen) stuck = 0;
  }, 1000);

  video.addEventListener('canplay', tryPlay);
  video.addEventListener('stalled', tryPlay);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tryPlay(); });
}
