/* ==========================================================================
   The PATHOS film: plays on its own, on every device.

   The video is muted and loops, with no controls. This script:
   - starts downloading it once the rest of the page has loaded, or as soon as
     it is about a screen away, whichever comes first, so the 25 MB file never
     competes with the page's first paint;
   - plays it while it is on screen and pauses it off screen;
   - moves the thin gold progress line.
   ========================================================================== */

const stage = document.getElementById('filmStage');
const video = document.getElementById('filmVideo');
const bar = document.getElementById('filmScrub');

if (stage && video) {
  video.muted = true;
  video.controls = false;
  let onScreen = false, loading = false, raf = 0;

  const load = () => {
    if (loading) return;
    loading = true;
    video.preload = 'auto';
    video.load();
  };
  const tryPlay = () => {
    if (!onScreen) return;
    load();
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

  if (document.readyState === 'complete') load();
  else addEventListener('load', load, { once: true });
  new IntersectionObserver(es => {
    if (es[es.length - 1].isIntersecting) load();
  }, { rootMargin: '100% 0px' }).observe(stage);

  new IntersectionObserver(es => {
    onScreen = es[es.length - 1].isIntersecting;
    if (onScreen) tryPlay(); else video.pause();
  }, { threshold: 0.15 }).observe(stage);

  // Some browsers hold playback until the data is ready.
  video.addEventListener('canplay', tryPlay);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tryPlay(); });
}
