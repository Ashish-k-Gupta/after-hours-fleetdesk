import * as THREE from './vendor/three.module.js';
import {roadZ, roadSlope} from './route.js';
import {sceneryBatch, sceneryLabel} from './scenery-batch.js';

// A compressed westbound study: Memphis, then Groom, then Amarillo.
// The site is an illustrative load story rather than a geographic navigation map.
export const LANDMARK_LOTS = [
  {id: 'britten-water-tower', x: 137, z: roadZ(137) + 14, halfX: 5, halfZ: 5},
  {id: 'cadillac-ranch', x: 174, z: roadZ(174) + 14, halfX: 10, halfZ: 5},
];
export function landmarkClearance(x, z) {
  return LANDMARK_LOTS.some(lot => Math.abs(x - lot.x) < lot.halfX + 2 && Math.abs(z - lot.z) < lot.halfZ + 2);
}

function bridge(world) {
  const group = new THREE.Group(); group.name = 'i40-memphis-bridge'; world.add(group);
  const batch = sceneryBatch(group), steel = 0x9caa9d, cable = 0x748876;
  function point(x, y, side) {
    const slope = roadSlope(x), n = Math.hypot(1, slope), offset = side * 5.45;
    return [x - slope * offset / n, y, roadZ(x) + offset / n];
  }
  for (const side of [-1, 1]) {
    for (let span = 0; span < 2; span++) {
      const start = 92 + span * 13;
      for (let i = 0; i < 12; i++) {
        const a = i / 12, b = (i + 1) / 12;
        batch.rod(steel, point(start + a * 13, .65 + Math.sin(a * Math.PI) * 5.7, side), point(start + b * 13, .65 + Math.sin(b * Math.PI) * 5.7, side), .14);
      }
      for (let hanger = 1; hanger < 8; hanger++) {
        const u = hanger / 8, x = start + u * 13;
        batch.rod(cable, point(x, .5, side), point(x, .65 + Math.sin(u * Math.PI) * 5.7, side), .035);
      }
    }
  }
  batch.finish();
  sceneryLabel(group, 'MEMPHIS', 'I-40 / HERNANDO DE SOTO BRIDGE', [117, 2.1, roadZ(117) + 12], 9.5);
  group.userData.location = 'Memphis, Tennessee / West Memphis, Arkansas';
  return group;
}

function waterTower(world, lot) {
  const root = new THREE.Group(); root.name = 'i40-' + lot.id; root.position.set(lot.x, 0, lot.z); world.add(root);
  const baseBatch = sceneryBatch(root); baseBatch.box(0xd8d6bf, [8, .11, 7], [0, -.16, 0]); baseBatch.finish();
  const tilted = new THREE.Group(); tilted.rotation.z = -5 * Math.PI / 180; root.add(tilted);
  const batch = sceneryBatch(tilted), metal = 0x9ca796, white = 0xe9e9db;
  for (const x of [-1.25, 1.25]) for (const z of [-1.25, 1.25]) batch.rod(metal, [x * 1.35, 0, z * 1.35], [x, 5.8, z], .085);
  for (const side of [-1, 1]) {
    batch.rod(metal, [-1.5, 1.3, side * 1.5], [1.25, 5.5, side * 1.25], .045);
    batch.rod(metal, [1.5, 1.3, side * 1.5], [-1.25, 5.5, side * 1.25], .045);
    batch.rod(metal, [side * 1.5, 1.3, -1.5], [side * 1.25, 5.5, 1.25], .045);
  }
  batch.cylinder(white, 1.72, 2.4, [0, 6.6, 0]);
  batch.cylinder(metal, 1.8, .12, [0, 5.45, 0]);
  batch.cone(white, 1.76, .65, [0, 8.1, 0]);
  batch.finish();
  sceneryLabel(tilted, 'BRITTEN', 'U.S.A.', [0, 6.62, 1.73], 2.8);
  sceneryLabel(root, 'LEANING WATER TOWER', 'GROOM / TEXAS', [.8, 1.5, 4.2], 8.4);
  root.userData.location = 'Groom, Texas';
  return root;
}

function cadillacRanch(world, lot) {
  const root = new THREE.Group(); root.name = 'i40-' + lot.id; root.position.set(lot.x, 0, lot.z); world.add(root);
  const batch = sceneryBatch(root), palette = [0xbc7e62,0x65816d,0x788e98,0xd1a169,0x8c9a74,0xb68d81,0x657b74,0xc3af8c,0x9d7663,0x869b87];
  batch.box(0xd8d2b5, [19, .12, 6.2], [0, -.15, 0]);
  const pose = new THREE.Object3D();
  for (let i = 0; i < 10; i++) {
    pose.position.set(-7.65 + i * 1.7, .94, 0); pose.rotation.set(0, Math.PI / 2, -Math.PI / 3, 'YXZ'); pose.updateMatrix();
    const color = palette[i];
    batch.box(color, [2.9, .47, 1.06], [0, .08, 0], undefined, pose.matrix);
    batch.box(color, [1.25, .46, .86], [-.28, .53, 0], undefined, pose.matrix);
    batch.box(0x54716a, [.035, .3, .8], [.37, .53, 0], undefined, pose.matrix);
    batch.box(0xd7dbc9, [.11, .14, 1.16], [-1.48, .06, 0], undefined, pose.matrix);
    for (const side of [-1, 1]) {
      batch.box(color, [.78, .38, .09], [-1.04, .39, side * .51], undefined, pose.matrix);
      for (const axle of [-.87, .88]) batch.cylinder(0x3f4c42, .23, .12, [axle, -.12, side * .57], [Math.PI / 2, 0, 0], pose.matrix);
    }
    batch.box(palette[(i + 3) % palette.length], [.48, .025, .68], [-.22, .775, 0], undefined, pose.matrix);
  }
  batch.finish();
  sceneryLabel(root, 'CADILLAC RANCH', 'AMARILLO / TEXAS', [1, 1.7, 4.4], 9.2);
  root.userData.cars = 10; root.userData.location = 'Amarillo, Texas';
  return root;
}

function interstateSign(world) {
  const root = new THREE.Group(); root.name = 'i40-route-marker'; root.position.set(78, 0, roadZ(78) + 8); world.add(root);
  const batch = sceneryBatch(root); batch.box(0x7c8b77, [.12, 3.2, .12], [0, 1.5, 0]); batch.finish();
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#F5F3EB'; ctx.fillRect(0, 0, 256, 320);
    ctx.fillStyle = '#57716e'; ctx.beginPath(); ctx.moveTo(16, 54); ctx.lineTo(240, 54); ctx.lineTo(231, 223); ctx.lineTo(128, 270); ctx.lineTo(25, 223); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#B46C54'; ctx.fillRect(16, 26, 224, 65);
    ctx.textAlign = 'center'; ctx.fillStyle = '#F5F3EB'; ctx.font = '28px Arial, sans-serif'; ctx.fillText('INTERSTATE', 128, 69);
    ctx.font = '700 125px Arial, sans-serif'; ctx.fillText('40', 128, 211);
    ctx.fillStyle = '#1C3A27'; ctx.font = '27px monospace'; ctx.fillText('WEST', 128, 309);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.125), new THREE.MeshBasicMaterial({map: texture}));
  sign.position.y = 3.1; root.add(sign);
}

export function buildI40Landmarks(world) {
  const landmarks = [bridge(world), waterTower(world, LANDMARK_LOTS[0]), cadillacRanch(world, LANDMARK_LOTS[1])];
  interstateSign(world); return landmarks;
}
