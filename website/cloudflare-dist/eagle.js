import * as THREE from './vendor/three.module.js';
import {smooth} from './journey.js';

const matte = color => new THREE.MeshStandardMaterial({color, roughness: .95, flatShading: true, side: THREE.DoubleSide});

function facetedWing(side) {
  // A closed, ridged silhouette: twelve broad facets and five pointed primaries.
  const edge = [[.62, 0, .18], [.42, .08, 1.18], [.12, .05, 2.25],
    [-.12, 0, 3.1], [-.35, -.03, 2.65], [-.55, -.04, 3.0],
    [-.64, -.02, 2.45], [-.86, -.04, 2.76], [-.9, 0, 2.14],
    [-1.12, 0, 2.34], [-.96, .01, 1.51], [-.71, .03, .23]];
  const ridge = [-.12, .22, 1.22], underside = [-.12, -.10, 1.22], positions = [];
  const push = point => positions.push(point[0], point[1], point[2] * side);
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i], b = edge[(i + 1) % edge.length];
    for (const p of [ridge, a, b, underside, b, a]) push(p);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals(); return geometry;
}

export function createEagle() {
  const root = new THREE.Group(); root.name = 'eye-in-the-sky'; root.visible = false;
  const dark = matte(0x334332), brown = matte(0x59634b), cream = matte(0xf5f3eb), beak = matte(0xd99a4c);
  function part(geometry, material, position, scale) {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position);
    if (scale) mesh.scale.set(...scale);
    mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); return mesh;
  }
  part(new THREE.IcosahedronGeometry(1, 0), brown, [0, 0, 0], [.92, .36, .4]);
  part(new THREE.IcosahedronGeometry(1, 0), cream, [.81, .17, 0], [.39, .32, .31]);
  const bill = part(new THREE.ConeGeometry(.13, .42, 4), beak, [1.18, .12, 0]);
  bill.rotation.z = -Math.PI / 2;
  for (const side of [-1, 1]) part(new THREE.IcosahedronGeometry(.047, 0), dark, [.98, .26, side * .245]);
  const tail = part(new THREE.ConeGeometry(.57, 1.15, 4), cream, [-1.05, -.03, 0], [1, 1, .28]);
  tail.rotation.z = -Math.PI / 2;
  const wings = [-1, 1].map(side => {
    const pivot = new THREE.Group(); pivot.name = `wing-${side}`; root.add(pivot);
    const mesh = new THREE.Mesh(facetedWing(side), dark);
    mesh.castShadow = true; mesh.receiveShadow = true; pivot.add(mesh);
    return {pivot, side};
  });
  return {root, wings};
}

// Sun-to-shadow ratios must match scene.js. At t=5 the true shadow crosses the roof.
export function flightPose(seconds, entry = {x: 32, y: 24, z: -30}) {
  const t = Math.max(0, seconds), pass = {x: -70 / 135 * (11 - 4.13), y: 11, z: 80 / 135 * (11 - 4.13)};
  if (t < 5) {
    const u = t / 5, v = 1 - u;
    const controlA = {x: entry.x - 10, y: 19, z: entry.z + 8};
    const controlB = {x: pass.x - 3.2, y: 11, z: pass.z};
    const bezier = key => v ** 3 * entry[key] + 3 * v * v * u * controlA[key] + 3 * v * u * u * controlB[key] + u ** 3 * pass[key];
    const tangent = key => 3 * v * v * (controlA[key] - entry[key]) + 6 * v * u * (controlB[key] - controlA[key]) + 3 * u * u * (pass[key] - controlB[key]);
    const dx = tangent('x'), dz = tangent('z');
    return {x: bezier('x'), y: bezier('y'), z: bezier('z'), heading: -Math.atan2(dz, dx), bank: Math.sin(u * Math.PI) * -.28, flap: Math.sin(t * 2.3) * .09 * (1 - smooth(u))};
  }
  const angle = (t - 5) * .24;
  return {x: pass.x + 8 * Math.sin(angle), y: 11 + 1.2 * (1 - Math.cos(angle)),
    z: pass.z + 5 * (1 - Math.cos(angle)), heading: -Math.atan2(5 * Math.sin(angle), 8 * Math.cos(angle)),
    bank: -.18 * smooth((t - 5) / 2), flap: Math.sin(t * 1.7) * .035};
}

export function createEagleFlight(world) {
  const {root, wings} = createEagle(); world.add(root);
  const entry = new THREE.Vector3(), direction = new THREE.Vector3(), base = new THREE.Vector3();
  let active = false, seconds = 0;
  function update(state, camera, dt, reducedMotion, paused = false) {
    const transit = state.phase === 2;
    root.visible = transit;
    if (!transit) {active = false; seconds = 0; return;}
    // The light's actual projection, rather than a separate fake ground shadow.
    base.set(state.pinX - 6.55 * Math.cos(state.trailerHeading), 0, state.pinZ + 6.55 * Math.sin(state.trailerHeading));
    if (!active) {
      entry.set(1.3, 1.3, -1).unproject(camera); camera.getWorldDirection(direction);
      entry.addScaledVector(direction, (24 - entry.y) / direction.y).sub(base);
      active = true; seconds = 0;
    } else if (!paused && !reducedMotion) seconds += dt;
    const pose = flightPose(reducedMotion ? 5 : seconds, entry);
    root.position.set(base.x + pose.x, pose.y, base.z + pose.z);
    root.rotation.set(pose.bank, pose.heading, .025 * Math.sin(seconds * .8), 'YXZ');
    for (const {pivot, side} of wings) pivot.rotation.x = side * (.025 + pose.flap);
  }
  return {update};
}
