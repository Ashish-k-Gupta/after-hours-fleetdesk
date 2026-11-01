import * as THREE from './vendor/three.module.js';
import {sceneryBatch} from './scenery-batch.js';

// Five coupled rigs, with an open center aisle and a clear highway departure.
export const PARKED_RIGS = [
  {x: -12.8, z: -4, color: 0x6c826d},
  {x: -12.8, z: -10, color: 0x425963},
  {x: -12.8, z: -16, color: 0xb18166},
  {x: -36.8, z: -4, color: 0x536b59},
  {x: -36.8, z: -10, color: 0x8c9282},
];

export function buildParkedFleet(yard) {
  const fleet = new THREE.Group(); fleet.name = 'parked-yard-fleet'; yard.add(fleet);
  const batch = sceneryBatch(fleet), tire = 0x34403a, glass = 0x3b5658, steel = 0xa0aa98, white = 0xeceee2;
  for (const {x, z, color} of PARKED_RIGS) {
    // A deliberately simpler version of the hero tractor, suitable for the background.
    batch.box(tire, [6.6, .25, 1.0], [x - .1, .91, z]);
    batch.box(color, [2.3, 2.15, 2.17], [x + .2, 2.27, z]);
    batch.box(color, [.95, 2.58, 2.15], [x - 1.15, 2.43, z]);
    batch.box(color, [1.75, .84, 1.92], [x + 2.08, 1.63, z]);
    batch.box(color, [2.48, .18, 2.23], [x + .15, 3.44, z]);
    batch.box(glass, [.055, .67, 1.86], [x + 1.38, 2.94, z], [0, 0, .18]);
    batch.box(steel, [.16, .24, 2.4], [x + 3.05, .91, z]);
    batch.box(tire, [.055, .54, 1.03], [x + 2.99, 1.66, z]);
    for (const side of [-1, 1]) {
      batch.box(glass, [1.75, .64, .035], [x + .36, 2.96, z + side * 1.104]);
      batch.box(steel, [1.1, .12, .33], [x + .18, .78, z + side * 1.13]);
      batch.box(0xe8dfb9, [.045, .17, .32], [x + 2.99, 1.62, z + side * .7]);
      for (const axle of [2.15, -1.85, -3.05]) {
        batch.cylinder(tire, .5, .32, [x + axle, .5, z + side * 1.04], [Math.PI / 2, 0, 0]);
        batch.cylinder(steel, .27, .035, [x + axle, .5, z + side * 1.215], [Math.PI / 2, 0, 0]);
        if (axle < 0) batch.cylinder(tire, .5, .29, [x + axle, .5, z + side * .72], [Math.PI / 2, 0, 0]);
      }
    }
    const pin = x - 2.2;
    batch.box(white, [13.3, 2.8, 2.5], [pin - 6.1, 2.65, z]);
    batch.box(0xc9cfbd, [13.5, .12, 2.58], [pin - 6.1, 4.1, z]);
    batch.box(steel, [13.4, .17, 2.5], [pin - 6.1, 1.22, z]);
    for (const side of [-1, 1]) {
      for (let rib = 0; rib < 32; rib++) batch.box(0xd4d9c9, [.035, 2.6, .03], [pin - 12.45 + rib * .4, 2.66, z + side * 1.265]);
      for (const axle of [-11, -9.7]) {
        batch.cylinder(tire, .48, .3, [pin + axle, .48, z + side * 1.08], [Math.PI / 2, 0, 0]);
        batch.cylinder(steel, .25, .035, [pin + axle, .48, z + side * 1.25], [Math.PI / 2, 0, 0]);
      }
      batch.box(steel, [.14, 1.05, .14], [pin - 2.3, .7, z + side * .9]);
      batch.box(0xb77359, [13.2, .065, .035], [pin - 6.1, 1.47, z + side * 1.275]);
    }
    batch.box(white, [.055, 2.55, 2.43], [pin - 12.78, 2.65, z]);
    batch.box(steel, [.12, .16, 2.46], [pin - 12.85, .56, z]);
  }
  batch.finish();
  fleet.userData.units = PARKED_RIGS.map(({x, z}) => ({x, z, coupled: true, minX: x - 15.05, maxX: x + 3.15, minZ: z - 1.3, maxZ: z + 1.3}));
  return fleet;
}
