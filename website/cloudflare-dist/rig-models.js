import * as THREE from "./vendor/three.module.js";
const HITCH = { fifthWheelX: -2.2 };

// Original After Hours models developed for the hookup experiment, reused here
// as assets with opening rear doors. The journey website and controller are new.
export function makeMaterials() {
  const matte = (color, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const lamp = color => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2, roughness: 0.4 });
  return {
    paint: matte(0xd97751, 0.4, 0.12), paintLight: matte(0xeb936c, 0.5, 0.06),
    tire: matte(0x303633, 0.94), rubber: matte(0x424b43), steel: matte(0x768477, 0.45, 0.32),
    rim: matte(0xc2cec0, 0.35, 0.48), dark: matte(0x35453b), glass: matte(0x274d50, 0.25, 0.22),
    white: matte(0xf4f2e7, 0.56, 0.05), rib: matte(0xd8ddd2, 0.5, 0.1), trim: matte(0xadb9a8, 0.45, 0.25),
    amber: lamp(0xfab86b), red: lamp(0xd75b43), headlamp: lamp(0xffe5b5), reverse: lamp(0xfaf3d7),
    reefer: matte(0xe4e9dd), grille: matte(0x5f7362),
    pavement: matte(0xd5ddcc), edge: matte(0xc7d1bf), marking: matte(0xf4f5e9),
    stripe: matte(0xd4a174), cone: matte(0xe18d61), coneBand: matte(0xf4f0df)
  };
}

function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(x, y, z);
  part.castShadow = true;
  part.receiveShadow = true;
  parent.add(part);
  return part;
}

function box(parent, material, w, h, d, x, y, z) {
  return mesh(new THREE.BoxGeometry(w, h, d), material, parent, x, y, z);
}

function cylinder(parent, material, radius, length, x, y, z, axis = "y", segments = 20) {
  const part = mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material, parent, x, y, z);
  if (axis === "x") part.rotation.z = Math.PI / 2;
  if (axis === "z") part.rotation.x = Math.PI / 2;
  return part;
}

function rod(parent, material, from, to, radius = 0.025) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), direction = b.clone().sub(a);
  const part = cylinder(parent, material, radius, direction.length(), 0, 0, 0, "y", 8);
  part.position.copy(a).add(b).multiplyScalar(0.5);
  part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return part;
}

function profile(parent, material, points, depth, z = 0, bevel = 0.03) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => index ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1, curveSegments: 1 });
  geometry.translate(0, 0, z - depth / 2);
  return mesh(geometry, material, parent);
}

function quad(parent, material, points) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([...points[0], ...points[1], ...points[2], ...points[0], ...points[2], ...points[3]], 3));
  geometry.computeVertexNormals();
  const part = mesh(geometry, material, parent);
  part.material = material.clone();
  part.material.side = THREE.DoubleSide;
  return part;
}

function wheel(parent, m, x, z, front = false) {
  const steering = new THREE.Group();
  steering.position.set(x, 0.52, z);
  const spin = new THREE.Group();
  steering.add(spin); parent.add(steering);
  cylinder(spin, m.tire, 0.51, 0.29, 0, 0, 0, "z", 28);
  for (const side of [-1, 1]) {
    cylinder(spin, m.rubber, 0.425, 0.018, 0, 0, side * 0.154, "z", 24);
    cylinder(spin, m.rim, 0.285, 0.029, 0, 0, side * 0.169, "z", 24);
    cylinder(spin, m.steel, 0.105, 0.065, 0, 0, side * 0.19, "z", 16);
    const holes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.008, 6), m.dark, 8);
    const transform = new THREE.Object3D();
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      transform.position.set(Math.cos(angle) * 0.203, Math.sin(angle) * 0.203, side * 0.186);
      transform.rotation.x = Math.PI / 2; transform.updateMatrix(); holes.setMatrixAt(i, transform.matrix);
    }
    spin.add(holes);
  }
  return { steering, spin, front };
}

