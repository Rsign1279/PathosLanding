// Failure modes for the 3D hardware section: missing model, failed Draco
// decoder, and no WebGL. Each must keep the poster, show a clear message and
// still move the chapter titles with the scroll.
const { chromium } = require('playwright');
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

async function check(browser, mode) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  if (mode === 'missing-model') await page.route(/pathos-hardware\.glb$/, r => r.fulfill({ status: 404, body: '' }));
  if (mode === 'decoder-failure') await page.route(/draco_(decoder|wasm_wrapper)/, r => r.fulfill({ status: 404, body: '' }));
  if (mode === 'no-webgl') await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/.test(type) ? null : get.call(this, type, ...rest); };
  });
  await page.goto('http://127.0.0.1:8000/#prototype');
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  await page.waitForFunction(() => /could not load/.test(document.getElementById('hwStatus').textContent), undefined, { timeout: 120000 });
  const posterVisible = await page.$eval('#hwPoster', i => i.complete && i.naturalWidth > 0 && getComputedStyle(i).opacity !== '0');
  // Sections above render lazily and can shift the page; re-aim until the
  // scroll position really maps to frame 1300.
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => scrollTo(0, window.pathosPrototype.scrollYForFrame(1300)));
    await page.waitForTimeout(400);
    const f = await page.evaluate(() => window.pathosPrototype.frameAt(window.pathosPrototype.scrollProgress()));
    if (Math.abs(f - 1300) < 2) break;
  }
  const titleOn = await page.$eval('#hwHud .hw-chapter:nth-child(5)', el => el.classList.contains('is-on'));
  await page.close();
  return { mode, passed: posterVisible && titleOn, posterVisible, titleOn };
}

(async () => {
  const browser = await chromium.launch({ args: ARGS });
  const results = [];
  for (const mode of ['missing-model', 'decoder-failure', 'no-webgl']) results.push(await check(browser, mode));
  console.log(JSON.stringify(results));
  await browser.close();
  if (results.some(r => !r.passed)) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
