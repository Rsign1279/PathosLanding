/* ==========================================================================
   Hero film: a seamless loop of marble slabs cascading through the dark
   (assets/hero, rendered offline from deliverables/hero-render).

   - Plays the portrait cut on tall screens and the landscape cut elsewhere,
     switching if the window changes shape.
   - Plays while the hero is on screen, pauses off screen.
   - Restarts playback if it ever stalls on screen.
   The matching still sits behind the video as the hero's background, so the
   first paint already shows the slabs.
   ========================================================================== */

const hero = document.getElementById('hero');
const video = document.getElementById('heroVideo');

if (hero && video) {
  video.muted = true;
  const SRC = { land: 'assets/hero/hero.mp4', port: 'assets/hero/hero-portrait.mp4' };
  const tall = matchMedia('(max-aspect-ratio: 4/5)');
  let kind = '', onScreen = true, lastT = -1, stuck = 0;

  const tryPlay = () => {
    if (!onScreen || document.hidden) return;
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  };
  const pick = () => {
    const k = tall.matches ? 'port' : 'land';
    if (k === kind) return;
    kind = k;
    // The browser already chose a <source>; only reload if it chose the other cut.
    if (!video.currentSrc || !video.currentSrc.includes(SRC[k])) { video.src = SRC[k]; video.load(); }
    tryPlay();
  };
  pick();
  tall.addEventListener ? tall.addEventListener('change', pick) : tall.addListener(pick);

  new IntersectionObserver(es => {
    onScreen = es[es.length - 1].isIntersecting;
    if (onScreen) tryPlay(); else video.pause();
  }, { threshold: 0.02 }).observe(hero);

  setInterval(() => {
    if (!onScreen || document.hidden) { stuck = 0; return; }
    const frozen = video.paused || video.currentTime === lastT;
    lastT = video.currentTime;
    if (frozen && ++stuck >= 3) { stuck = 0; tryPlay(); }
    else if (!frozen) stuck = 0;
  }, 1000);

  video.addEventListener('canplay', tryPlay);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tryPlay(); });
}
