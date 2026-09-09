const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
 await page.goto('http://127.0.0.1:8000/#prototype');
 await page.waitForFunction(()=>window.pathosPrototype?.stats.ready,{timeout:60000});
 await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
 await page.locator('img').evaluateAll(images=>images.forEach(i=>i.loading='eager'));
 await page.waitForTimeout(1200);
 const states=[];
 for(let i=0;i<10;i++){
  await page.evaluate(i=>scrollTo(0,window.pathosPrototype.state.anchors[i]),i);
  await page.waitForTimeout(350);
  states.push(await page.evaluate(()=>window.pathosPrototype.state));
  if(states[i].cableEndpointError>.00001)throw Error('Cable endpoint drift '+i);
  await page.screenshot({path:'deliverables/prototype-chapter-'+i+'.png'});
 }
 for(const i of [7,3,0]){
  await page.evaluate(i=>scrollTo(0,window.pathosPrototype.state.anchors[i]),i);await page.waitForTimeout(100);
  const state=await page.evaluate(()=>window.pathosPrototype.state);
  if(Math.abs(state.time-states[i].time)>.002)throw Error('Reverse seek mismatch '+JSON.stringify({i,before:states[i].time,after:state.time,anchorBefore:states[i].anchors[i],anchorAfter:state.anchors[i]}));
 }
 await page.locator('#prototypeExplore').click();
 const before=await page.evaluate(()=>window.pathosPrototype.state.camera);
 await page.locator('#prototypeView canvas').press('ArrowLeft');
 const after=await page.evaluate(()=>window.pathosPrototype.state.camera);
 if(JSON.stringify(before)===JSON.stringify(after))throw Error('Orbit failed');
 await page.locator('#prototypeComponent').selectOption('ADS1115');
 if(!(await page.locator('#prototypeDetail').textContent()).includes('A0'))throw Error('Selection failed');
 await page.locator('#prototypeView canvas').press('Escape');
 await page.waitForTimeout(100);
 if((await page.evaluate(()=>window.pathosPrototype.state.exploring)))throw Error('Guided return failed');
 const resumed=await page.evaluate(()=>window.pathosPrototype.state);
 if(resumed.camera.some((n,i)=>Math.abs(n-states[0].camera[i])>.00001))throw Error('Camera did not resume guided pose');
 await page.evaluate(async()=>{
  const a=window.pathosPrototype.state.anchors;
  await new Promise(resolve=>{let start;function tick(t){start??=t;const p=Math.min((t-start)/4000,1);scrollTo(0,a[0]+(a[9]-a[0])*p);if(p<1)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick)});
 });
 const performance=await page.evaluate(()=>window.pathosPrototype.stats);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
 await page.evaluate(()=>scrollTo(0,window.pathosPrototype.state.anchors[2]));await page.waitForTimeout(200);
 await page.screenshot({path:'deliverables/prototype-mobile.png'});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>scrollTo(0,window.pathosPrototype.state.anchors[4]));await page.waitForTimeout(200);
 const reduced=await page.evaluate(()=>window.pathosPrototype.state);
 fs.writeFileSync('deliverables/prototype-validation.json',JSON.stringify({errors,states,performance,overflow,reduced},null,2));
 console.log(JSON.stringify({errors,overflow,ready:performance.ready,drawCalls:performance.drawCalls,triangles:performance.triangles,frames:performance.frames,medianFrameMs:performance.frameIntervals.sort((a,b)=>a-b)[Math.floor(performance.frameIntervals.length/2)]}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
