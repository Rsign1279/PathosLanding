// Every animation must run on every device, including machines whose system
// asks for reduced motion (Windows "Animation effects" off, common on school
// laptops). Loads the page with reducedMotion: 'reduce' and checks that each
// moving part actually moves. Needs the site on http://127.0.0.1:8000/.
const { chromium } = require('playwright');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(process.env.BASE || 'http://127.0.0.1:8000/', { waitUntil: 'load' });
  ok(await p.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'system asks for reduced motion');

  const go = async (sel, extra = 0) => {
    await p.evaluate(([s, e]) => { const el = document.querySelector(s); scrollTo({ top: el.getBoundingClientRect().top + scrollY + e, behavior: 'instant' }); }, [sel, extra]);
    await p.waitForTimeout(900);
  };
  // A canvas is moving if two snapshots taken apart differ.
  const moves = async (sel, ms = 700) => {
    const snap = () => p.evaluate(s => { const c = document.querySelector(s); return c ? c.toDataURL() : ''; }, sel);
    const a = await snap(); await p.waitForTimeout(ms); const z = await snap();
    return a.length > 0 && a !== z;
  };

  // Hero: the marble film plays on its own.
  await p.waitForTimeout(2500);
  const hv = await p.evaluate(() => { const v = document.getElementById('heroVideo'); return { paused: v.paused, t: v.currentTime, controls: v.controls, src: v.currentSrc }; });
  ok(!hv.paused && hv.t > 0 && !hv.controls && /hero\.mp4/.test(hv.src), `hero film plays (t=${hv.t.toFixed(2)})`);

  // Cards spawn in.
  await go('#solution', -100);
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.feat')).animationName === 'spawn'), 'feature cards spawn in');

  // Margin dot art drifts.
  await go('#impact', -80);
  ok(await moves('#impact canvas.edge-art'), 'margin particle art moves');

  // Problem chart draws over time.
  await go('#problem', -80);
  ok(await moves('#problemChart', 500), 'problem chart animates');

  // Signal traces run.
  await go('#philosophy', 200);
  ok(await moves('.sig-card .sig-trace'), 'signal traces run');

  // Model pipeline steps on its own.
  await go('#ai', 100); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => document.querySelector('.pipeline').classList.contains('is-running')), 'model pipeline runs');

  // Parts table rows spawn one after another.
  await go('#sensors', 100);
  ok(await p.evaluate(() => getComputedStyle(document.querySelectorAll('#sensors .sensor-row')[2]).animationName === 'spawn'), 'parts rows spawn in');

  // Photo deck is the scroll-driven deck, not the still grid.
  ok(await p.evaluate(() => document.getElementById('product').classList.contains('is-live')), 'photo deck is scroll-driven');

  // How it works: the finger scene animates.
  await go('#how', 50);
  ok(await moves('#howCanvas'), 'how-it-works finger animates');

  // 3D: on laptops the pre-rendered film follows the scroll; the live scene
  // isn't built until someone clicks or opens the 360 view.
  await go('#prototype', 300);
  await p.waitForFunction(() => (window.pathosPrototype?.stats.seqLoaded || 0) > 30, undefined, { timeout: 180000 });
  const seqSnap = () => p.evaluate(() => document.querySelector('.hw-seq').toDataURL('image/jpeg', 0.5));
  const s0 = await seqSnap(); await p.mouse.wheel(0, 900); await p.waitForTimeout(1500); const s1 = await seqSnap();
  ok(s0 !== s1, '3D film follows the scroll');
  ok(await p.evaluate(() => !window.pathosPrototype.stats.gl), 'live 3D waits until asked');

  // Film: plays on its own with no controls.
  await go('#film', -100); await p.waitForTimeout(3500);
  const film = await p.evaluate(() => { const v = document.getElementById('filmVideo'); return { controls: v.controls, paused: v.paused, t: v.currentTime }; });
  ok(!film.controls, 'film has no controls');
  ok(!film.paused && film.t > 0, `film plays (t=${film.t.toFixed(2)})`);

  ok(!errs.length, 'no errors ' + errs.join(' | '));
  await b.close();
  process.exit(fails ? 1 : 0);
})();
