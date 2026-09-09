import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const section = document.querySelector('#prototype');
const view = document.querySelector('#prototypeView');
const status = document.querySelector('#prototypeStatus');
const exploreButton = document.querySelector('#prototypeExplore');
const componentSelect = document.querySelector('#prototypeComponent');
const detail = document.querySelector('#prototypeDetail');
const resetButton = document.querySelector('#prototypeReset');
const help = document.querySelector('#prototypeHelp');
const hoverLabel = document.querySelector('#prototypeHover');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const chapters = [...section.querySelectorAll('.prototype-chapter')];
const descriptions = {
 Breadboard:'Representative 166 × 63 mm breadboard. Routes communicate logical nets, not an electrically validated terminal layout.',
 ESP32_S3:'ESP32-S3 — coordinates acquisition, timestamps samples, manages SPI storage and sends data over Wi-Fi.',
 TMP117:'TMP117 — skin-contact temperature at an accessible thermal island. I2C address 0x48.',
 ADS1115:'ADS1115 — converts GSR analog output at A0. ADDR tied to VDD represents I2C address 0x49.',
 MPU6050:'MPU6050 — motion and orientation context. Shared I2C bus, address 0x68.',
 MAX30102:'MAX30102 — optical PPG sensing. The finger-contact window stays accessible. I2C address 0x57.',
 BME280:'BME280 — environmental temperature, humidity and pressure. Its air aperture remains exposed. I2C address 0x76.',
 GSR_Module:'GSR module — electrode interface with analog OUT routed to ADS1115 A0, not an ESP32 analog input.',
 GSR_Electrode_Left:'Left finger electrode — one of two contacts connected to the GSR module.',
 GSR_Electrode_Right:'Right finger electrode — independently transformable contact connected to the GSR module.',
 MicroSD_Breakout:'microSD breakout — separate SPI bus: CLK GPIO12, MISO GPIO13, MOSI GPIO11, CS GPIO10.',
 MicroSD_Card:'Inserted microSD card — separately movable within the storage breakout.',
 PowerBank:'USB power bank — powers the ESP32 controller. It is not a laptop data link.',
 USB_Cable:'USB cable — 5 V power from the bank to the controller, with a deforming service loop.',
 Laptop:'Laptop — illustrated wireless receiver and signal-processing destination. No physical data cable.',
 Laptop_Screen:'PATHOS dashboard — five simulated waveforms. This presentation does not run live measurements or V4 inference.'
};
const labels = n => n.replaceAll('_',' ').replace('MicroSD','microSD');
for (const n of Object.keys(descriptions)) componentSelect.add(new Option(labels(n),n));
const clamp = THREE.MathUtils.clamp;
const smooth = x => x*x*(3-2*x);
const v = a => new THREE.Vector3(...a);
// glTF is in meters, Y-up. These continuous browser poses replace Blender cuts.
const poses = [
 [[.14,.23,.409],[.005,.05,-.12]],
 [[.13,.24,.23],[0,.044,0]],
 [[-.086,.155,.133],[-.044,.049,0]],
 [[.087,.205,.148],[.022,.052,0]],
 [[.18,.195,.235],[.061,.036,.012]],
 [[.057,.132,.123],[.033,.047,.012]],
 [[.29,.35,.48],[.015,.035,-.13]],
 [[.073,.22,.005],[.072,.106,-.395]],
 [[.29,.36,.48],[.02,.035,-.13]],
 [[.14,.23,.409],[.005,.05,-.12]]
];
const times=[.042,11.25,14.75,19.85,24.75,27.75,32.25,37.25,41.75,47.999];
let renderer,scene,camera,model,mixer,controls,paths,active=false,exploring=false,selected='',hovered='';
let anchors=[],chapter=0,storyTime=0,lastStamp=0,dirty=true,frame=0,quality=1.5;
let wireSignals=[],wireless=[],meshes=[],materials=[],objects={},initialPositions={};
let lastRender=0,slowFrames=0;
const stats={frames:0,frameIntervals:[],drawCalls:0,triangles:0,quality:0,ready:false};
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
const target=new THREE.Vector3(),scratch=new THREE.Vector3();
let guidedPosition=new THREE.Vector3(),guidedTarget=new THREE.Vector3();

