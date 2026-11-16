// Renders the pre-rendered 3D film (assets/hw-seq/NNN.webp) from the live
// scene: every 6th film frame (480 images), 1600x800 (film frame 1280x720 in the middle),
// drawn at 1.5x and downscaled. Usage:
//   node deliverables/hw-bake.cjs <outDir> [fromIndex] [toIndex]
// writes the WebP files directly (downscaled in the browser, quality 0.72).
// Needs the site on http://127.0.0.1:8000/.
const { chromium } = require('playwright');
const fs = require('fs');
const [,, out, from = '0', to = '480'] = process.argv;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://127.0.0.1:8000/?bake', { waitUntil: 'load' });
  await p.waitForFunction(() => window.pathosBakeReady, undefined, { timeout: 600000 });
  // Downscale 2400x1200 -> 1600x800 with high-quality smoothing, encode WebP.
  await p.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1600; c.height = 800;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    window.pathosBakeWebp = f => {
      const src = new Image();
      return new Promise(res => { src.onload = () => { g.drawImage(src, 0, 0, 1600, 800); res(c.toDataURL('image/webp', 0.72)); }; src.src = window.pathosBake(f); });
    };
  });
  fs.mkdirSync(out, { recursive: true });
  const t0 = Date.now();
  for (let k = +from; k < +to; k++) {
    const f = Math.min(2880, 1 + k * 6);
    const url = await p.evaluate(f => window.pathosBakeWebp(f), f);
    if (!url.startsWith('data:image/webp')) throw new Error('not webp');
    fs.writeFileSync(`${out}/${String(k).padStart(3, '0')}.webp`, Buffer.from(url.split(',')[1], 'base64'));
    if (k === +from) console.log('first frame', Date.now() - t0, 'ms');
  }
  console.log('baked', to - from, 'in', ((Date.now() - t0) / 1000).toFixed(0), 's');
  await b.close();
})();
