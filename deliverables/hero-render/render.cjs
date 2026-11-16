const { chromium } = require('playwright');
const fs = require('fs');
const [,, w, h, frames, out, from = 0, to] = process.argv;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(`http://127.0.0.1:8002/scene.html?w=${w}&h=${h}&frames=${frames}`);
  await p.waitForFunction(() => window.ready, undefined, { timeout: 120000 });
  fs.mkdirSync(out, { recursive: true });
  const end = to ? +to : +frames;
  const t0 = Date.now();
  for (let i = +from; i < end; i++) {
    const url = await p.evaluate(i => window.renderFrame(i), i);
    fs.writeFileSync(`${out}/f${String(i).padStart(4, '0')}.png`, Buffer.from(url.split(',')[1], 'base64'));
    if (i === +from) console.log('first frame ms', Date.now() - t0);
  }
  console.log('done', end - from, 'frames in', ((Date.now() - t0) / 1000).toFixed(0), 's');
  await b.close();
})();
