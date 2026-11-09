// Contact form checks: per-field errors linked by aria-describedby, the sending state, a confirmed send (payload and endpoint), and honest errors when FormSubmit refuses or the network fails. FormSubmit is intercepted, so nothing is really sent.
// Run with the local server on :8000:  node deliverables/test-form.cjs
const { chromium } = require('playwright');
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const run = async (mode) => {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    let posted = null;
    await p.route('https://formsubmit.co/**', async r => {
      posted = { url: r.request().url(), method: r.request().method(), body: JSON.parse(r.request().postData() || '{}'), ct: r.request().headers()['content-type'] };
      await new Promise(res => setTimeout(res, 400));
      if (mode === 'success') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":"true","message":"The form was submitted successfully."}' });
      if (mode === 'refused') return r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":"false","message":"This form needs Activation."}' });
      return r.abort('failed');
    });
    await p.goto('http://127.0.0.1:8000/'); await p.waitForTimeout(800);
    await p.evaluate(() => document.getElementById('contact').scrollIntoView()); await p.waitForTimeout(1500);
    return { p, errs, get posted() { return posted; } };
  };
  // Validation (per field)
  {
    const { p, errs } = await run('success');
    await p.click('#contactForm button[type=submit]'); await p.waitForTimeout(300);
    const v = await p.evaluate(() => ({ status: document.getElementById('formStatus').textContent,
      errors: [...document.querySelectorAll('.field-error')].filter(e => !e.hidden).map(e => e.id + ': ' + e.textContent),
      linked: [...document.querySelectorAll('#contactForm [aria-invalid="true"]')].every(f => document.getElementById(f.getAttribute('aria-describedby'))?.textContent),
      focus: document.activeElement.id }));
    ok(v.errors.length === 4 && v.linked && v.focus === 'contactName', 'empty submit: 4 inline errors linked by aria-describedby, focus on Name: ' + v.status);
    console.log('     ' + v.errors.join(' | '));
    await p.fill('#contactName', 'Dana Ruiz'); await p.fill('#contactEmail', 'dana@'); await p.selectOption('#contactInterest', 'Pilot or demonstration'); await p.fill('#contactMessage', 'We would like a demo.');
    await p.click('#contactForm button[type=submit]'); await p.waitForTimeout(300);
    const e2 = await p.evaluate(() => [...document.querySelectorAll('.field-error')].filter(e => !e.hidden).map(e => e.textContent));
    ok(e2.length === 1 && /name@example\.org/.test(e2[0]), 'bad email: one specific error "' + e2[0] + '"');
    await p.fill('#contactEmail', 'dana@example.org'); await p.waitForTimeout(200);
    ok(await p.evaluate(() => document.getElementById('contactEmailError').hidden), 'error clears as the field is fixed');
    ok(!errs.length, 'no errors');
    await p.close();
  }
  // Success
  {
    const ctx = await run('success'); const { p } = ctx;
    await p.fill('#contactName', 'Dana Ruiz'); await p.fill('#contactEmail', 'dana@example.org'); await p.fill('#contactOrg', 'Ozark Learning Lab'); await p.selectOption('#contactInterest', 'Research collaboration'); await p.fill('#contactMessage', 'Interested in a pilot.');
    await p.click('#contactForm button[type=submit]');
    await p.waitForTimeout(100);
    const during = await p.evaluate(() => [document.querySelector('#contactForm button').textContent, document.querySelector('#contactForm button').disabled]);
    ok(during[0] === 'Sending…' && during[1], 'loading state: button disabled, "Sending…"');
    await p.waitForTimeout(900);
    const after = await p.evaluate(() => ({ status: document.getElementById('formStatus').textContent, cls: document.getElementById('formStatus').className, btn: document.querySelector('#contactForm button').textContent, name: document.getElementById('contactName').value }));
    ok(after.cls.includes('success') && after.btn === 'Explore a partnership' && after.name === '', 'confirmed send shows success and resets: "' + after.status + '"');
    const pb = ctx.posted;
    ok(pb && pb.method === 'POST' && pb.url === 'https://formsubmit.co/ajax/rsignsv1279@gmail.com' && pb.body.organization === 'Ozark Learning Lab' && pb.body.interest === 'Research collaboration' && pb.body._replyto === 'dana@example.org', 'payload posted to FormSubmit with all fields: ' + JSON.stringify(pb && pb.body));
    await p.close();
  }
  // Refused (e.g. not yet activated) and network failure: no fake success
  for (const mode of ['refused', 'network']) {
    const { p } = await run(mode);
    await p.fill('#contactName', 'Dana Ruiz'); await p.fill('#contactEmail', 'dana@example.org'); await p.selectOption('#contactInterest', 'General inquiry'); await p.fill('#contactMessage', 'Hello.');
    await p.click('#contactForm button[type=submit]'); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => ({ status: document.getElementById('formStatus').textContent, cls: document.getElementById('formStatus').className, kept: document.getElementById('contactMessage').value }));
    ok(r.cls.includes('error') && r.kept === 'Hello.', `${mode}: honest error, message kept: "${r.status}"`);
    await p.close();
  }
  await b.close();
})();
