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
  await page.waitForFunction(() => window.pathosPrototype?.stats.ready, undefined, { timeout: 120000 });
  const loadMs = Date.now() - t0;

  // 1. Every shot: correct chapter, titles on (none in the laptop shot), counter in sync.
  const chapters = await page.$$eval('#hwHud .hw-chapter', els => els.map((e, i) => ({ i, shotStart: +e.dataset.shotStart, start: +e.dataset.start, end: +e.dataset.end })));
  const states = [];
  for (const c of chapters) {
    const f = (c.start || c.shotStart) + 40;
    const s = await seek(page, f);
    const lit = await page.$$eval('#hwHud .hw-chapter', els => els.map(e => e.classList.contains('is-on')));
    const counter = await page.$eval('#hwFrame', el => +el.textContent);
    if (s.chapter !== c.i) throw Error(`Chapter ${c.i + 1}: expected shot ${c.i}, got ${s.chapter}`);
    if (c.start && !lit[c.i]) throw Error(`Chapter ${c.i + 1}: titles not shown at frame ${f}`);
    if (!c.start && lit.some(Boolean)) throw Error(`Chapter ${c.i + 1}: titles shown in a shot without titles`);
    if (lit.filter(Boolean).length > 1) throw Error(`Frame ${f}: more than one chapter's titles shown`);
    if (Math.abs(counter - s.frame) > 1) throw Error(`Chapter ${c.i + 1}: counter ${counter} vs frame ${s.frame}`);
    states.push({ chapter: c.i + 1, frame: +s.frame.toFixed(2), page: s.page, art: s.art });
    await page.screenshot({ timeout: 180000, path: `${OUT}/chapter-${String(c.i + 1).padStart(2, '0')}.png`, clip: await clip(page) });
  }

  // 2. Title timing on the film's frames: chapter 1 leaves at 286, the final
  //    card waits for 2598.
  const isOn = sel => page.$eval(sel, el => el.classList.contains('is-on'));
  // Seeks land within a frame or so; check against the frame actually shown.
  for (const f of [283, 285, 287, 289]) {
    const s = await seek(page, f);
    const shown = Math.round(s.frame), on = await isOn('#hwHud .hw-chapter:nth-child(1)');
    if (on !== shown < 286) throw Error(`Chapter 1 titles ${on ? 'shown' : 'hidden'} at frame ${shown}`);
  }
  for (const f of [2560, 2596, 2600]) {
    const s = await seek(page, f);
    const shown = Math.round(s.frame), on = await isOn('.hw-chapter--final');
    if (on !== shown >= 2598) throw Error(`Final titles ${on ? 'shown' : 'hidden'} at frame ${shown}`);
  }

  // 3. MacBook screen and table artwork follow the film's keys.
  const film = [[1990, 0, 0], [2050, 1, 0], [2120, 2, 0], [2200, 3, 0], [2500, 3, 0], [2540, 0, 1], [150, 0, 1], [1000, 0, 0]];
  const screen = [];
  for (const [f, pageNo, art] of film) {
    const s = await seek(page, f);
    screen.push({ frame: f, page: s.page, art: s.art });
    if (s.page !== pageNo) throw Error(`Screen page at ${f}: expected ${pageNo}, got ${s.page}`);
    if (s.art !== art) throw Error(`Table artwork at ${f}: expected ${art}, got ${s.art}`);
  }

  // 4. Reverse scrubbing lands on the same frames.
  for (const i of [6, 2, 0]) {
    const c = chapters[i];
    const s = await seek(page, c.start + 40);
    if (Math.abs(s.frame - states[i].frame) > 0.6) throw Error(`Reverse seek mismatch at chapter ${i + 1}`);
  }

  // 5. Rail navigation.
  await page.click('#hwRail .hw-rail-btn:nth-child(7)');
  await page.waitForFunction(() => window.pathosPrototype.state.chapter === 6, undefined, { timeout: 120000, polling: 250 });

  const stats = await page.evaluate(() => window.pathosPrototype.stats);

  // 6. Narrow window: no overflow.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) throw Error('Horizontal overflow on a narrow window');

  // 6b. A phone loads the lighter model and the smaller screenshots, and stacks
  //     the titles under the picture inside the stage.
  const phoneBrowser = await chromium.launch({ args: ARGS });
  const phone = await phoneBrowser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const phoneReqs = [];
  phone.on('request', r => phoneReqs.push(r.url()));
  phone.on('pageerror', e => errors.push('phone: ' + e.message));
  await phone.goto('http://127.0.0.1:8000/#prototype', { timeout: 120000 });
  await phone.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  await phone.waitForFunction(() => window.pathosPrototype?.stats.ready, undefined, { timeout: 180000 });
  await seek(phone, 1300);
  const mobile = await phone.evaluate(() => {
    const v = document.getElementById('hwView').getBoundingClientRect();
    const plate = document.querySelector('#hwHud .hw-chapter.is-on .hw-plate').getBoundingClientRect();
    return { model: window.pathosPrototype.stats.model, compact: document.getElementById('hwView').classList.contains('is-compact'),
      plateInside: plate.left >= v.left && plate.right <= v.right && plate.bottom <= v.bottom && plate.top >= v.top,
      overflow: document.documentElement.scrollWidth > innerWidth };
  });
  mobile.smallShots = phoneReqs.some(u => /v1-live-instrument-sm\.webp/.test(u));
  await phone.screenshot({ timeout: 180000, path: `${OUT}/mobile.png`, clip: await clip(phone) });
  await phoneBrowser.close();
  if (!/mobile\.glb$/.test(mobile.model) || !mobile.compact || !mobile.plateInside || mobile.overflow || !mobile.smallShots) throw Error('Phone layout: ' + JSON.stringify(mobile));

  // 7. Reduced motion: no easing, the frame lands on the target immediately.
  const rmBrowser = await chromium.launch({ args: ARGS });
  const rm = await rmBrowser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await rm.goto('http://127.0.0.1:8000/#prototype');
  await rm.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  await rm.waitForFunction(() => window.pathosPrototype?.stats.ready, undefined, { timeout: 120000 });
  const reduced = await seek(rm, 1600);

  fs.writeFileSync(`${OUT}/validation.json`, JSON.stringify({ errors, loadMs, states, screen, stats, overflow, mobile, reduced }, null, 2));
  console.log(JSON.stringify({ errors, loadMs, chapters: states.length, drawCalls: stats.drawCalls, triangles: stats.triangles, overflow, mobile: mobile.model, reducedFrame: +reduced.frame.toFixed(1) }));
  if (errors.length) process.exitCode = 1;
  await rmBrowser.close();
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
