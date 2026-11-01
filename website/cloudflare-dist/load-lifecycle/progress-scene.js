import * as THREE from '../vendor/three.module.js';
import {makeMaterials, buildTractor, buildReefer} from '../rig-models.js';
import {sampleStage, STAGE_CLIPS, clamp} from './stage-motion.js';

const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => {t = clamp(t); return t * t * (3 - 2 * t);};

export function createProgressModel() {
  const world = new THREE.Scene(), content = new THREE.Group();
  world.add(content);
  world.add(new THREE.HemisphereLight(0xfff8e7, 0x829477, 2.8));
  const sun = new THREE.DirectionalLight(0xfff3dc, 3);
  sun.position.set(2, 25, 18); world.add(sun);
  const m = makeMaterials();
  const green = new THREE.MeshStandardMaterial({color: 0x245c48, roughness: .7});
  const paper = new THREE.MeshStandardMaterial({color: 0xfffcf2, roughness: .85});
  const wood = new THREE.MeshStandardMaterial({color: 0xad875f, roughness: .9});
  const camera = new THREE.OrthographicCamera(-22, 22, 16, -16, .1, 200);
  camera.position.set(13, 20, 28); camera.lookAt(-7, 3, 0); camera.updateMatrixWorld();

  function box(parent, material, size, position) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position); parent.add(mesh); return mesh;
  }
  function stroke(parent, material, points, radius = .045) {
    let total = 0;
    const segments = points.slice(1).map((point, index) => {
      const a = new THREE.Vector3(...points[index]), direction = new THREE.Vector3(...point).sub(a);
      const length = direction.length(), before = total; total += length;
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 8), material);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
      parent.add(mesh); return {mesh, a, direction, length, before};
    });
    return progress => {
      for (const part of segments) {
        const u = clamp((clamp(progress) * total - part.before) / part.length);
        part.mesh.visible = u > 0;
        part.mesh.position.copy(part.a).addScaledVector(part.direction, u / 2);
        part.mesh.scale.y = Math.max(.0001, part.length * u);
      }
    };
  }
  function label(parent, text, width, height, position, color = '#153a32') {
    let texture = null;
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '700 116px sans-serif';
        const size = Math.min(116, 940 / Math.max(1, ctx.measureText(text).width) * 116);
        ctx.font = `700 ${size}px sans-serif`; ctx.fillText(text, 512, 138);
        texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      }
    }
    const material = new THREE.MeshBasicMaterial({map: texture, transparent: true, opacity: texture ? 1 : 0, depthWrite: false});
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.position.set(...position); parent.add(mesh); return mesh;
  }
  function badge(parent, material, radius = .75) {
    const root = new THREE.Group(); parent.add(root);
    root.add(new THREE.Mesh(new THREE.CircleGeometry(radius, 36), material));
    const draw = stroke(root, paper, [[-.36, 0, .06], [-.1, -.25, .06], [.42, .32, .06]], .055);
    draw(1); return root;
  }

  const rig = new THREE.Group(), tractor = buildTractor(m), trailer = buildReefer(m);
  trailer.root.position.x = -2.2;
  for (const leg of trailer.landing) leg.position.y = .7;
  rig.add(tractor.root, trailer.root); content.add(rig);
  box(content, m.pavement, [40, .18, 16], [-7, -.15, 0]);
  const road = new THREE.Group(); content.add(road);
  const markings = Array.from({length: 9}, (_, i) => box(road, m.marking, [2.1, .025, .14], [-24 + i * 4, -.045, 3.6]));

  const dock = new THREE.Group(); content.add(dock);
  for (const z of [-3.5, 3.5]) box(dock, m.rib, [1, 5.3, 3.2], [-20.5, 2.6, z]);
  box(dock, m.rib, [1, 1.1, 10.2], [-20.5, 5.8, 0]);
  box(dock, m.dark, [.08, 3.7, 3.5], [-24, 3.0, 0]);
  box(dock, m.edge, [4.2, .28, 4], [-20, 1.12, 0]);
  for (const z of [-1.85, 1.85]) box(dock, green, [.12, 4, .16], [-19.93, 3, z]);
  const pickupLabel = label(dock, 'SHIPPER', 5.8, 1.05, [-19.9, 6.0, 0]); pickupLabel.rotation.y = Math.PI / 2;
  const receiverLabel = label(dock, 'RECEIVER', 5.8, 1.05, [-19.89, 6.0, 0]); receiverLabel.rotation.y = Math.PI / 2;
  for (const z of [-2.5, 2.5]) box(dock, m.cone, [.22, 1.5, .22], [-18.7, .7, z]);

  const pallets = Array.from({length: 3}, () => {
    const root = new THREE.Group(); content.add(root);
    box(root, wood, [1.6, .14, 1.25], [0, .05, 0]);
    box(root, m.edge, [1.4, 1.15, 1.1], [0, .7, 0]);
    box(root, paper, [.12, 1.16, 1.12], [0, .7, 0]);
    return root;
  });
  const lift = new THREE.Group(); content.add(lift);
  box(lift, m.paint, [1.55, .7, 1.1], [-.5, .65, 0]);
  box(lift, m.dark, [.16, 2.7, 1.0], [.5, 1.5, 0]);
  const forks = new THREE.Group(); lift.add(forks);
  for (const z of [-.4, .4]) box(forks, m.steel, [1.8, .08, .12], [1.2, 0, z]);
  for (const x of [-.9, .35]) for (const z of [-.62, .62]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.27, .27, .18, 12), m.tire);
    wheel.rotation.x = Math.PI / 2; wheel.position.set(x, .3, z); lift.add(wheel);
  }

  const documents = {};
  for (const [kind, title] of [['dispatch', 'DISPATCH'], ['bol', 'BOL'], ['pod', 'POD']]) {
    const root = new THREE.Group(); content.add(root);
    box(root, wood, [6.8, 8.6, .20], [0, 0, 0]);
    box(root, paper, [6.4, 8.2, .09], [0, 0, .14]);
    box(root, kind === 'dispatch' ? m.paint : green, [1.6, .38, .26], [0, 4.1, .18]);
    label(root, title, 5.5, 1.15, [0, 2.9, .24]);
    const checks = [];
    for (let i = 0; i < 3; i++) {
      const y = 1.25 - i * 1.2;
      for (const x of [-2.23, -1.33]) box(root, m.trim, [.055, .9, .055], [x, y, .27]);
      for (const offset of [-.45, .45]) box(root, m.trim, [.95, .055, .055], [-1.78, y + offset, .27]);
      checks.push(stroke(root, green, [[-2.12, y, .35], [-1.87, y - .25, .35], [-1.42, y + .32, .35]], .06));
      box(root, m.trim, [2.9 - i * .25, .10, .055], [.65, y + .16, .27]);
      box(root, m.rib, [2.1, .07, .055], [.25, y - .15, .27]);
    }
    const scan = box(root, m.paintLight, [5.45, .07, .08], [0, 1.9, .38]);
    const stamp = badge(root, green, .73); stamp.position.set(1.9, -2.9, .35);
    const signatureGroup = new THREE.Group(); root.add(signatureGroup);
    const signature = stroke(signatureGroup, green, [[-2.3, -2.65, .3], [-1.9, -2.3, .3], [-2.05, -3.05, .3], [-1.55, -2.55, .3], [-1.18, -2.9, .3], [-.75, -2.5, .3], [-.35, -2.9, .3], [.25, -2.6, .3], [.6, -2.76, .3]], .045);
    label(root, 'AH-01', 1.8, .45, [-1.6, -3.55, .25], '#63735d');
    documents[kind] = {root, checks, scan, stamp, signature, signatureGroup};
  }

  const envelope = new THREE.Group(); content.add(envelope);
  box(envelope, paper, [2.25, 1.45, .12], [0, 0, 0]);
  const flap = stroke(envelope, m.paint, [[-1.06, .62, .12], [0, -.12, .12], [1.06, .62, .12]], .055); flap(1);
  const acknowledgement = badge(content, green, .85);
  const pin = new THREE.Group(); content.add(pin);
  const pinMaterial = new THREE.MeshStandardMaterial({color: 0xc06e40, roughness: .7});
  const pinHead = new THREE.Mesh(new THREE.SphereGeometry(.72, 20, 14), pinMaterial); pin.add(pinHead);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.42, .85, 16), pinMaterial); tip.rotation.z = Math.PI; tip.position.y = -.72; pin.add(tip);
  const pinCheck = badge(pin, green, .47); pinCheck.position.z = .72;
  const ring = new THREE.Mesh(new THREE.RingGeometry(.95, 1.12, 40), new THREE.MeshBasicMaterial({color: 0x245c48, transparent: true, opacity: .7, side: THREE.DoubleSide}));
  ring.rotation.x = -Math.PI / 2; ring.position.set(-18, -.04, -4.8); content.add(ring);
  const route = new THREE.Group(); content.add(route);
  box(route, m.trim, [20, .04, .1], [-5, -.03, 5.6]);
  const routeFill = box(route, green, [20, .07, .15], [-15, 0, 5.6]);
  const routeDots = [-15, -5, 5].map(x => {
    const material = green.clone();
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.37, 16, 12), material);
    dot.position.set(x, .4, 5.6); route.add(dot); return dot;
  });

  // Fixed animation envelope avoids camera breathing as papers, pallets and messages move.
  const frame = new THREE.Box3(new THREE.Vector3(-28, -.5, -9), new THREE.Vector3(14, 13, 10));
  function fitCamera(width, height) {
    const bounds = new THREE.Box3();
    for (const x of [frame.min.x, frame.max.x]) for (const y of [frame.min.y, frame.max.y]) for (const z of [frame.min.z, frame.max.z])
      bounds.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
    const aspect = Math.max(1, width) / Math.max(1, height), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
    const h = Math.max(size.y + 1.2, (size.x + 1.8) / aspect);
    camera.left = center.x - h * aspect / 2; camera.right = center.x + h * aspect / 2;
    camera.top = center.y + h / 2; camera.bottom = center.y - h / 2; camera.updateProjectionMatrix();
  }

  let lastState;
  function applyFrame(index, progress) {
    const s = sampleStage(index, progress); lastState = s;
    rig.position.set(s.rigX, s.bob, 0); road.visible = s.road; dock.visible = s.dock;
    pickupLabel.visible = !s.receiver; receiverLabel.visible = s.receiver;
    tractor.reverseMaterial.emissiveIntensity = s.reversing ? 1.4 : 0;
    for (const wheel of [...tractor.wheels, ...trailer.wheels]) wheel.spin.rotation.z = -s.travel / .51;
    for (const door of trailer.doors) door.root.rotation.y = door.side * s.doors * Math.PI * 1.5;
    markings.forEach((mark, i) => {mark.position.x = -24 + ((i * 4 - s.travel) % 36 + 36) % 36;});
    let moving = -1;
    pallets.forEach((pallet, i) => {
      const u = s.pallets[i];
      pallet.visible = s.cargo !== 'none';
      if (s.cargo === 'waiting') pallet.position.set(-17 + i * 2.2, 0, -5.3);
      else if (s.cargo === 'loading') {
        if (u < .45) pallet.position.set(mix(-17 + i * 2.2, -19.2, smooth(u / .45)), mix(0, 1.25, smooth(u / .45)), mix(-5.3, 0, smooth(u / .45)));
        else pallet.position.set(mix(-19.2, -14, smooth((u - .45) / .55)), 1.25, 0);
        if (u >= .99) pallet.visible = false;
      } else if (s.cargo === 'unloading') {
        if (u < .55) pallet.position.set(mix(-14, -19.2, smooth(u / .55)), 1.25, 0);
        else pallet.position.set(mix(-19.2, -17 + i * 2.2, smooth((u - .55) / .45)), mix(1.25, 0, smooth((u - .55) / .45)), mix(0, -5.3, smooth((u - .55) / .45)));
        if (u <= .01) pallet.visible = false;
      }
      if (u > .015 && u < .985) moving = i;
    });
    lift.visible = moving >= 0;
    if (moving >= 0) {
      const pallet = pallets[moving];
      lift.position.set(pallet.position.x - 2.05, 0, pallet.position.z);
      forks.position.y = pallet.position.y + .04;
    }
    for (const [kind, doc] of Object.entries(documents)) {
      doc.root.visible = s.document === kind && s.paper > 0;
      doc.root.position.set(-6.0, mix(2.5, 7, s.paper), 5.0);
      doc.root.quaternion.copy(camera.quaternion); doc.root.rotateZ((1 - s.paper) * -.18);
      doc.root.scale.setScalar(Math.max(.001, s.paper));
      doc.checks.forEach((draw, i) => draw(s.checks[i]));
      doc.scan.visible = kind === 'bol' && s.scanning; doc.scan.position.y = mix(1.9, -1.9, s.scan);
      doc.stamp.visible = s.stamp > 0; doc.stamp.scale.setScalar(Math.max(.001, s.stamp * (1 + .16 * Math.sin(s.stamp * Math.PI))));
      doc.signatureGroup.visible = kind === 'pod'; doc.signature(s.signature);
    }
    envelope.visible = s.messageVisible;
    const from = s.stage === 0 ? new THREE.Vector3(-5, 8, 5) : new THREE.Vector3(s.rigX + 1, 3.8, .5);
    const to = s.stage === 0 ? new THREE.Vector3(s.rigX + 1, 4.0, .5) : new THREE.Vector3(8, 5.7, 3.5);
    envelope.position.copy(from).lerp(to, s.message); envelope.position.y += Math.sin(s.message * Math.PI) * 2.4;
    envelope.quaternion.copy(camera.quaternion); envelope.rotateZ(Math.sin(s.message * Math.PI * 2) * .15);
    acknowledgement.visible = s.acknowledgement > 0;
    acknowledgement.position.set(s.stage === 0 ? s.rigX + 1 : 8, s.stage === 0 ? 5.4 : 5.7, s.stage === 0 ? .5 : 3.5);
    acknowledgement.quaternion.copy(camera.quaternion); acknowledgement.scale.setScalar(Math.max(.001, s.acknowledgement));
    pin.visible = s.pin > 0; pin.position.set(-18, mix(10.2, 7.7, s.pin), -4.8); pin.quaternion.copy(camera.quaternion);
    pin.scale.setScalar(Math.max(.001, s.pin)); pinMaterial.color.setHex(s.receiver ? 0x245c48 : 0xc06e40);
    pinCheck.visible = s.arrival > 0; pinCheck.scale.setScalar(Math.max(.001, s.arrival));
    ring.visible = s.arrival > 0; ring.scale.setScalar(1 + s.arrival * 1.5); ring.material.opacity = .65 - s.arrival * .32;
    route.visible = s.stage === 4;
    routeFill.scale.x = Math.max(.001, s.waypoints); routeFill.position.x = -15 + 10 * s.waypoints;
    routeDots.forEach((dot, i) => {dot.material.color.setHex(s.waypoints >= i / 2 ? 0x245c48 : 0xb1bca5);});
    return s;
  }
  function dispose() {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    world.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
        materials.add(material); if (material.map) textures.add(material.map);
      }
    });
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
  }
  applyFrame(0, 0);
  return {world, content, camera, fitCamera, applyFrame, setStage: index => applyFrame(index, 1), getState: () => lastState, dispose};
}

