// Phone checks for the 3D section: vertical swipes scroll the page in the film,
// a tap labels a part and the card stays on screen, the 360 view takes one-finger
// drags, and the film comes back. Run: node deliverables/test-prototype-interaction-phone.cjs
const { chromium } = require('playwright');
const ARGS = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ args: ARGS });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8000/#prototype'); await p.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  await p.waitForFunction(() => window.pathosPrototype?.stats.ready, undefined, { timeout: 180000 });
  for (let i = 0; i < 4; i++) { await p.evaluate(() => scrollTo(0, window.pathosPrototype.scrollYForFrame(1300))); await p.waitForTimeout(500); }
  await p.waitForFunction(() => { const s = window.pathosPrototype.state; return Math.abs(s.target - 1300) < 2 && s.frame === s.target; }, undefined, { timeout: 180000, polling: 300 });
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('#hwView canvas')).touchAction) === 'pan-y', 'film mode: canvas lets vertical swipes scroll the page');
  const pt = await p.evaluate(() => { const { scene, camera } = window.pathosPrototype.debug; const T = camera.position.constructor; const o = scene.getObjectByName('TMP117'); let m = null; o.traverse(c => { if (!m && c.isMesh) m = c; }); m.geometry.computeBoundingBox(); const c = m.geometry.boundingBox.getCenter(new T()); m.localToWorld(c); c.project(camera); const r = document.getElementById('hwView').getBoundingClientRect(); return [r.left + (c.x * 0.5 + 0.5) * r.width, r.top + (-c.y * 0.5 + 0.5) * r.height]; });
  await p.touchscreen.tap(pt[0], pt[1]); await p.waitForTimeout(1500);
  const lab = await p.evaluate(() => window.pathosPrototype.state.label);
  ok(lab && lab.startsWith('TMP117'), `tap labels the part: ${lab}`);
  await p.waitForTimeout(5000);
  await p.screenshot({ timeout: 180000, path: 'deliverables/pathos-hardware/phone-label.png' });
  await p.tap('#hw360'); await p.waitForTimeout(4000);
  ok(await p.evaluate(() => window.pathosPrototype.state.mode) === 'orbit', '360 view on phone');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('#hwView canvas')).touchAction) === 'none', '360 view: one-finger drag orbits');
  await p.waitForTimeout(4000);
  await p.screenshot({ timeout: 180000, path: 'deliverables/pathos-hardware/phone-360.png' });
  await p.tap('#hwExit360'); await p.waitForTimeout(6000);
  ok(await p.evaluate(() => window.pathosPrototype.state.mode) === 'film', 'back to the film');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no overflow');
  ok(!errs.length, 'no errors ' + errs.join('|'));
  await b.close();
})();
