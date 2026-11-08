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
  await page.evaluate(() => {
    const tr = document.getElementById('hwTrack'), st = document.getElementById('hwStage');
    scrollTo(0, tr.getBoundingClientRect().top + scrollY + window.pathosPrototype.progressAt(1300) * (tr.offsetHeight - st.offsetHeight) + 1);
  });
  await page.waitForTimeout(400);
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
