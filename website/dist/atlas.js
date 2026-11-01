import {journeyAt, clamp} from './journey.js';
import {stageFor, calloutFor, telemetryFor} from './stage-copy.js';
const $ = s => document.querySelector(s), chapters = [...document.querySelectorAll('.chapter')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const coverageDialog = $('#coverage-contact');
const experienceSection = $('#experience'), worldStage = $('.world-stage');
let scene = null, raf = 0, anchors = [], measurePending = true, overview = false;
let lastStage = -1, failed = false, paused = false, nextRenderAt = 0, lastRender = 0, initializing = false;
let headerHeight = 80, experienceStart = Infinity;
let startupVersion = 0, startupNotice = 0;
const frameBudget = 1000 / 60;
const setText = (element, text) => {if (element.textContent !== text) element.textContent = text;};

function clearStartupNotice() {
  if (startupNotice) clearTimeout(startupNotice);
  startupNotice = 0;
}
function setSceneState(state, message) {
  worldStage.dataset.sceneState = state;
  $('#scene-host').setAttribute('aria-busy', String(state === 'loading'));
  $('[data-scene-loader]').hidden = state !== 'loading';
  $('[data-scene-error]').hidden = state !== 'error';
  $('.camera-controls').inert = state !== 'ready';
  $('[data-motion-toggle]').disabled = state !== 'ready';
  if (message) setText($('[data-loader-message]'), message);
  if (state !== 'loading') clearStartupNotice();
}

function calloutPosition(point, width, height, noteWidth, noteHeight, lower = false, obstacles = []) {
  const margin = point.mobile ? 14 : 35, minTop = point.mobile ? 64 : 74;
  const maxTop = Math.max(minTop,height-noteHeight-(point.mobile ? 68 : 65));
  const minLeft = point.mobile ? margin : lower ? 20 : width*.52;
  const maxLeft = Math.max(minLeft,width-noteWidth-margin);
  const x = Math.max(minLeft,Math.min(maxLeft,point.x+18));
  const box = point.rigBounds;
  if (!box) return {left:x,top:Math.max(minTop,Math.min(maxTop,point.y-noteHeight-24))};
  const gap = 22;
  const candidates = [
    {left:x,top:box.top-noteHeight-gap},
    {left:x,top:box.bottom+gap},
    {left:box.right+gap,top:box.top-noteHeight*.5},
    {left:box.left-noteWidth-gap,top:box.top-noteHeight*.5},
  ].map(p => ({left:Math.max(minLeft,Math.min(maxLeft,p.left)),top:Math.max(minTop,Math.min(maxTop,p.top))}));
  const overlap = (p,b) => Math.max(0,Math.min(p.left+noteWidth,b.right+12)-Math.max(p.left,b.left-12)) *
    Math.max(0,Math.min(p.top+noteHeight,b.bottom+12)-Math.max(p.top,b.top-12));
  const score = p => overlap(p,box)*1000 + obstacles.reduce((total,b)=>total+overlap(p,b),0);
  return candidates.reduce((best,p) => score(p)<score(best) ? p : best);
}

function measure() {
  const header = $('.route-header').getBoundingClientRect().height;
  headerHeight = header;
  experienceStart = experienceSection.getBoundingClientRect().top + scrollY - header;
  const mobile = matchMedia('(max-width:620px)').matches;
  const offset = header + (mobile ? $('.world-stage').getBoundingClientRect().height : 0);
  anchors = chapters.map(e => ({id: e.id, y: e.getBoundingClientRect().top + scrollY - offset, p: Number(e.dataset.point)}));
  const last = chapters.at(-1);
  anchors.push({id: 'end', y: Math.max(anchors.at(-1).y + 200, last.getBoundingClientRect().bottom + scrollY - innerHeight + 30), p: 1});
  measurePending = false;
}
function progress() {
  const y = scrollY;
  if (y <= anchors[0].y) return 0;
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i], b = anchors[i + 1];
    if (y <= b.y) return a.p + (b.p - a.p) * clamp((y - a.y) / (b.y - a.y));
  }
  return 1;
}
function invalidate() {if (!raf && !document.hidden) raf = requestAnimationFrame(draw);}
function draw(timestamp) {
  raf = 0;
  if (document.hidden) return;
  if (nextRenderAt && timestamp < nextRenderAt - .4) {invalidate(); return;}
  nextRenderAt = nextRenderAt && timestamp - nextRenderAt < frameBudget ? nextRenderAt + frameBudget : timestamp + frameBudget;
  const dt = lastRender ? Math.min(.05, (timestamp - lastRender) / 1000) : 1 / 60;
  lastRender = timestamp;
  if (measurePending || !anchors.length) measure();
  const p = progress(), raw = journeyAt(p);
  const state = reduced.matches ? journeyAt([0, .42, .61, 1, 1][raw.phase]) : raw;
  const stage = stageFor(state), callout = calloutFor(state), telemetry = telemetryFor(state);
  const readingExperience = scrollY >= experienceStart, reading = readingExperience ? 'experience' : 'journey';
  if (document.body.dataset.reading !== reading) {
    document.body.dataset.reading = reading;
    worldStage.inert = readingExperience;
    worldStage.setAttribute('aria-hidden', String(readingExperience));
    $('.header-end').setAttribute('href', readingExperience ? '#experience' : '#receiver');
  }
  if (document.body.dataset.stage !== String(stage)) document.body.dataset.stage = String(stage);
  for (let i = 0; i < chapters.length; i++) chapters[i].classList.toggle('is-active', !readingExperience && i === stage);
  setText($('[data-percent]'), String(Math.round(p * 100)).padStart(2, '0') + '%');
  setText($('[data-header-status]'), readingExperience ? 'THE EXPERIENCE' : state.pod ? 'DELIVERY COMPLETE' : 'FOLLOW THE LOAD');
  setText($('[data-note-kicker]'), callout.title); setText($('[data-scene-status]'), callout.message);
  setText($('[data-pallet-count]'), telemetry.pallets); setText($('[data-document-state]'), telemetry.document);
  const loadPercent = $('[data-load-percent]'); setText(loadPercent, telemetry.percent); loadPercent.hidden = !telemetry.percent;
  $('[data-motion-toggle]').hidden = stage === 0 || reduced.matches || failed;
  if (stage !== lastStage) {setText($('[data-announcement]'), callout.title + '. ' + callout.message); lastStage = stage;}
  if (scene && !failed && !readingExperience) {
    try {
      const point = scene.applyState(state, {overview, dt, reducedMotion: reduced.matches, paused: paused || Boolean(coverageDialog.open)});
      const note = $('[data-map-note]'), r = $('.world-stage').getBoundingClientRect();
      const lower = stage === 0 && point.y > r.height * .65;
      const obstacles = [$('.camera-controls'),$('[data-motion-toggle]')]
        .filter(element=>element&&!element.hidden&&element.getBoundingClientRect)
        .map(element=>{const b=element.getBoundingClientRect();return {left:b.left-r.left,right:b.right-r.left,top:b.top-r.top,bottom:b.bottom-r.top};});
      const {left,top} = calloutPosition(point,r.width,r.height,note.offsetWidth,note.offsetHeight,lower,obstacles);
      const noteLeft = Math.round(left) + 'px', noteTop = Math.round(top) + 'px';
      if (note.style.left !== noteLeft) note.style.left = noteLeft;
      if (note.style.top !== noteTop) note.style.top = noteTop;
      // applyState has completed a real renderer.render call for the current load.
      if (worldStage.dataset.sceneState !== 'ready') setSceneState('ready');
      if (point.needsFrame) invalidate();
    } catch (error) {console.error(error); showError();}
  }
}
function showError() {
  startupVersion++; initializing = false;
  setSceneState('error');
  failed = true; $('[data-scene-error]').hidden = false; $('[data-motion-toggle]').hidden = true;
  if (raf) cancelAnimationFrame(raf); raf = 0;
  scene?.dispose(); scene = null;
}
function navigate(id, behavior = reduced.matches ? 'instant' : 'smooth') {
  if (measurePending || !anchors.length) measure();
  // Preserve incoming links to the earlier fourth chapter.
  const point = anchors.find(a => a.id === (id === 'delivered' ? 'end' : id));
  if (point) scrollTo({top: Math.max(0, point.y + (point.p ? 1 : 0)), behavior});
  else {
    const target = document.getElementById(id);
    if (target) scrollTo({top: Math.max(0, target.getBoundingClientRect().top + scrollY - headerHeight + 1), behavior});
  }
}
document.addEventListener('scroll', invalidate, {passive: true});
addEventListener('resize', () => {measurePending = true; invalidate();}, {passive: true});
document.addEventListener('visibilitychange', () => {
  if (raf) cancelAnimationFrame(raf); raf = 0; nextRenderAt = 0; lastRender = 0;
  if (!document.hidden) invalidate();
});
for (const link of document.querySelectorAll('a[href^="#"]')) link.addEventListener('click', e => {
  const id = link.getAttribute('href').slice(1);
  if (!document.getElementById(id) && id !== 'delivered') return;
  e.preventDefault(); history.replaceState(null, '', '#' + id); navigate(id);
});
for (const button of document.querySelectorAll('[data-camera]')) button.addEventListener('click', () => {
  overview = button.dataset.camera === 'atlas';
  for (const e of document.querySelectorAll('[data-camera]')) e.setAttribute('aria-pressed', String(e === button));
  invalidate();
});
$('[data-motion-toggle]').addEventListener('click', () => {
  paused = !paused; $('[data-motion-toggle]').setAttribute('aria-pressed', String(paused));
  setText($('[data-motion-toggle]'), paused ? 'RESUME MOTION' : 'PAUSE MOTION'); invalidate();
});
for (const button of document.querySelectorAll('[data-open-coverage]')) button.addEventListener('click', () => {
  coverageDialog.showModal(); invalidate();
});
coverageDialog.addEventListener('close', invalidate);
coverageDialog.addEventListener('click', event => {
  if (event.target !== coverageDialog) return;
  const box = coverageDialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) coverageDialog.close();
});
reduced.addEventListener('change', () => {$('[data-motion-note]').hidden = !reduced.matches; invalidate();});
$('#scene-host').addEventListener('journey-error', showError);
addEventListener('pagehide', () => {
  startupVersion++; initializing = false; clearStartupNotice();
  if (raf) cancelAnimationFrame(raf); raf = 0;
  scene?.dispose(); scene = null; nextRenderAt = 0; lastRender = 0;
});
addEventListener('pageshow', () => {measurePending = true; if (!scene && !failed) void init(); invalidate();});
async function init() {
  if (initializing || scene || failed) return; initializing = true;
  const version = ++startupVersion;
  setSceneState('loading', 'Loading the 3D route…');
  clearStartupNotice();
  startupNotice = setTimeout(() => {
    if (worldStage.dataset.sceneState === 'loading') setText($('[data-loader-message]'), 'Still preparing the route. You can keep reading.');
  }, 10000);
  invalidate(); $('[data-motion-note]').hidden = !reduced.matches;
  try {
    const {createJourneyScene} = await import('./scene.js');
    if (version !== startupVersion) return;
    setSceneState('loading', 'Preparing the 3D scene…');
    // Give the browser a paint opportunity before CPU/GPU scene setup begins.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (version !== startupVersion) return;
    scene = createJourneyScene($('#scene-host'), invalidate);
    measurePending = true; invalidate();
  } catch (error) {if (version === startupVersion) {console.error('Atlas initialization failed:', error); showError();}}
  finally {if (version === startupVersion) initializing = false;}
}
document.fonts.ready.then(() => {
  measurePending = true;
  if (location.hash) navigate(location.hash.slice(1), 'instant');
  invalidate();
});
void init();