export function mountProgressScene(host, onError, {onPlaybackChange = () => {}} = {}) {
  const model = createProgressModel();
  let renderer;
  try {renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'low-power'});}
  catch (error) {model.dispose(); throw error;}
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement; canvas.setAttribute('role', 'img'); host.append(canvas);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false, stage = 0, elapsed = 0, playing = false, visible = true, raf = 0, lastTime = 0, lastPaint = 0, width = 0, height = 0;
  const report = () => onPlaybackChange({playing, finished: elapsed >= STAGE_CLIPS[stage].duration, reduced: reduced.matches});
  function render() {
    if (disposed) return;
    const bounds = host.getBoundingClientRect(); if (!bounds.width || !bounds.height) return;
    if (width !== bounds.width || height !== bounds.height) {
      width = bounds.width; height = bounds.height; renderer.setSize(width, height, false); model.fitCamera(width, height);
    }
    model.applyFrame(stage, elapsed / STAGE_CLIPS[stage].duration); renderer.render(model.world, model.camera);
  }
  function cancel() {if (raf) cancelAnimationFrame(raf); raf = 0; lastTime = 0; lastPaint = 0;}
  function eligible() {return !disposed && playing && visible && !document.hidden;}
  function queue() {if (!raf && eligible()) raf = requestAnimationFrame(tick);}
  function tick(now) {
    raf = 0; if (!eligible()) {lastTime = 0; return;}
    if (lastTime) elapsed = Math.min(STAGE_CLIPS[stage].duration, elapsed + Math.min(.10, (now - lastTime) / 1000));
    lastTime = now;
    try {if (!lastPaint || now - lastPaint >= 32 || elapsed >= STAGE_CLIPS[stage].duration) {render(); lastPaint = now;}}
    catch {onError(); return;}
    if (elapsed >= STAGE_CLIPS[stage].duration) {playing = false; report();} else queue();
  }
  function play(restart) {
    if (disposed) return;
    if (restart || elapsed >= STAGE_CLIPS[stage].duration) elapsed = 0;
    playing = true; cancel(); report(); try {render(); queue();} catch {onError();}
  }
  const observer = new ResizeObserver(() => {try {render();} catch {onError();}}); observer.observe(host);
  const intersection = new IntersectionObserver(entries => {
    visible = entries.at(-1).isIntersecting;
    if (!visible) cancel(); else {lastTime = 0; queue();}
  }, {threshold: .08}); intersection.observe(host);
  const visibility = () => {if (document.hidden) cancel(); else {lastTime = 0; queue();}};
  const preference = () => {
    if (reduced.matches) {playing = false; elapsed = STAGE_CLIPS[stage].duration; cancel(); report(); try {render();} catch {onError();}}
  };
  const lost = event => {event.preventDefault(); onError();};
  document.addEventListener('visibilitychange', visibility); reduced.addEventListener('change', preference); canvas.addEventListener('webglcontextlost', lost);
  return {
    setStage(index, labelText) {
      stage = Math.max(0, Math.min(6, index)); elapsed = reduced.matches ? STAGE_CLIPS[stage].duration : 0;
      playing = !reduced.matches; cancel(); report();
      canvas.setAttribute('aria-label', `${labelText}. ${STAGE_CLIPS[stage].action}. Illustrative 3D load.`);
      try {render(); queue();} catch {onError();}
    },
    replay() {play(true);},
    togglePlayback() {if (playing) {playing = false; cancel(); report();} else play(false);},
    dispose() {
      if (disposed) return; disposed = true; cancel(); observer.disconnect(); intersection.disconnect();
      document.removeEventListener('visibilitychange', visibility); reduced.removeEventListener('change', preference); canvas.removeEventListener('webglcontextlost', lost);
      model.dispose(); renderer.dispose(); canvas.remove();
    }
  };
}
