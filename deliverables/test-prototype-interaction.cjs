// Interaction checks for the 3D section: in the film, clicks and drags never move
// anything (only scroll does); clicking a part labels it; seeking to the end and
// back is exact; the 360 view orbits gently, stays above the table, zooms with
// its buttons, leaves the mouse wheel to the page, and Esc returns to the film.
// Run with the local server on :8000:  node deliverables/test-prototype-interaction.cjs
const { chromium } = require('playwright');
const ARGS = ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ args: ARGS });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8000/#prototype'); await p.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  await p.waitForFunction(() => window.pathosPrototype?.stats.ready, undefined, { timeout: 180000 });
  const settle = () => p.waitForFunction(() => { const s = window.pathosPrototype.state; return s.frame === s.target && !s.tweening && !s.rendering; }, undefined, { timeout: 900000, polling: 300 });
  const seek = async f => { for (let i = 0; i < 4; i++) { await p.evaluate(f => scrollTo(0, window.pathosPrototype.scrollYForFrame(f)), f); await p.waitForTimeout(300); } await p.waitForFunction(f => Math.abs(window.pathosPrototype.state.target - f) < 2, f, { timeout: 60000 }); await settle(); };
  const pose = () => p.evaluate(() => { const { scene, camera } = window.pathosPrototype.debug; scene.updateMatrixWorld(true); const e = camera.matrixWorld.elements; const o = { cam: Array.from(e).map(v => +v.toFixed(5)) }; for (const n of ['ESP32_S3', 'TMP117', 'MAX30102', 'Laptop']) { const x = scene.getObjectByName(n); o[n] = x.matrixWorld.elements.slice(12, 15).map(v => +v.toFixed(5)); } o.frame = window.pathosPrototype.state.frame; return o; });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  let v;
  const at = (fx, fy) => [v.x + v.width * fx, v.y + v.height * fy];

  await seek(1300);
  v = await p.locator('#hwView').boundingBox();
  const base = await pose();
  // 1. Film mode: moving, dragging, clicking anywhere never moves the film.
  await p.mouse.move(...at(0.2, 0.2)); await p.mouse.move(...at(0.8, 0.7), { steps: 20 });
  await p.mouse.move(...at(0.5, 0.5)); await p.mouse.down(); await p.mouse.move(...at(0.1, 0.9), { steps: 25 }); await p.mouse.up();
  for (const [x, y] of [[0.3, 0.3], [0.7, 0.4], [0.5, 0.8]]) await p.mouse.click(...at(x, y));
  await p.mouse.dblclick(...at(0.6, 0.6));
  await p.waitForTimeout(1500); await settle();
  ok(same(base, await pose()), 'film mode: pointer moves, drags and clicks leave camera and parts exactly where they were');

  // 2. Click a part: label appears with its name; clicking empty table clears it.
  const pt = await p.evaluate(() => { const { scene, camera } = window.pathosPrototype.debug; const T = camera.position.constructor; const o = scene.getObjectByName('ESP32_S3'); let m = null; o.traverse(c => { if (!m && c.isMesh) m = c; }); m.geometry.computeBoundingBox(); const c = m.geometry.boundingBox.getCenter(new T()); m.localToWorld(c); c.project(camera); const r = document.getElementById('hwView').getBoundingClientRect(); return [r.left + (c.x * 0.5 + 0.5) * r.width, r.top + (-c.y * 0.5 + 0.5) * r.height]; });
  await p.mouse.click(pt[0], pt[1]); await p.waitForTimeout(800);
  let st = await p.evaluate(() => ({ ...window.pathosPrototype.state, shown: !document.getElementById('hwLabel').hidden, text: document.querySelector('#hwLabel strong').textContent }));
  ok(st.shown && st.label === 'ESP32-S3', `click on the ESP32 labels it: ${st.text}`);
  ok(same(base, await pose()), 'labelling does not move the film');
  await p.waitForTimeout(5200); await p.screenshot({ timeout: 180000, path: 'deliverables/pathos-hardware/label.png', clip: { x: v.x, y: v.y, width: v.width, height: v.height } });
  await p.mouse.click(...at(0.06, 0.62)); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.getElementById('hwLabel').hidden), 'click on empty table clears the label ' + JSON.stringify(await p.evaluate(() => window.pathosPrototype.state.label)));

  // 3. Seek to the very end and back: everything returns exactly.
  await seek(2880); await seek(1300);
  const back = await pose();
  ok(same({ ...base, cam: null, frame: 0 }, { ...back, cam: null, frame: 0 }) && base.cam.every((x, i) => Math.abs(x - back.cam[i]) < 1e-3), 'end of film and back: parts and camera return exactly');

  // 4. 360 view: drag orbits gently, film camera untouched, wheel still scrolls page, exit glides back.
  await p.click('#hw360'); await p.waitForTimeout(1500); await settle();
  st = await p.evaluate(() => window.pathosPrototype.state);
  ok(st.mode === 'orbit', 'enter 360 view');
  const oc0 = await p.evaluate(() => window.pathosPrototype.debug.orbitCam.position.toArray());
  await p.mouse.move(...at(0.5, 0.5)); await p.mouse.down(); await p.mouse.move(...at(0.3, 0.45), { steps: 20 }); await p.mouse.up();
  await p.waitForTimeout(1500); await settle();
  const oc1 = await p.evaluate(() => window.pathosPrototype.debug.orbitCam.position.toArray());
  const moved = Math.hypot(...oc1.map((x, i) => x - oc0[i]));
  ok(moved > 0.01 && moved < 0.8, `drag orbits the view by a gentle amount (${moved.toFixed(3)} m)`);
  const aboveTable = await p.evaluate(() => { const { orbit } = window.pathosPrototype.debug; return orbit.getPolarAngle() <= Math.PI / 2 - 0.05; });
  ok(aboveTable, 'orbit stays above the table');
  // hard drag down tries to go under the table
  await p.mouse.move(...at(0.5, 0.3)); await p.mouse.down(); await p.mouse.move(...at(0.5, 0.99), { steps: 30 }); await p.mouse.up(); await settle();
  ok(await p.evaluate(() => window.pathosPrototype.debug.orbit.getPolarAngle() <= Math.PI / 2 - 0.05), 'cannot drag under the table');
  const d0 = await p.evaluate(() => { const { orbit, orbitCam } = window.pathosPrototype.debug; return orbitCam.position.distanceTo(orbit.target); });
  await p.click('#hwZoomIn'); await p.waitForTimeout(1200); await settle();
  const d1 = await p.evaluate(() => { const { orbit, orbitCam } = window.pathosPrototype.debug; return orbitCam.position.distanceTo(orbit.target); });
  ok(d1 < d0 * 0.9, `zoom in button (${d0.toFixed(3)} -> ${d1.toFixed(3)})`);
  const y0 = await p.evaluate(() => scrollY);
  await p.mouse.move(...at(0.5, 0.5)); await p.mouse.wheel(0, 300); await p.waitForTimeout(3000);
  const y1 = await p.evaluate(() => scrollY);
  ok(y1 > y0, `mouse wheel still scrolls the page in 360 view (${y0} -> ${y1})`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(1500); await settle();
  st = await p.evaluate(() => window.pathosPrototype.state);
  ok(st.mode === 'film' && !st.tweening, 'Esc returns to the film');
  ok(errs.length === 0, 'no errors ' + errs.join(' | '));
  await b.close();
})();
