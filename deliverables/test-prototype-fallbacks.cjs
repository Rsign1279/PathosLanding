const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const results=[];
 for(const mode of ['decoder-fallback','missing-model','no-webgl','reduced-motion']){
  const page=await browser.newPage({viewport:{width:768,height:1024},reducedMotion:mode==='reduced-motion'?'reduce':'no-preference'});
  if(mode==='decoder-fallback')await page.route('**/assets/vendor/draco/**',r=>r.abort());
  if(mode==='missing-model')await page.route('**/*.glb',r=>r.abort());
  if(mode==='no-webgl')await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args)}});
  await page.goto('http://127.0.0.1:8000/#prototype');
  if(['missing-model','no-webgl'].includes(mode)){
   await page.waitForFunction(()=>document.querySelector('#prototypeStatus').textContent.includes('could not load'));
   if(await page.locator('.prototype-chapter').count()!==10)throw Error('Missing fallback narrative');
  }else{
   await page.waitForFunction(()=>window.pathosPrototype?.stats.ready,{timeout:60000});
   if(mode==='reduced-motion'){
    await page.evaluate(()=>scrollTo({top:window.pathosPrototype.state.anchors[4],behavior:'instant'}));await page.waitForTimeout(200);
    const s=await page.evaluate(()=>window.pathosPrototype.state);if(Math.abs(s.time-24.75)>.01)throw Error('Reduced motion did not settle');
   }
  }
  results.push({mode,passed:true});await page.close();
 }
 console.log(JSON.stringify(results));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