function fail(message) {
 status.hidden=false;
 status.replaceChildren(document.createTextNode('PATHOS'));
 const text=document.createElement('small');
 text.textContent=message+' The complete system story is available as you scroll.';
 status.append(text);
 const retry=document.createElement('button');retry.textContent='Retry 3D';retry.onclick=()=>location.reload();status.append(retry);
 exploreButton.disabled=true;
}
function resize() {
 if(!renderer)return;
 const w=view.clientWidth,h=view.clientHeight;
 renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
 anchors=chapters.map(el=>el.getBoundingClientRect().top+scrollY+el.offsetHeight/2-innerHeight/2);
 dirty=true;
}
function timeline() {
 let i=0;
 while(i<anchors.length-2&&scrollY>anchors[i+1])i++;
 let f=clamp((scrollY-anchors[i])/(anchors[i+1]-anchors[i]),0,1);
 // Browser scroll positions round to pixels; snap within one pixel of a stop.
 if(Math.abs(scrollY-anchors[i])<1)f=0;
 if(Math.abs(scrollY-anchors[i+1])<1)f=1;
 const current=f<.5?i:i+1;
 const blend=reduced.matches?(f<.5?0:1):smooth(f);
 return {i,f,blend,current,time:THREE.MathUtils.lerp(times[i],times[i+1],reduced.matches?(f<.5?0:1):f)};
}
function world(name) { return objects[name].getWorldPosition(new THREE.Vector3()); }
function highlight() {
 const busStart=(times[2]+times[3])/2, busEnd=(times[3]+times[4])/2;
 const sensorIndex=clamp(Math.floor((storyTime-busStart)/(busEnd-busStart)*5),0,4);
 const list=chapter===2?['ESP32_S3']:chapter===3?[[ 'TMP117','ADS1115','MPU6050','MAX30102','BME280'][sensorIndex]]:chapter===4?['GSR_Module','ADS1115','GSR_Electrode_Left','GSR_Electrode_Right']:chapter===5?['MicroSD_Breakout','MicroSD_Card']:chapter===6?['ESP32_S3','Laptop']:chapter===7?['Laptop_Screen']:[];
 const focus=selected||hovered;
 for(const item of materials){
  const on=focus?item.owner===focus:list.includes(item.owner);
  item.material.emissive.copy(item.emissive);
  if(on)item.material.emissive.add(new THREE.Color(.025,.10,.13));
 }
}
function select(name) {
 selected=name;componentSelect.value=name;
 detail.textContent=descriptions[name]||'Scroll to guide the camera. Select a component to learn more.';
 dirty=true;
}
function owner(object) {
 while(object){if(descriptions[object.name])return object.name;object=object.parent;}
 return '';
}
function hit(event) {
 const r=renderer.domElement.getBoundingClientRect();
 pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);
 raycaster.setFromCamera(pointer,camera);
 return raycaster.intersectObjects(meshes,false).map(hit=>owner(hit.object)).find(Boolean)||'';
}
function setExplore(value) {
 exploring=value;controls.enabled=value;controls.enableZoom=value;controls.enableRotate=value;
 section.classList.toggle('is-exploring',value);
 exploreButton.textContent=value?'Return to guided tour':'Explore model';
 exploreButton.setAttribute('aria-pressed',String(value));
 resetButton.hidden=!value;help.hidden=!value;
 if(value){controls.target.copy(guidedTarget);controls.update();renderer.domElement.focus({preventScroll:true});}
 else {hovered='';hoverLabel.hidden=true;dirty=true;exploreButton.focus({preventScroll:true});}
 dirty=true;
}
function resetExplore() {
 camera.position.copy(guidedPosition);controls.target.copy(guidedTarget);controls.update();dirty=true;
}
function buildSignals() {
 const geometry=new THREE.SphereGeometry(.00095,8,6);
 const material=new THREE.MeshBasicMaterial({color:0xa7ecff});
 for(const [name,path] of Object.entries(paths)){
  if(!/^(SDA_|SPI_|GSR_OUT|Electrode_)/.test(name))continue;
  const wire=objects[name];if(!wire)continue;
  const dot=new THREE.Mesh(geometry,material);dot.visible=false;scene.add(dot);
  wireSignals.push({name,path,wire,dot});
 }
 const a=world('ESP32_S3'),b=world('Laptop');
 a.y+=.025;b.y+=.09;
 const curve=new THREE.QuadraticBezierCurve3(a,a.clone().lerp(b,.5).add(v([0,.13,0])),b);
 // Discrete dashes make the wireless path unambiguously non-physical.
 const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(64)),new THREE.LineDashedMaterial({color:0x80c8e0,dashSize:.006,gapSize:.006,transparent:true,opacity:.35}));
 line.computeLineDistances();scene.add(line);wireless.push({line,curve});
 for(let i=0;i<3;i++){const dot=new THREE.Mesh(geometry,material);scene.add(dot);wireless.push({dot,curve,offset:i/3});}
}
function updateSignals() {
 if(wireless.length){
  const curve=wireless[0].curve;
  curve.v0.copy(world('ESP32_S3')).y+=.008;
  curve.v2.copy(world('Laptop')).y+=.09;
  curve.v1.copy(curve.v0).lerp(curve.v2,.5).y+=.13;
  const position=wireless[0].line.geometry.attributes.position;
  for(let i=0;i<position.count;i++){curve.getPoint(i/(position.count-1),scratch);position.setXYZ(i,scratch.x,scratch.y,scratch.z);}
  position.needsUpdate=true;wireless[0].line.computeLineDistances();
 }
 for(const {name,path,wire,dot} of wireSignals){
  dot.visible=!reduced.matches&&((chapter===3&&name.startsWith('SDA_'))||(chapter===4&&/^(Electrode_|GSR_OUT|SDA_)/.test(name))||(chapter===5&&name.startsWith('SPI_')));
  if(!dot.visible)continue;
  let t=(storyTime*1.4)%1;
  if(name.startsWith('SDA_')||name==='SPI_MISO')t=1-t;
  const index=t*(path.points.length-1),a=Math.floor(index),b=Math.min(a+1,path.points.length-1);
  function point(index){
   const p=v(path.points[index]);
   for(const [key,coords] of Object.entries(path.targets)){
    const influence=wire.morphTargetInfluences?.[wire.morphTargetDictionary?.[key]]||0;
    p.addScaledVector(v(coords[index]).sub(v(path.points[index])),influence);
   }
   return p;
  }
  dot.position.copy(point(a).lerp(point(b),index-a));
 }
 for(const item of wireless){
  const visible=chapter===6||chapter===8;
  if(item.line)item.line.visible=visible;
  if(item.dot){item.dot.visible=visible&&!reduced.matches;item.dot.position.copy(item.curve.getPoint((storyTime*.7+item.offset)%1));}
 }
}
function render(stamp) {
 frame=requestAnimationFrame(render);
 if(!active||document.hidden||!mixer)return;
 if(!dirty)return;
 if(!exploring){
  const t=timeline();
  if(chapter!==t.current){select('');hovered='';hoverLabel.hidden=true;}
  chapter=t.current;storyTime=t.time;
  mixer.setTime(storyTime);model.updateMatrixWorld(true);
  guidedTarget.copy(v(poses[t.i][1])).lerp(v(poses[t.i+1][1]),t.blend);
  guidedPosition.copy(v(poses[t.i][0])).lerp(v(poses[t.i+1][0]),t.blend);
  // Narrow canvases pull back; desktop keeps the board prominent.
  if(camera.aspect<1.15)guidedPosition.sub(guidedTarget).multiplyScalar(1.15/camera.aspect).add(guidedTarget);
  camera.position.copy(guidedPosition);camera.lookAt(guidedTarget);
  document.querySelector('#prototypeCounter').textContent=String(chapter+1).padStart(2,'0')+' / 10';
  document.querySelector('#prototypeProgress').style.transform='scaleX('+clamp((storyTime-.042)/47.957,0,1)+')';
  chapters.forEach((el,i)=>el.classList.toggle('is-current',i===chapter));
 }
 highlight();updateSignals();renderer.render(scene,camera);
 if(lastRender&&stamp-lastRender<150){stats.frameIntervals.push(stamp-lastRender);if(stats.frameIntervals.length>600)stats.frameIntervals.shift();}
 lastRender=stamp;stats.frames++;stats.drawCalls=renderer.info.render.calls;stats.triangles=renderer.info.render.triangles;
 if(lastStamp&&stamp-lastStamp>28)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);
 if(slowFrames>30&&quality>1){quality=1;renderer.setPixelRatio(quality);resize();slowFrames=0;}
 stats.quality=quality;lastStamp=stamp;dirty=false;
}

