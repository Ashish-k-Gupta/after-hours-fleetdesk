import * as THREE from './vendor/three.module.js';
import {makeMaterials, buildTractor, buildReefer} from './rig-models.js';
import {buildWorld, pallet} from './world.js';
import {journeyAt, smooth} from './journey.js';
import {createBrandMaterial, addBrandDecal} from './branding.js';
import {createEagleFlight} from './eagle.js';

export function createJourneyScene(host, invalidate) {
  const renderer = new THREE.WebGLRenderer({antialias: true, alpha: false, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(max-width:620px)').matches ? 1.25 : 1.4));
  renderer.setClearColor(0xf5f3eb, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'An illustrative I-40 route with five parked rigs, Memphis bridge arches, the Groom leaning water tower and Cadillac Ranch. California and US flags mark the shipper; a New York state flag marks the receiver. An orange truck loads six pallets, travels beneath an eagle and unloads at the receiver.');
  host.append(canvas);
  const world = new THREE.Scene(); world.fog = new THREE.Fog(0xf5f3eb, 220, 430);
  world.add(new THREE.HemisphereLight(0xfff8e7, 0x8e9a80, 2.5));
  const sun = new THREE.DirectionalLight(0xffefd3, 2.6); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -125, right: 125, top: 120, bottom: -120, near: .5, far: 300});
  sun.shadow.normalBias = .025; sun.shadow.bias = -.00005;
  world.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xdce7ee, .65); fill.position.set(-10, 50, 80); world.add(fill);
  const camera = new THREE.OrthographicCamera(-120, 120, 80, -80, .1, 700);
  const m = makeMaterials(); m.paint.color.set(0xd96b43); m.paintLight.color.set(0xe58b65);
  const tractor = buildTractor(m), trailer = buildReefer(m, {dryVan: true});
  world.add(tractor.root, trailer.root);
  for (const leg of trailer.landing) leg.position.y = .7;
  trailer.trailerRed.emissiveIntensity = .7; trailer.trailerAmber.emissiveIntensity = .7;
  const brandMaterial = createBrandMaterial();
  for (const side of [-1, 1]) addBrandDecal(trailer.root, brandMaterial, {
    position: [-6.1, 2.92, side * 1.287], rotation: side < 0 ? Math.PI : 0,
    name: 'trailer-brand-' + side,
  });
  const landscape = buildWorld(world, {brandMaterial});
  const cargoMaterials = {
    wood: new THREE.MeshStandardMaterial({color: 0xb59c72, roughness: .95}),
    crate: new THREE.MeshStandardMaterial({color: 0xbcca9f, roughness: .95}),
    tape: new THREE.MeshStandardMaterial({color: 0xe4e3c4, roughness: .9}),
  };
  const cargo = Array.from({length: 6}, (_, i) => {
    const item = pallet(cargoMaterials); item.name = 'sample-pallet-' + (i + 1);
    item.position.set(-11.9 + Math.floor(i / 2) * 3.7, 1.48, i % 2 ? .59 : -.59);
    trailer.root.add(item); return item;
  });
  const eagle = createEagleFlight(world);
  // Cache local corners once; project only 16 points per frame for HUD clearance.
  const rigCorners = [tractor.root, trailer.root].flatMap(root => {
    const bounds = new THREE.Box3().setFromObject(root);
    return [bounds.min.x,bounds.max.x].flatMap(x => [bounds.min.y,bounds.max.y].flatMap(y =>
      [bounds.min.z,bounds.max.z].map(z => ({root,local:new THREE.Vector3(x,y,z)}))));
  });
  const projectedCorner = new THREE.Vector3(), previousTracked = new THREE.Vector3();
  const overviewTarget = new THREE.Vector3(72, 0, -3), overviewOffset = new THREE.Vector3(-105, 130, 150);
  const atlasTarget = new THREE.Vector3(74, 5, -14);
  const followOffset = new THREE.Vector3(28, 36, 43), tracked = new THREE.Vector3();
  const desiredTarget = new THREE.Vector3(), desiredOffset = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3(), cameraOffset = new THREE.Vector3(), anchor = new THREE.Vector3();
  const sunOffset = new THREE.Vector3(-70, 135, 80);
  let aspect = 1, hostWidth = 1, hostHeight = 1, cameraWidth = 200, initialized = false;
  let flightSeconds = 0, flagSeconds = 0, idleSeconds = 0, previousProgress = -1, previousPhase = -1;

  function applyState(state, {overview = false, dt = 1 / 60, reducedMotion = false, paused = false} = {}) {
    const jumped = initialized && Math.abs(state.p - previousProgress) > .035;
    const wasFollowing = previousProgress >= .24;
    const moved = Math.abs(state.p - previousProgress) > .000001;
    if (moved || state.phase !== previousPhase) idleSeconds = 0;
    else if (!paused && !reducedMotion && state.phase === 2) idleSeconds += dt;
    if (state.phase !== 2) flightSeconds = 0;
    else if (!paused && !reducedMotion) flightSeconds += dt;
    previousProgress = state.p; previousPhase = state.phase;
    // Scroll owns the route; a bounded advance keeps an idle transit view alive.
    const drift = state.phase === 2 ? Math.min(.006, (.68 - state.p) * .45) * (1 - Math.exp(-idleSeconds / 12)) : 0;
    const pose = drift > 0 ? journeyAt(state.p + drift) : state;
    tractor.root.position.set(pose.x, 0, pose.z); tractor.root.rotation.y = pose.heading;
    trailer.root.position.set(pose.pinX, 0, pose.pinZ); trailer.root.rotation.y = pose.trailerHeading;
    for (const wheel of tractor.wheels) {
      wheel.spin.rotation.z = -(pose.x + 22) / .51 - flightSeconds * 4;
      if (wheel.front) wheel.steering.rotation.y = pose.heading * .35;
    }
    for (const wheel of trailer.wheels) wheel.spin.rotation.z = -(pose.pinX + 24.2) / .51 - flightSeconds * 4;
    for (const door of trailer.doors) door.root.rotation.y = door.side * pose.doorOpen * Math.PI * 1.5;
    tractor.reverseMaterial.emissiveIntensity = pose.reversing ? 1.2 : 0;
    const loaded = Math.floor(pose.loadProgress * 6 + 1e-8), unloaded = Math.floor(pose.unloadProgress * 6 + 1e-8);
    for (let i = 0; i < cargo.length; i++) cargo[i].visible = i >= unloaded && i < loaded;
    // A light cutaway at the dock reveals the sample freight.
    const cutaway = pose.doorOpen * (pose.location === 'shipper' || pose.location === 'receiver' ? 1 : 0);
    trailer.roof.material.opacity = 1 - .83 * cutaway;
    for (const panel of trailer.sidePanels) panel.material.opacity = 1 - .75 * cutaway;
    landscape.applyState(pose);
    if ((state.phase === 1 || state.phase >= 3) && !paused && !reducedMotion) flagSeconds += dt;
    landscape.animateFlag(reducedMotion ? 0 : flagSeconds, state.phase);
    const mobile = hostWidth <= 620;
    let focus = overview ? 0 : smooth((state.p - .08) / .16) * .96;
    if (mobile && !overview) focus = Math.max(focus, .96);
    tracked.set(pose.x - 6, 1.5, pose.z - 2);
    desiredTarget.copy(overview ? atlasTarget : overviewTarget).lerp(tracked, focus);
    desiredOffset.copy(overviewOffset).lerp(followOffset, focus);
    const width = THREE.MathUtils.lerp(overview ? Math.max(330,185*aspect) : 200, mobile ? 61 : 76, focus);
    const damping = !initialized || reducedMotion ? 1 : 1 - Math.exp(-dt * 8);
    // Load motion must not outrun the camera while zoom/view changes still ease.
    if (jumped) {cameraTarget.copy(desiredTarget);cameraOffset.copy(desiredOffset);cameraWidth=width;}
    else if (initialized && !overview && (mobile || wasFollowing && state.p >= .24)) cameraTarget.addScaledVector(projectedCorner.copy(tracked).sub(previousTracked), focus);
    previousTracked.copy(tracked);
    cameraTarget.lerp(desiredTarget, damping); cameraOffset.lerp(desiredOffset, damping);
    cameraWidth = THREE.MathUtils.lerp(cameraWidth, width, damping); initialized = true;
    camera.left = -cameraWidth / 2; camera.right = cameraWidth / 2;
    camera.top = cameraWidth / (2 * aspect); camera.bottom = -camera.top;
    const frameLift = overview ? 0 : Math.max(0, Math.min(.14, (aspect - 1.6) * .17));
    camera.clearViewOffset();
    if (mobile) camera.setViewOffset(hostWidth,hostHeight,0,overview ? 0 : -Math.min(68,50+Math.max(0,390-hostWidth)*.25),hostWidth,hostHeight);
    else camera.setViewOffset(hostWidth, hostHeight, -hostWidth * .10, hostHeight * frameLift, hostWidth, hostHeight);
    camera.position.copy(cameraTarget).add(cameraOffset); camera.lookAt(cameraTarget);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    // Tight shadows in Follow Load keep the real eagle shadow legible.
    const shadowSize = overview ? 125 : 38;
    const lightTarget = overview ? overviewTarget : tracked;
    sun.target.position.copy(lightTarget); sun.position.copy(lightTarget).add(sunOffset);
    Object.assign(sun.shadow.camera, {left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize});
    sun.shadow.camera.updateProjectionMatrix(); sun.target.updateMatrixWorld();
    eagle.update(pose, camera, dt, reducedMotion, paused);
    renderer.render(world, camera);
    const rigBounds = {left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};
    for (const corner of rigCorners) {
      projectedCorner.copy(corner.local).applyMatrix4(corner.root.matrixWorld).project(camera);
      const x = (projectedCorner.x + 1) * hostWidth / 2, y = (1 - projectedCorner.y) * hostHeight / 2;
      rigBounds.left = Math.min(rigBounds.left,x); rigBounds.right = Math.max(rigBounds.right,x);
      rigBounds.top = Math.min(rigBounds.top,y); rigBounds.bottom = Math.max(rigBounds.bottom,y);
    }
    anchor.set(pose.x + 1.8, 4.2, pose.z).project(camera);
    const cameraMoving = cameraTarget.distanceToSquared(desiredTarget) + cameraOffset.distanceToSquared(desiredOffset) > .00005 || Math.abs(cameraWidth - width) > .002;
    return {x: (anchor.x + 1) * hostWidth / 2, y: (1 - anchor.y) * hostHeight / 2, mobile, rigBounds,
      needsFrame: cameraMoving || state.phase >= 1 && !paused && !reducedMotion};
  }

  const resize = () => {
    const r = host.getBoundingClientRect(); if (!r.width || !r.height) return;
    hostWidth = r.width; hostHeight = r.height; aspect = r.width / r.height;
    renderer.setSize(r.width, r.height, false); invalidate();
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const lost = e => {e.preventDefault(); host.dispatchEvent(new CustomEvent('journey-error'));};
  canvas.addEventListener('webglcontextlost', lost);
  return {applyState, dispose() {
    observer.disconnect(); canvas.removeEventListener('webglcontextlost', lost);
    const geometries = new Set(), materials = new Set(), textures = new Set();
    world.traverse(o => {
      if (o.isInstancedMesh) o.dispose();
      if (o.geometry) geometries.add(o.geometry);
      for (const mat of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
        materials.add(mat); if (mat.map) textures.add(mat.map);
      }
    });
    for (const g of geometries) g.dispose();
    for (const mat of materials) mat.dispose();
    for (const tex of textures) tex.dispose();
    sun.shadow.dispose();
    renderer.dispose(); canvas.remove();
  }};
}
