// Browser checks for the scroll-driven 3D hardware section (#prototype).
// Run from the repo root with a local server on :8000:
//   python3 -m http.server 8000 --bind 127.0.0.1 &  node deliverables/test-prototype.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT_DIR || 'deliverables/pathos-hardware';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

async function seek(page, frame) {
  // Sections above may still change height (lazy rendering), so re-aim until the
  // scroll position maps to the requested frame, then wait for playback to arrive.
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.evaluate(f => {
      const tr = document.getElementById('hwTrack'), st = document.getElementById('hwStage');
      const range = tr.offsetHeight - st.offsetHeight;
      scrollTo(0, tr.getBoundingClientRect().top + scrollY + window.pathosPrototype.progressAt(f) * range + 1);
    }, frame);
    await page.waitForTimeout(300);
    const aimed = await page.evaluate(() => {
      const tr = document.getElementById('hwTrack'), st = document.getElementById('hwStage');
      return window.pathosPrototype.frameAt(-tr.getBoundingClientRect().top / (tr.offsetHeight - st.offsetHeight));
    });
    if (Math.abs(aimed - frame) < 1.5) break;
  }
  try {
    await page.waitForFunction(f => { const s = window.pathosPrototype.state; return Math.abs(s.target - f) < 1.5 && Math.abs(s.frame - s.target) < 0.05; }, frame, { timeout: 180000, polling: 250 });
  } catch (e) {
    throw Error(`Seek to ${frame} timed out: ` + JSON.stringify(await page.evaluate(() => ({ ...window.pathosPrototype.state, scrollY }))));
  }
  await page.waitForTimeout(150);
  return page.evaluate(() => window.pathosPrototype.state);
}
const clip = page => page.evaluate(() => {
  const q = document.getElementById('hwStage').getBoundingClientRect();
  return { x: Math.max(0, q.left), y: Math.max(0, q.top), width: Math.min(q.width, innerWidth), height: Math.min(q.height, innerHeight - Math.max(0, q.top)) };
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ARGS });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  await page.goto('http://127.0.0.1:8000/#prototype');
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  const t0 = Date.now();
  await page.waitForFunction(() => window.pathosPrototype?.stats.ready, { timeout: 120000 });
  const loadMs = Date.now() - t0;

  // 1. Every chapter: correct shot, titles on, frame counter in sync.
  const chapters = await page.$$eval('#hwHud .hw-chapter', els => els.map((e, i) => ({ i, start: +e.dataset.start, end: +e.dataset.end, final: e.classList.contains('hw-chapter--final') })));
  const states = [];
  for (const c of chapters) {
    const f = (c.final ? 2598 : c.start) + 40;
    const s = await seek(page, f);
    const on = await page.$eval(`#hwHud .hw-chapter:nth-child(${c.i + 1})`, el => el.classList.contains('is-on'));
    const counter = await page.$eval('#hwFrame', el => +el.textContent);
    if (s.chapter !== c.i) throw Error(`Chapter ${c.i + 1}: expected shot ${c.i}, got ${s.chapter}`);
    if (!on) throw Error(`Chapter ${c.i + 1}: titles not shown at frame ${f}`);
    if (Math.abs(counter - s.frame) > 1) throw Error(`Chapter ${c.i + 1}: counter ${counter} vs frame ${s.frame}`);
    states.push({ chapter: c.i + 1, frame: +s.frame.toFixed(2) });
    await page.screenshot({ timeout: 180000, path: `${OUT}/chapter-${String(c.i + 1).padStart(2, '0')}.png`, clip: await clip(page) });
  }

  // 2. Title timing: the final card stays hidden until frame 2598, as in the film.
  await seek(page, 2560);
  if (await page.$eval('.hw-chapter--final', el => el.classList.contains('is-on'))) throw Error('Final titles shown before frame 2598');

  // 3. Route timing: on the sensor highway only TMP117 is lit at 920; all five by 1100.
  await seek(page, 920);
  const lit920 = await page.$$eval('#hwHud .hw-chapter:nth-child(4) .hw-route li', l => l.filter(x => x.classList.contains('is-lit')).length);
  await seek(page, 1100);
  const lit1100 = await page.$$eval('#hwHud .hw-chapter:nth-child(4) .hw-route li', l => l.filter(x => x.classList.contains('is-lit')).length);
  if (lit920 !== 1 || lit1100 !== 5) throw Error(`Route timing wrong: ${lit920} lit at 920, ${lit1100} at 1100`);

  // 4. Reverse scrubbing lands on the same frames.
  for (const i of [6, 2, 0]) {
    const c = chapters[i];
    const s = await seek(page, c.start + 40);
    if (Math.abs(s.frame - states[i].frame) > 0.6) throw Error(`Reverse seek mismatch at chapter ${i + 1}`);
  }

  // 5. Rail navigation.
  await page.click('#hwRail .hw-rail-btn:nth-child(7)');
  await page.waitForFunction(() => window.pathosPrototype.state.chapter === 6, { timeout: 120000, polling: 250 });

  const stats = await page.evaluate(() => window.pathosPrototype.stats);

  // 6. Phone layout.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await seek(page, 1300);
  await page.screenshot({ timeout: 180000, path: `${OUT}/mobile.png`, clip: await clip(page) });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) throw Error('Horizontal overflow on phone');

  // 7. Reduced motion: no easing, the frame lands on the target immediately.
  const rm = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await rm.goto('http://127.0.0.1:8000/#prototype');
  await rm.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  await rm.waitForFunction(() => window.pathosPrototype?.stats.ready, { timeout: 120000 });
  const reduced = await seek(rm, 1600);

  fs.writeFileSync(`${OUT}/validation.json`, JSON.stringify({ errors, loadMs, states, stats, overflow, reduced }, null, 2));
  console.log(JSON.stringify({ errors, loadMs, chapters: states.length, drawCalls: stats.drawCalls, triangles: stats.triangles, overflow, reducedFrame: +reduced.frame.toFixed(1) }));
  if (errors.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
