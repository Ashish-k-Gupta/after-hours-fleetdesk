import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../dist/vendor/three.module.js';
import {journeyAt, smooth} from '../dist/journey.js';
import {makeMaterials, buildTractor, buildReefer} from '../dist/rig-models.js';
import {buildWorld, pallet} from '../dist/world.js';
import {createBrandMaterial, addBrandDecal} from '../dist/branding.js';
import {createEagle, createEagleFlight, flightPose} from '../dist/eagle.js';
import {stageFor, calloutFor, telemetryFor} from '../dist/stage-copy.js';

// Exercise the production scene graph and camera math without claiming GPU/browser QA.
const context = Object.fromEntries(['fillRect','fillText','beginPath','moveTo','lineTo','closePath','fill'].map(key => [key, () => {}]));
const fakeCanvas = () => ({width: 1, height: 1, getContext: () => context, setAttribute() {}, addEventListener() {}, removeEventListener() {}, remove() {this.removed = true;}});
globalThis.document = {createElement: () => fakeCanvas()};
globalThis.devicePixelRatio = 1;
let mobile = false;
globalThis.matchMedia = () => ({matches: mobile});
const observers = [];
globalThis.ResizeObserver = class {
  constructor(callback) {this.callback = callback; observers.push(this);}
  observe() {} disconnect() {this.disconnected = true;}
};
let renderer;
class RendererStub {
  constructor() {this.domElement = fakeCanvas(); this.shadowMap = {}; renderer = this; this.renders = 0;}
  setPixelRatio(value) {this.pixelRatio = value;}
  setClearColor() {} setSize() {}
  render(world, camera) {world.updateMatrixWorld(true); camera.updateMatrixWorld(true); this.world = world; this.camera = camera; this.renders++;}
  dispose() {this.disposed = true;}
}
const code = (await readFile(new URL('../dist/scene.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '').replace('export function createJourneyScene', 'function createJourneyScene');
const createScene = new Function('THREE','makeMaterials','buildTractor','buildReefer','buildWorld','pallet','journeyAt','smooth','createBrandMaterial','addBrandDecal','createEagleFlight', code + '\nreturn createJourneyScene;')(
  {...THREE, WebGLRenderer: RendererStub}, makeMaterials, buildTractor, buildReefer, buildWorld, pallet, journeyAt, smooth, createBrandMaterial, addBrandDecal, createEagleFlight,
);

const {root: bird} = createEagle();
let triangles = 0;
bird.traverse(mesh => {
  if (!mesh.isMesh) return;
  assert.equal(mesh.castShadow, true); assert.equal(mesh.material.flatShading, true);
  const position = mesh.geometry.getAttribute('position');
  triangles += (mesh.geometry.index?.count ?? position.count) / 3;
  for (const value of position.array) assert.ok(Number.isFinite(value));
});
assert.ok(triangles < 300, 'Eagle remains a small procedural mesh');
for (let frame = 0; frame <= 18000; frame++) {
  const pose = flightPose(frame / 60);
  for (const value of Object.values(pose)) assert.ok(Number.isFinite(value));
  assert.ok(pose.y >= 11 && pose.y <= 24);
}
const beforePass = flightPose(5 - 1e-7), afterPass = flightPose(5);
for (const key of ['x','y','z','heading','bank']) assert.ok(Math.abs(beforePass[key] - afterPass[key]) < 1e-5, key + ' is continuous at the swoop/orbit handoff');
assert.equal(telemetryFor(journeyAt(.44)).document, 'DETENTION LOGGED');
assert.equal(telemetryFor(journeyAt(.44)).pallets, '6 / 6 PALLETS');
assert.deepEqual(telemetryFor(journeyAt(.61)), {pallets: '6 / 6 PALLETS', document: 'BOL CONFIRMED', percent: '68%'});
assert.deepEqual(telemetryFor(journeyAt(1)), {pallets: '0 / 6 PALLETS', document: 'CLEAN POD SENT', percent: '100%'});
assert.equal(calloutFor(journeyAt(1)).message, 'Empty on time. Clean POD verified. Sent to broker.');
for (let i = 0; i <= 1000; i++) {
  const state = journeyAt(i / 1000), telemetry = telemetryFor(state);
  assert.equal(Number(telemetry.pallets.split(' ')[0]), state.cargo);
  assert.ok(stageFor(state) >= 0 && stageFor(state) <= 3);
  if (!state.pod) assert.notEqual(telemetry.document, 'CLEAN POD SENT');
}

let frames = 0;
const atlasSource = await readFile(new URL('../dist/atlas.js',import.meta.url),'utf8');
const calloutFunction = atlasSource.match(/function calloutPosition\([\s\S]*?\n}/)[0];
const positionCallout = new Function(calloutFunction+'; return calloutPosition;')();
let overlappingCallouts = [];
for (const [width,height] of [[1536,784],[1280,594],[1024,688],[800,828],[620,369],[390,363],[320,305]]) {
  mobile = width <= 620;
  const host = {getBoundingClientRect: () => ({width,height}), append() {}};
  const api = createScene(host, () => {}), sceneRenderer = renderer;
  const world = sceneRenderer.world;
  // The world is first exposed by the renderer's first draw.
  api.applyState(journeyAt(0), {reducedMotion: true});
  const content = sceneRenderer.world;
  const eagle = content.getObjectByName('eye-in-the-sky');
  assert.equal(eagle.visible, false);
  const trailer = content.getObjectByName('after-hours-53-foot-dry-van');
  const roof = trailer.getObjectByName('trailer-roof');
  assert.ok(roof.receiveShadow);
  assert.equal(trailer.getObjectByName('reefer-collider'), undefined);
  for (const side of [-1,1]) {
    const decal = trailer.getObjectByName('trailer-brand-' + side);
    assert.ok(decal.material.isMeshStandardMaterial && decal.receiveShadow);
    assert.ok(Math.abs(decal.position.z) > 1.27);
    assert.equal(decal.rotation.y, side < 0 ? Math.PI : 0);
  }
  assert.ok(content.getObjectByName('pickup-dock-brand'));
  const pallets = trailer.children.filter(child => child.name.startsWith('sample-pallet-'));
  assert.equal(pallets.length, 6);
  for (const p of [0,.16,.28,.31,.36,.42,.44,.46,.61,.68,.76,.82,.87,.93,.94,1]) {
    const state = journeyAt(p);
    const point = api.applyState(state, {reducedMotion: true}); frames++;
    const noteWidth = mobile ? 190 : 290, noteHeight = 108;
    const label = positionCallout(point,width,height,noteWidth,noteHeight);
    const rect = point.rigBounds;
    const intersection = Math.max(0,Math.min(label.left+noteWidth,rect.right)-Math.max(label.left,rect.left)) * Math.max(0,Math.min(label.top+noteHeight,rect.bottom)-Math.max(label.top,rect.top));
    if(intersection>1) overlappingCallouts.push({width,height,p,intersection:Math.round(intersection),rig:rect,label});
    assert.equal(pallets.filter(item => item.visible).length, state.cargo, 'Scene cargo agrees with telemetry at ' + p);
    assert.equal(eagle.visible, state.phase === 2);
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
    assert.equal(point.needsFrame, false, 'Reduced motion never loops');
    const center = new THREE.Vector3(-6,2,0).applyMatrix4(trailer.matrixWorld).project(sceneRenderer.camera);
    if (p > .24) assert.ok(center.x > -1 && center.x < 1 && center.y > -1 && center.y < 1, 'Rig stays in view at ' + width + ' / ' + p);
    const shutter = content.getObjectByName('receiver-dock-shutter');
    if (p === .87) assert.ok(shutter.scale.y < .1);
    if (p === 1) assert.equal(shutter.scale.y, 1);
  }
  api.applyState(journeyAt(.61), {reducedMotion: true});
  const sunlight = content.children.find(item => item.isDirectionalLight && item.castShadow);
  const ray = sunlight.target.position.clone().sub(sunlight.position).normalize();
  const hit = new THREE.Raycaster(eagle.position, ray).intersectObject(roof)[0];
  assert.ok(hit, 'The real light ray crosses the trailer roof at ' + width);
  const roofCenter = new THREE.Vector3(-6.55,4.13,0).applyMatrix4(trailer.matrixWorld);
  assert.ok(hit.point.distanceTo(roofCenter) < .02, 'Shadow crosses the roof center');
  const casters = [];
  content.traverseVisible(object => {
    if (!object.isMesh || !object.castShadow) return;
    for (let parent=object;parent;parent=parent.parent) if (parent === eagle) return;
    casters.push(object);
  });
  const firstShadowHit = new THREE.Raycaster(eagle.position, ray).intersectObjects(casters, false)[0];
  assert.equal(firstShadowHit?.object, roof, 'New scenery leaves the eagle-to-roof shadow path clear');
  for (const [name,p] of [['i40-memphis-bridge',.61],['i40-britten-water-tower',.63],['i40-cadillac-ranch',.67]]) {
    const landmark = content.getObjectByName(name);
    assert.ok(landmark, name);
    api.applyState(journeyAt(p), {reducedMotion:true});
    const center = new THREE.Box3().setFromObject(landmark).getCenter(new THREE.Vector3()).project(sceneRenderer.camera);
    assert.ok(Math.abs(center.x)<1 && Math.abs(center.y)<1, name + ' enters the following camera at ' + width);
    if (!mobile) assert.ok(center.x > -.08, name + ' reaches the visible scene side of the desktop text mask');
  }

  api.applyState(journeyAt(0), {reducedMotion: true});
  for (const reverse of [false,true]) for (let step=0;step<=250;step++) {
    const progress=reverse ? 1-step/250 : step/250;
    const point=api.applyState(journeyAt(progress),{dt:1/60});frames++;
    const bounds=point.rigBounds;
    assert.ok(bounds.left>=0&&bounds.right<=width&&bounds.top>=0&&bounds.bottom<=height,`Entire rig stays onscreen at ${width} / ${progress}`);
    const label=positionCallout(point,width,height,mobile?190:290,108);
    const intersection=Math.max(0,Math.min(label.left+(mobile?190:290),bounds.right)-Math.max(label.left,bounds.left))*Math.max(0,Math.min(label.top+108,bounds.bottom)-Math.max(label.top,bounds.top));
    assert.ok(intersection<1,`Callout clears moving truck at ${width} / ${progress}: ${JSON.stringify({bounds,label})}`);
  }
  api.applyState(journeyAt(.61));
  const entry = eagle.position.clone().project(sceneRenderer.camera);
  assert.ok(entry.x > 1 && entry.y > 1, 'Flight enters from offscreen top-right');
  for (let i = 0; i < 360; i++) {api.applyState(journeyAt(.61), {dt: 1/60}); frames++;}
  const frozen = eagle.position.clone();
  for (let i = 0; i < 30; i++) api.applyState(journeyAt(.61), {paused: true});
  assert.ok(eagle.position.distanceTo(frozen) < 1e-8, 'Pause freezes the flight');
  const location = trailer.position.clone();
  api.applyState(journeyAt(.61), {overview: true, paused: true});
  assert.ok(trailer.position.distanceTo(location) < 1e-8, 'Changing camera preserves load position');
  for (let i = 0; i < 120; i++) api.applyState(journeyAt(.61), {overview: true, paused: true});
  for(const progress of [0,.16,.31,.46,.61,.68,.75,.82,1]) {
    const {rigBounds:b}=api.applyState(journeyAt(progress),{overview:true,reducedMotion:true});
    assert.ok(b.left>=0&&b.right<=width&&b.top>=0&&b.bottom<=height,`Whole Route contains both docks and the load at ${width} / ${progress}`);
  }
  api.applyState(journeyAt(1)); assert.equal(eagle.visible, false);
  api.applyState(journeyAt(.61));
  const reentry = eagle.position.clone().project(sceneRenderer.camera);
  assert.ok(reentry.x > 1 && reentry.y > 1, 'Returning to transit replays the swoop');
  let disposedMaps = 0;
  trailer.getObjectByName('trailer-brand-1').material.map.addEventListener('dispose', () => disposedMaps++);
  api.dispose(); assert.ok(sceneRenderer.disposed && sceneRenderer.domElement.removed);
  assert.equal(disposedMaps, 1, 'Shared brand texture is released exactly once');
  assert.ok(observers.at(-1).disconnected);
}
assert.equal(overlappingCallouts.length,0,'Status callouts must leave the cab and trailer clear: '+JSON.stringify(overlappingCallouts[0]));
// Run the real controller with a small DOM/clock harness, independently of the renderer.
const listeners = new Map(), pendingFrames = new Map(), elements = new Map();
const clearedStartupTimers = [], controllerErrors = [];
let nextFrame = 0, controllerTime = 0, rendered = 0, lastOptions, controllerMobile = false;
const element = () => ({textContent: '', hidden: false, style: {}, dataset: {}, offsetWidth: 290, offsetHeight: 120,
  listeners: new Map(), classList: {toggle() {}}, setAttribute(key,value) {this[key] = value;},
  addEventListener(key,callback) {this.listeners.set(key,callback);}, getBoundingClientRect: () => ({width:1536,height:820})});
const query = selector => {if (!elements.has(selector)) elements.set(selector,element()); return elements.get(selector);};
const buttons = ['journey','atlas'].map(mode => {const e = element(); e.dataset.camera = mode; return e;});
const navigationLinks = Object.fromEntries(['experience','yard','delivered'].map(id => {
  const link = element(); link.getAttribute = key => key === 'href' ? '#' + id : null;
  return [id, link];
}));
const reduced = {matches:false, addEventListener(key,callback) {this.onchange = callback;}};
const sandbox = {console:{...console,error:(...args)=>controllerErrors.push(args)}, journeyAt,clamp: value => Math.max(0,Math.min(1,value)),stageFor,calloutFor,telemetryFor,
  scrollY:0,innerHeight:900,location:{hash:''},history:{replaceState() {}},
  matchMedia: condition => condition.includes('reduced-motion') ? reduced : {matches:controllerMobile},
  requestAnimationFrame: callback => {pendingFrames.set(++nextFrame,callback); return nextFrame;},
  cancelAnimationFrame: id => pendingFrames.delete(id),
  clearTimeout:id=>clearedStartupTimers.push(id),
  addEventListener: (key,callback) => listeners.set(key,callback),
};
const chapters = ['yard','shipper','transit','receiver'].map((id,i) => {
  const chapter = {id,dataset:{point:[0,.16,.46,.68][i]},active:false,
    getBoundingClientRect: () => ({top:i*1215-sandbox.scrollY,bottom:(i+1)*1215-sandbox.scrollY,height:1215})};
  chapter.classList = {toggle(name, active) {chapter.active = active;}};
  return chapter;
});
query('.route-header').getBoundingClientRect = () => ({height:controllerMobile ? 72 : 80});
query('.world-stage').getBoundingClientRect = () => ({width:1536,height:controllerMobile ? 363 : 820});
query('#experience').getBoundingClientRect = () => ({top:4860-sandbox.scrollY,bottom:6400-sandbox.scrollY,height:1540});
sandbox.document = {hidden:false,body:{dataset:{}},fonts:{ready:{then() {}}},
  querySelector:query,querySelectorAll: selector => selector === '.chapter' ? chapters : selector === '[data-camera]' ? buttons : selector === 'a[href^="#"]' ? Object.values(navigationLinks) : [],
  getElementById: id => id === 'experience' ? query('#experience') : chapters.find(chapter => chapter.id === id),addEventListener: (key,callback) => listeners.set(key,callback)};
sandbox.scrollTo = options => {sandbox.lastScroll = options; sandbox.scrollY = options.top; listeners.get('scroll')();};
sandbox.sceneStub = {applyState(state,options) {rendered++; lastOptions = options; return {x:1040,y:420,mobile:false,needsFrame:state.phase===2&&!options.paused&&!options.reducedMotion};},dispose() {this.disposed=true;}};
const controller = (await readFile(new URL('../dist/atlas.js', import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/void init\(\);\s*$/,'');
vm.createContext(sandbox); vm.runInContext(controller,sandbox); vm.runInContext('scene = sceneStub;',sandbox);
function tick(milliseconds=1000/60) {
  controllerTime += milliseconds;
  const scheduled = [...pendingFrames.values()]; pendingFrames.clear();
  for (const callback of scheduled) callback(controllerTime);
}
vm.runInContext('scene = null; setSceneState("loading", "Loading the 3D route…");',sandbox);
listeners.get('scroll')();tick();
assert.equal(query('.world-stage').dataset.sceneState,'loading','Loader remains until an actual frame renders');
assert.equal(query('[data-scene-loader]').hidden,false);
assert.equal(query('#scene-host')['aria-busy'],'true');
assert.equal(query('.camera-controls').inert,true);
assert.equal(rendered,0);
vm.runInContext('scene = sceneStub;',sandbox);
listeners.get('scroll')(); for (let i=0;i<60;i++) tick();
assert.equal(rendered,1,'Idle yard renders once');
assert.equal(query('.world-stage').dataset.sceneState,'ready');
assert.equal(query('[data-scene-loader]').hidden,true,'First successful frame removes the loader');
assert.equal(query('#scene-host')['aria-busy'],'false');
assert.equal(query('.camera-controls').inert,false);
sandbox.scrollY = 2*1215-80 + (.61-.46)/(.68-.46)*1215;
listeners.get('scroll')(); const beforeTransit = rendered;
for (let i=0;i<288;i++) tick(1000/144);
assert.ok(rendered-beforeTransit>=118 && rendered-beforeTransit<=122,'144Hz input is limited to approximately 60 renders per second: ' + (rendered-beforeTransit));
assert.equal(sandbox.document.body.dataset.stage,'2');
assert.equal(query('[data-load-percent]').textContent,'68%');
query('[data-motion-toggle]').listeners.get('click')();
for (let i=0;i<10;i++) tick();
const pausedCount = rendered;
for (let i=0;i<120;i++) tick();
assert.equal(rendered,pausedCount,'Pausing stops scheduling continuous frames');
query('[data-motion-toggle]').listeners.get('click')(); tick();
assert.ok(pendingFrames.size>0,'Resume restarts the animation');
sandbox.document.hidden=true; listeners.get('visibilitychange')();
assert.equal(pendingFrames.size,0,'Hidden tabs cancel pending frames');
tick(30000); sandbox.document.hidden=false; listeners.get('visibilitychange')(); tick();
assert.ok(lastOptions.dt<=.05,'Returning from a hidden tab cannot jump the flight clock');
reduced.matches=true; reduced.onchange(); for (let i=0;i<10;i++) tick();
assert.equal(pendingFrames.size,0,'Reduced motion stops the loop');
assert.equal(query('[data-motion-toggle]').hidden,true);
reduced.matches=false; reduced.onchange(); tick();
assert.ok(pendingFrames.size>0);
sandbox.scrollY=6000; listeners.get('scroll')(); for (let i=0;i<10;i++) tick();
assert.equal(sandbox.document.body.dataset.stage,'3');
assert.equal(query('[data-document-state]').textContent,'CLEAN POD SENT');
assert.equal(query('[data-load-percent]').textContent,'100%');
assert.equal(pendingFrames.size,0,'Leaving transit stops continuous rendering');
assert.equal(sandbox.document.body.dataset.reading,'experience');
assert.equal(query('.world-stage').inert,true,'Experience reading removes focus from the fixed scene');
assert.equal(query('.world-stage')['aria-hidden'],'true');
assert.ok(chapters.every(chapter => !chapter.active),'Fixed story text clears the experience section');
assert.equal(query('[data-header-status]').textContent,'THE EXPERIENCE');
assert.equal(query('.header-end').href,'#experience');
const historyRenderCount = rendered;
for (let i=0;i<120;i++) tick();
assert.equal(rendered,historyRenderCount,'Reading the history does not render the scene');

for (const onMobile of [false,true]) {
  controllerMobile = onMobile; sandbox.innerHeight = onMobile ? 844 : 900;
  listeners.get('resize')();
  navigationLinks.experience.listeners.get('click')({preventDefault() {}});
  for (let i=0;i<10;i++) tick();
  assert.equal(sandbox.scrollY,4860-(onMobile ? 72 : 80)+1,'Experience anchor aligns below the header');
  assert.equal(sandbox.document.body.dataset.reading,'experience');
  assert.equal(query('.world-stage').inert,true);
  navigationLinks.yard.listeners.get('click')({preventDefault() {}});
  for (let i=0;i<10;i++) tick();
  assert.equal(sandbox.scrollY,0);
  assert.equal(sandbox.document.body.dataset.reading,'journey');
  assert.equal(query('.world-stage').inert,false,'Returning to the yard restores scene controls');
  assert.equal(query('.world-stage')['aria-hidden'],'false');
  assert.equal(query('.header-end').href,'#receiver');
  assert.equal(sandbox.document.body.dataset.stage,'0');
  assert.ok(chapters[0].active);
  navigationLinks.delivered.listeners.get('click')({preventDefault() {}});
  for (let i=0;i<10;i++) tick();
  assert.equal(sandbox.document.body.dataset.reading,'journey','Legacy delivered links stay within the load journey');
  assert.equal(query('[data-load-percent]').textContent,'100%');
}
reduced.matches=true; reduced.onchange();
navigationLinks.experience.listeners.get('click')({preventDefault() {}});
for (let i=0;i<10;i++) tick();
assert.equal(sandbox.lastScroll.behavior,'instant','Reduced-motion history navigation is instant');
assert.equal(sandbox.document.body.dataset.reading,'experience');
navigationLinks.yard.listeners.get('click')({preventDefault() {}});for(let i=0;i<10;i++)tick();
sandbox.sceneStub.applyState=()=>{throw new Error('Expected startup/render failure');};
vm.runInContext('setSceneState("loading"); invalidate();',sandbox);tick();
assert.equal(query('.world-stage').dataset.sceneState,'error');
assert.equal(query('[data-scene-loader]').hidden,true,'A failure cannot leave an endless loading indicator');
assert.equal(query('[data-scene-error]').hidden,false);
assert.equal(query('#scene-host')['aria-busy'],'false');
assert.equal(query('.camera-controls').inert,true);
assert.equal(controllerErrors.length,1,'The failed render is reported');
vm.runInContext('startupNotice = 42;',sandbox);
listeners.get('pagehide')(); assert.equal(sandbox.sceneStub.disposed,true);
assert.ok(clearedStartupTimers.includes(42),'Leaving the page clears the delayed-startup notice');
assert.equal(pendingFrames.size,0);
const homepage = await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
assert.ok(homepage.includes('data-scene-state="loading"'));
assert.ok(homepage.includes('data-scene-loader role="status"'));
for(const path of ['scene.js','vendor/three.module.js','vendor/three.core.js'])assert.ok(homepage.includes(`rel="modulepreload" href="${path}"`));
console.log('PASS: ' + triangles + ' eagle triangles; 18,001 flight poses; 1,001 HUD/cargo states; ' + frames + ' production scene frames at seven sizes; roof-shadow intersections, top-right entry/re-entry, camera switching, pause/reduced motion, dry van, decals, shutters and disposal. Controller verifies the 60fps cap, idle stop, visibility suspension, stage synchronization, desktop/mobile experience navigation, reading-mode scene hiding, reverse return and legacy links. GPU appearance and actual frame rate require browser review.');