export function buildTractor(m) {
  const root = new THREE.Group(); root.name = "original-orange-tractor";
  const wheels = [];
  box(root, m.dark, 6.7, 0.22, 0.9, -0.1, 0.94, 0);
  for (const z of [-0.47, 0.47]) box(root, m.steel, 6.7, 0.16, 0.1, -0.1, 0.83, z);
  for (const x of [2.15, -1.85, -3.05]) {
    cylinder(root, m.dark, 0.095, 2.04, x, 0.52, 0, "z", 10);
    for (const side of [-1, 1]) {
      wheels.push(wheel(root, m, x, side * 1.055, x === 2.15));
      if (x !== 2.15) wheels.push(wheel(root, m, x, side * 0.744));
    }
  }
  const cab = new THREE.Group(); cab.name = "cab-collider"; root.add(cab);
  profile(cab, m.paint, [[-0.9,1.12],[1.45,1.12],[1.45,2.48],[1.02,3.32],[0.55,3.55],[-0.65,3.55],[-0.95,3.22]], 2.16);
  profile(cab, m.paintLight, [[1.4,1.13],[3.08,1.13],[3.08,1.8],[1.45,2.08]], 1.83, 0, 0.04);
  // Windshield follows the forward rake of the new cab profile.
  quad(cab, m.glass, [[1.473,2.54,-0.94],[1.094,3.24,-0.94],[1.094,3.24,0.94],[1.473,2.54,0.94]]);
  rod(cab, m.paint, [1.48,2.54,0], [1.1,3.24,0], 0.025);
  for (const side of [-1, 1]) {
    profile(cab, m.glass, [[-0.1,2.38],[1.24,2.38],[0.93,3.15],[-0.1,3.15]], 0.018, side * 1.097, 0);
    profile(cab, m.glass, [[-0.7,2.6],[-0.3,2.6],[-0.3,3.12],[-0.7,3.12]], 0.015, side * 1.097, 0);
    box(cab, m.paintLight, 0.055, 1.17, 0.018, -0.2, 1.91, side * 1.108);
    box(cab, m.paintLight, 1.33, 0.045, 0.022, 0.5, 1.35, side * 1.109);
    box(cab, m.steel, 0.19, 0.052, 0.055, 0.02, 2.16, side * 1.13);
    box(root, m.steel, 1.1, 0.13, 0.36, 0.45, 0.91, side * 1.14);
    box(root, m.rim, 0.83, 0.12, 0.37, 0.3, 0.64, side * 1.15);
    rod(cab, m.steel, [1.2,2.55,side * 1.08], [1.32,2.68,side * 1.5], 0.025);
    box(cab, m.dark, 0.16, 0.43, 0.12, 1.32, 2.65, side * 1.48);
    cylinder(root, m.rim, 0.27, 1.15, -0.73, 0.6, side * 1.02, "x", 20);
    for (const x of [-1.02, -0.47]) box(root, m.steel, 0.055, 0.52, 0.37, x, 0.6, side * 1.02);
    box(root, m.dark, 2.6, 0.1, 0.56, -2.43, 1.12, side * 1.02);
    box(root, m.rubber, 0.07, 0.62, 0.61, -3.59, 0.53, side * 1.0);
    const fender = mesh(new THREE.TorusGeometry(0.63, 0.085, 6, 20, Math.PI), m.paint, root, 2.15, 0.52, side * 1.11);
    fender.receiveShadow = false;
    box(root, m.headlamp, 0.06, 0.22, 0.31, 3.116, 1.48, side * 0.68);
    box(root, m.amber, 0.035, 0.09, 0.17, 3.12, 1.31, side * 0.72);
    box(root, m.red, 0.04, 0.12, 0.17, -3.48, 0.91, side * 0.49);
  }
  box(root, m.steel, 0.25, 0.27, 2.47, 3.18, 0.9, 0);
  box(root, m.dark, 0.07, 0.56, 1.04, 3.13, 1.65, 0);
  box(root, m.rim, 0.09, 0.61, 0.045, 3.18, 1.65, -0.55);
  box(root, m.rim, 0.09, 0.61, 0.045, 3.18, 1.65, 0.55);
  for (let i = 0; i < 7; i++) box(root, m.steel, 0.045, 0.029, 0.96, 3.18, 1.43 + i * 0.07, 0);
  for (let i = 0; i < 5; i++) box(cab, m.amber, 0.13, 0.07, 0.09, 0.6, 3.53, -0.72 + i * 0.36);
  box(root, m.steel, 1.2, 0.07, 1.2, -1.38, 1.13, 0);
  cylinder(root, m.dark, 0.53, 0.12, HITCH.fifthWheelX, 1.2, 0, "y", 28);
  box(root, m.steel, 0.45, 0.06, 0.65, HITCH.fifthWheelX + 0.15, 1.275, 0);
  const reverseMaterial = m.reverse.clone(); reverseMaterial.emissiveIntensity = 0;
  for (const z of [-0.24, 0.24]) box(root, reverseMaterial, 0.035, 0.11, 0.14, -3.49, 0.91, z);
  return { root, wheels, cab, reverseMaterial };
}

