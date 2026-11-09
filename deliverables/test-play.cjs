// Checks for the interactive explanations (play.js): the signal explorer's
// readings, live traces, the model pipeline, the project-log rail, counters,
// the copy button, the phone layout and reduced motion. Screenshots go to the
// system temp folder. Run with the local server on :8000:  node deliverables/test-play.cjs
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8000/'); await p.addStyleTag({ content: 'html{scroll-behavior:auto!important}' }); await p.waitForTimeout(800);
  const go = async (sel, off = 80) => { await p.evaluate(([s, o]) => { const el = document.querySelector(s); scrollTo(0, el.getBoundingClientRect().top + scrollY - o); }, [sel, off]); await p.waitForTimeout(1800); };
  // Signal explorer
  await go('#philosophy');
  const text = () => p.evaluate(() => document.querySelector('.sig-meter strong').textContent);
  ok(await text() === 'Tap the signals you’d see together.', 'meter starts with the prompt');
  await p.click('.sig-card[data-signal="hr"]'); await p.waitForTimeout(300);
  ok(await text() === 'One signal on its own.', 'one signal');
  await p.click('.sig-card[data-signal="eda"]'); await p.waitForTimeout(300);
  ok(await text() === 'Two signals agree.', 'two signals');
  await p.click('.sig-card[data-signal="temp"]'); await p.waitForTimeout(900);
  ok(await text() === 'All three, while sitting still.' && await p.evaluate(() => document.querySelector('.statement').classList.contains('is-lit')), 'three signals light the statement');
  await p.screenshot({ path: `${require('os').tmpdir()}/play-signals.png` });
  await p.click('.sig-card[data-signal="motion"]'); await p.waitForTimeout(300);
  ok(await text() === 'Moving explains most of this.', 'motion explains it away');
  await p.keyboard.press('Tab');
  await p.focus('.sig-card[data-signal="motion"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok(await text() === 'All three, while sitting still.', 'keyboard toggles a signal');
  // Sensors
  await go('#sensors');
  await p.hover('.sensor-row:nth-child(2)'); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${require('os').tmpdir()}/play-sensors.png` });
  ok(await p.evaluate(() => window.pathosPlay.traces) === 9, '9 live traces');
  // Pipeline
  await go('#ai'); await p.mouse.move(5, 5); await p.waitForTimeout(2600);
  const act1 = await p.evaluate(() => [...document.querySelectorAll('.pipeline > li')].findIndex(l => l.classList.contains('is-active')));
  await p.waitForFunction(a => [...document.querySelectorAll('.pipeline > li')].findIndex(l => l.classList.contains('is-active')) !== a, act1, { timeout: 4000 }).catch(() => {});
  const act2 = await p.evaluate(() => [...document.querySelectorAll('.pipeline > li')].findIndex(l => l.classList.contains('is-active')));
  ok(act1 >= 0 && act2 === (act1 + 1) % 4, `pipeline advances (${act1} -> ${act2})`);
  await p.hover('.pipeline > li:nth-child(3)'); await p.waitForTimeout(2500);
  const held = await p.evaluate(() => [...document.querySelectorAll('.pipeline > li')].findIndex(l => l.classList.contains('is-active')));
  ok(held === 2, 'hovering holds a step');
  await p.screenshot({ path: `${require('os').tmpdir()}/play-pipeline.png` });
  await p.mouse.move(5, 5);
  // Journey
  await go('#journey', 700);
  const r1 = await p.evaluate(() => [...document.querySelectorAll('.log li')].filter(l => l.classList.contains('is-reached')).length);
  await go('#journey', -200);
  const r2 = await p.evaluate(() => [...document.querySelectorAll('.log li')].filter(l => l.classList.contains('is-reached')).length);
  ok(r2 > r1, `log milestones light with scroll (${r1} -> ${r2})`);
  await p.screenshot({ path: `${require('os').tmpdir()}/play-journey.png` });
  // Counters
  await go('.partner-list', 120); await p.waitForTimeout(1500);
  const counts = await p.evaluate(() => [...document.querySelectorAll('.count')].map(c => c.textContent));
  ok(JSON.stringify(counts) === JSON.stringify(['2,000', '13.6K', '2,000', '250K+', '13.6K', '4,389']), 'counters end on the real numbers ' + counts.join(' '));
  // Copy
  await go('#contact');
  await p.click('.copy-btn'); await p.waitForTimeout(300);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  ok(clip === 'rsignsv1279@gmail.com' && (await p.textContent('.copy-btn span')) === 'Copied', 'copy button copies the email');
  await p.screenshot({ path: `${require('os').tmpdir()}/play-contact.png` });
  ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no overflow');
  // Phone
  const ph = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  ph.on('pageerror', e => errs.push('phone ' + e.message));
  await ph.goto('http://127.0.0.1:8000/'); await ph.waitForTimeout(800);
  await ph.evaluate(() => { const el = document.querySelector('#philosophy'); scrollTo(0, el.getBoundingClientRect().top + scrollY - 60); }); await ph.waitForTimeout(1500);
  await ph.tap('.sig-card[data-signal="eda"]'); await ph.waitForTimeout(400);
  ok((await ph.textContent('.sig-meter strong')) === 'One signal on its own.', 'phone: tap toggles a signal');
  await ph.screenshot({ path: `${require('os').tmpdir()}/play-phone.png`, fullPage: false });
  ok(!(await ph.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'phone: no overflow');
  // Reduced motion
  const rm = await b.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  rm.on('pageerror', e => errs.push('rm ' + e.message));
  await rm.goto('http://127.0.0.1:8000/#ai'); await rm.waitForTimeout(2500);
  ok(await rm.evaluate(() => !document.querySelector('.pipeline').classList.contains('is-running')), 'reduced motion: pipeline stays still');
  ok(!errs.length, 'no errors ' + errs.join(' | '));
  await b.close();
})();