async function init() {
 try{
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
 renderer.setClearColor(0x080f19,0);
 quality=Math.min(devicePixelRatio,innerWidth<800?1.25:1.5);
 renderer.setPixelRatio(quality);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 view.prepend(renderer.domElement);renderer.domElement.tabIndex=0;
 renderer.domElement.setAttribute('aria-label','PATHOS 3D model. Use the component selector to identify parts. Explore mode enables orbit and zoom.');
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(38,1,.001,10);
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
 const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
 scene.environmentIntensity=.45;
 scene.add(new THREE.HemisphereLight(0xe0efff,0x253647,.65));
 const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(-.3,.6,.4);scene.add(key);
 key.castShadow=true;key.shadow.mapSize.set(1024,1024);
 Object.assign(key.shadow.camera,{left:-.45,right:.45,top:.5,bottom:-.5,near:.01,far:2});
 key.shadow.bias=-.00015;key.shadow.normalBias=.0002;key.shadow.radius=3;
 const fill=new THREE.DirectionalLight(0xa8dfff,.6);fill.position.set(.4,.2,-.2);scene.add(fill);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShadowMaterial({opacity:.22}));
 floor.rotation.x=-Math.PI/2;floor.position.y=-.004;floor.receiveShadow=true;scene.add(floor);
 controls=new OrbitControls(camera,renderer.domElement);
 controls.enabled=false;controls.enableDamping=false;controls.enablePan=false;
 controls.minDistance=.055;controls.maxDistance=1.5;controls.minPolarAngle=.12;controls.maxPolarAngle=Math.PI*.49;
 controls.addEventListener('change',()=>dirty=true);
 const draco=new DRACOLoader();draco.setDecoderPath('./assets/vendor/draco/');draco.setDecoderConfig({type:'wasm'});
 const loader=new GLTFLoader();loader.setDRACOLoader(draco);
 const progress=e=>{status.querySelector('small').textContent=e.total?'Loading prototype · '+Math.round(e.loaded/e.total*100)+'%':'Loading prototype · '+(e.loaded/1048576).toFixed(1)+' MB';};
 let gltf;
 try{gltf=await loader.loadAsync('./deliverables/pathos-3d-v2/PATHOS_Web_v2_Draco.glb',progress);}
 catch{gltf=await new GLTFLoader().loadAsync('./deliverables/pathos-3d-v2/PATHOS_Web_v2.glb',progress);}
 draco.dispose();
 model=gltf.scene;scene.add(model);
 model.traverse(o=>{
  objects[o.name]=o;
  if(!o.isMesh)return;
  o.frustumCulled=false;meshes.push(o);
  o.castShadow=!o.morphTargetInfluences;o.receiveShadow=true;
  const clone=m=>{const c=m.clone();materials.push({material:c,emissive:c.emissive.clone(),owner:owner(o)});return c;};
  o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);
 });
 for(const n of ['PATHOS_ROOT',...Object.keys(descriptions)])if(!objects[n])throw new Error('Missing model component: '+n);
 mixer=new THREE.AnimationMixer(model);
 for(const clip of gltf.animations){const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();}
 mixer.setTime(.042);model.updateMatrixWorld(true);
 for(const n of Object.keys(descriptions))initialPositions[n]=world(n);
 const response=await fetch('./assets/prototype-paths.json');if(!response.ok)throw new Error('Signal paths unavailable');
 paths=await response.json();buildSignals();
 status.hidden=true;exploreButton.disabled=false;stats.ready=true;
 resize();new ResizeObserver(resize).observe(view);
 new ResizeObserver(resize).observe(document.body);
 new IntersectionObserver(entries=>{active=entries[0].isIntersecting;document.body.classList.toggle('prototype-active',active);dirty=true;},{rootMargin:'100px'}).observe(section);
 addEventListener('scroll',()=>dirty=true,{passive:true});
 addEventListener('resize',resize,{passive:true});
 document.fonts.ready.then(resize);
 reduced.addEventListener('change',()=>dirty=true);
 document.addEventListener('visibilitychange',()=>dirty=true);
 exploreButton.onclick=()=>setExplore(!exploring);resetButton.onclick=resetExplore;
 componentSelect.onchange=()=>select(componentSelect.value);
 let down;
 renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
 renderer.domElement.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])<6)select(hit(e));down=null;});
 renderer.domElement.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||down)return;hovered=hit(e);hoverLabel.textContent=labels(hovered);hoverLabel.hidden=!hovered;dirty=true;});
 renderer.domElement.addEventListener('pointerleave',()=>{hovered='';hoverLabel.hidden=true;dirty=true;});
 renderer.domElement.addEventListener('keydown',e=>{
  if(!exploring)return;
  if(e.key==='Escape'){setExplore(false);return;}
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key))return;
  e.preventDefault();const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  if(e.key==='ArrowLeft')s.theta-=.12;if(e.key==='ArrowRight')s.theta+=.12;
  if(e.key==='ArrowUp')s.phi-=.1;if(e.key==='ArrowDown')s.phi+=.1;
  if(e.key==='+'||e.key==='=')s.radius*=.9;if(e.key==='-')s.radius*=1.1;
  s.phi=clamp(s.phi,controls.minPolarAngle,controls.maxPolarAngle);s.radius=clamp(s.radius,controls.minDistance,controls.maxDistance);
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();dirty=true;
 });
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();active=false;fail('The 3D graphics context was lost. Retry to restore it.');});
 // Read-only diagnostics used by the browser validation suite.
 window.pathosPrototype={stats,get state(){
  let cableEndpointError=0;
  for(const {path,wire} of wireSignals){
   for(const [index,ownerName] of [[0,wire.userData.source_component],[64,wire.userData.destination_component]]){
    if(!initialPositions[ownerName])continue;
    const displacement=new THREE.Vector3();
    for(const [key,coords] of Object.entries(path.targets)){
     const weight=wire.morphTargetInfluences?.[wire.morphTargetDictionary?.[key]]||0;
     displacement.addScaledVector(v(coords[index]).sub(v(path.points[index])),weight);
    }
    cableEndpointError=Math.max(cableEndpointError,displacement.distanceTo(world(ownerName).sub(initialPositions[ownerName])));
   }
  }
  return {chapter,time:storyTime,exploring,selected,camera:camera.position.toArray(),anchors,components:Object.keys(descriptions),cableEndpointError,morphs:wireSignals.map(w=>({name:w.name,weights:w.wire.morphTargetInfluences})),controller:world('ESP32_S3').toArray()};
 }};
 frame=requestAnimationFrame(render);
 }catch(error){console.warn('PATHOS prototype fallback:',error.message);fail('The interactive model could not load. Check your connection or WebGL support.');}
}
init();