export function buildReefer(m, {dryVan = false} = {}) {
  const root = new THREE.Group(); root.name = "original-white-reefer";
  const wheels = [], landing = [], doors = [];
  const body = box(root, m.white, 14.6, 2.7, 2.5, -6.55, 2.71, 0);
  body.name = "trailer-body-collider";
  box(root, m.trim, 14.7, 0.1, 2.55, -6.55, 1.35, 0);
  const roof = box(root, dryVan ? m.white.clone() : m.white, 14.65, 0.11, 2.52, -6.55, 4.075, 0);
  roof.name = 'trailer-roof';
  const sidePanels = [];
  if (dryVan) {
    root.name = 'after-hours-53-foot-dry-van';
    body.visible = false;
    box(root, m.white, .06, 2.7, 2.5, .72, 2.71, 0);
    box(root, m.white, 14.6, .1, 2.5, -6.55, 1.42, 0);
    for (const side of [-1, 1]) sidePanels.push(box(root, m.white.clone(), 14.6, 2.7, .04, -6.55, 2.71, side * 1.23));
    for (const panel of [...sidePanels, roof]) {panel.material.transparent = true; panel.material.depthWrite = false;}
  }
  // Corrugation and reflectors are instanced, keeping this repeated detail cheap.
  const ribs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.023, 2.56, 0.025), m.rib, 144);
  const transform = new THREE.Object3D();
  let index = 0;
  for (const side of [-1, 1]) for (let i = 0; i < 72; i++) {
    transform.position.set(-13.63 + i * 0.2, 2.72, side * 1.261);
    transform.updateMatrix(); ribs.setMatrixAt(index++, transform.matrix);
  }
  ribs.castShadow = true; ribs.receiveShadow = true; root.add(ribs);
  for (const side of [-1, 1]) {
    box(root, m.dark, 14.58, 0.1, 0.028, -6.55, 1.65, side * 1.27);
    box(root, m.paint, 2.3, 0.1, 0.032, -1.4, 1.65, side * 1.278);
    for (let i = 0; i < 14; i++) box(root, i % 2 ? m.red : m.marking, 0.31, 0.055, 0.03, -12.7 + i * 0.9, 1.43, side * 1.28);
    for (const x of [-13.5, -8.2, -3.0, 0.3]) box(root, m.amber, 0.12, 0.075, 0.04, x, 1.51, side * 1.28);
    box(root, m.steel, 12.7, 0.11, 0.1, -6.8, 1.12, side * 0.74);
    box(root, m.rib, 6.9, 0.58, 0.075, -5.7, 0.94, side * 1.13);
    // Upper post and telescoping lower leg. Only the lower assembly is animated.
    box(root, m.steel, 0.17, 0.5, 0.17, -2.75, 1.06, side * 0.88);
    const lower = new THREE.Group(); lower.position.set(-2.75, 0, side * 0.88);
    box(lower, m.dark, 0.125, 0.9, 0.125, 0, 0.57, 0);
    box(lower, m.steel, 0.42, 0.07, 0.39, 0, 0.085, 0);
    root.add(lower); landing.push(lower);
    rod(root, m.steel, [-2.75,1.22,side * 0.88], [-3.55,1.27,side * 0.88], 0.025);
  }
  rod(root, m.steel, [-2.75,1.05,-0.88], [-2.75,1.05,0.88], 0.045);
  cylinder(root, m.steel, 0.06, 0.23, 0, 1.23, 0, "y", 12);
  for (const x of [-10.65, -11.85]) {
    cylinder(root, m.dark, 0.1, 2.17, x, 0.52, 0, "z", 10);
    for (const side of [-1, 1]) for (const offset of [0.745, 1.055]) wheels.push(wheel(root, m, x, side * offset));
    box(root, m.steel, 1.4, 0.12, 1.4, x, 0.9, 0);
  }
  for (const side of [-1, 1]) {
    box(root, m.dark, 0.065, 0.66, 0.61, -12.57, 0.55, side * 1.01);
    const door = new THREE.Group(); door.position.set(-13.89, 0, side * 1.30);
    box(door, m.white, 0.06, 2.53, 1.23, 0, 2.72, -side * 0.615);
    rod(door, m.steel, [-0.05,1.58,-side * 0.78], [-0.05,3.85,-side * 0.78], 0.03);
    box(door, m.steel, 0.06, 0.06, 0.28, -0.07, 2.01, -side * 0.78);
    root.add(door); doors.push({ root: door, side });
    for (const y of [1.6, 2.5, 3.6]) box(root, m.trim, 0.05, 0.12, 0.21, -13.95, y, side * 1.1);
  }
  box(root, m.dark, 0.17, 0.24, 2.4, -13.98, 1.25, 0);
  box(root, m.steel, 0.12, 0.17, 2.4, -14.02, 0.53, 0);
  for (const z of [-0.85, 0.85]) box(root, m.steel, 0.1, 0.65, 0.09, -13.96, 0.88, z);
  const trailerRed = m.red.clone(), trailerAmber = m.amber.clone();
  for (const z of [-0.96,-0.74,0.74,0.96]) cylinder(root, trailerRed, 0.075, 0.035, -14.08, 1.25, z, "x", 12);
  for (const z of [-0.16,0,0.16]) box(root, trailerRed, 0.04, 0.07, 0.09, -13.94, 4.1, z);
  // The Atlas can use a dry van; the separate lifecycle keeps its original reefer.
  if (dryVan) return {root, body, roof, sidePanels, reefer: new THREE.Group(), wheels, landing, doors, fan: new THREE.Group(), trailerRed, trailerAmber};
  // An original front reefer assembly: one upper fan and a lower ventilation bank.
  const reefer = box(root, m.reefer, 0.32, 2.47, 1.54, 0.94, 2.75, 0);
  reefer.name = "reefer-collider";
  cylinder(root, m.dark, 0.48, 0.05, 1.116, 3.35, 0, "x", 32);
  cylinder(root, m.rib, 0.438, 0.04, 1.147, 3.35, 0, "x", 32);
  const fan = new THREE.Group(); fan.position.set(1.178, 3.35, 0); root.add(fan);
  for (let i = 0; i < 6; i++) {
    const blade = box(fan, m.grille, 0.025, 0.62, 0.085, 0, 0, 0);
    blade.rotation.x = i * Math.PI / 3;
  }
  cylinder(root, m.steel, 0.12, 0.045, 1.2, 3.35, 0, "x", 16);
  box(root, m.grille, 0.035, 0.72, 1.17, 1.115, 2.23, 0);
  for (let i = 0; i < 11; i++) box(root, m.rib, 0.06, 0.02, 1.11, 1.15, 1.93 + i * 0.059, 0);
  box(root, m.dark, 0.045, 0.22, 0.2, 1.12, 2.78, 0.54);
  box(root, trailerAmber, 0.052, 0.043, 0.08, 1.152, 2.8, 0.54);
  return { root, body, reefer, wheels, landing, doors, fan, trailerRed, trailerAmber };
}

