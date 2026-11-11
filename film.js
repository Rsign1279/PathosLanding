/* ==========================================================================
   The PATHOS film: plays on its own.

   The video autoplays muted and loops (set in the markup, so it also plays
   without JavaScript). This script only:
   - pauses it while it is off screen and resumes when it comes back, so it
     costs nothing while you read the rest of the page;
   - moves the thin gold progress line;
   - respects "reduce motion": no autoplay, ordinary controls instead.
   ========================================================================== */

const stage = document.getElementById('filmStage');
const video = document.getElementById('filmVideo');
const bar = document.getElementById('filmScrub');

if (stage && video) {
  video.muted = true;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let onScreen = false;
  let raf = 0;

  const tryPlay = () => {
    if (reduced.matches || !onScreen) return;
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  };

  const apply = () => {
    if (reduced.matches) {
      video.pause();
      video.removeAttribute('autoplay');
      video.controls = true;
      stage.classList.add('is-manual');
    } else {
      video.controls = false;
      stage.classList.remove('is-manual');
      tryPlay();
    }
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

  // Some browsers hold autoplay until the data is ready.
  video.addEventListener('canplay', tryPlay);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tryPlay(); });
  reduced.addEventListener ? reduced.addEventListener('change', apply) : reduced.addListener(apply);
  apply();
}
