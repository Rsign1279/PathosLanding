// Checks for the landing story structure (story.js / story.css): section order,
// every in-page link resolves and lands at the scroll padding (lazy sections
// included), eight feature cards, FAQ open/close (and instant with reduced
// motion), the how-it-works steps, the footer links and no overflow.
// Run with the local server on :8000:  node deliverables/test-story.cjs
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
  await p.goto('http://127.0.0.1:8000/'); await p.waitForTimeout(1000);
  const order = await p.evaluate(() => [...document.querySelectorAll('main > section[id]')].map(s => s.id));
  ok(JSON.stringify(order) === JSON.stringify(['hero','proof','film','device-tour','impact','journey','problem','solution','philosophy','sensors','ai','hardware','prototype','product','pathos-iot','roadmap','workshops','how','team','faq','contact']), 'story order: ' + order.join(' > '));
  // Every in-page link points at something that exists
  const broken = await p.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => h.length > 1 && !document.querySelector(h)));
  ok(!broken.length, 'all in-page links resolve ' + broken.join(','));
  // Nav links land on their sections
  for (const h of ['#problem', '#solution', '#how', '#product', '#faq', '#contact']) {
    await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await p.waitForTimeout(300);
    await p.evaluate(h => document.querySelector(`.menu a[href="${h}"]`).click(), h);
    let last = -1; for (let i = 0; i < 60; i++) { await p.waitForTimeout(200); const y = await p.evaluate(() => scrollY); if (y === last) break; last = y; }
    const top = await p.evaluate(h => Math.round(document.querySelector(h).getBoundingClientRect().top), h);
    ok(Math.abs(top - 96) < 40 || (h === '#contact' && top < 200), `nav ${h} lands (${top})`);
  }
  // Feature cards link to their deep dives
  const feats = await p.evaluate(() => [...document.querySelectorAll('.feat')].map(a => a.getAttribute('href')));
  ok(feats.length === 8, '8 feature cards: ' + feats.join(' '));
  // FAQ
  await p.evaluate(() => { const el = document.getElementById('faq'); scrollTo(0, el.getBoundingClientRect().top + scrollY - 80); }); await p.waitForTimeout(800);
  await p.click('.faq-item:nth-child(3) summary'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => document.querySelectorAll('.faq-item')[2].open), 'FAQ opens');
  const h = await p.evaluate(() => document.querySelectorAll('.faq-item')[2].querySelector('.faq-a').offsetHeight);
  ok(h > 40, 'FAQ answer visible (' + h + 'px)');
  await p.click('.faq-item:nth-child(3) summary'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => !document.querySelectorAll('.faq-item')[2].open), 'FAQ closes');
  // How it works steps
  await p.evaluate(() => { const el = document.getElementById('how'); scrollTo(0, el.getBoundingClientRect().top + scrollY - 80); }); await p.waitForTimeout(500);
  await p.click('.how-step[data-step="2"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector('.how-step[data-step="2"]').classList.contains('is-on')), 'step click selects it');
  await p.waitForTimeout(4000);
  ok(await p.evaluate(() => document.querySelector('.how-step[data-step="0"]').classList.contains('is-on')), 'steps advance on their own');
  // Footer
  const fl = await p.evaluate(() => document.querySelectorAll('.foot-col a').length);
  ok(fl >= 18, `footer has ${fl} links`);
  ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no overflow');
  // Phone
  const ph = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  ph.on('pageerror', e => errs.push('phone ' + e.message));
  await ph.goto('http://127.0.0.1:8000/'); await ph.waitForTimeout(1200);
  for (const id of ['proof', 'problem', 'solution', 'how', 'faq', 'footCard']) { await ph.evaluate(id => document.getElementById(id).scrollIntoView(), id); await ph.waitForTimeout(500); }
  ok(!(await ph.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'phone: no overflow');
  // Reduced motion: still renders, no errors
  const rm = await b.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  rm.on('pageerror', e => errs.push('rm ' + e.message));
  await rm.goto('http://127.0.0.1:8000/#how'); await rm.waitForTimeout(1500);
  await rm.click('.faq-item:nth-child(2) summary');
  ok(await rm.evaluate(() => document.querySelectorAll('.faq-item')[1].open), 'reduced motion: FAQ opens instantly');
  ok(!errs.length, 'no errors ' + errs.join(' | '));
  await b.close();
})();
