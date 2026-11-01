import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {buildWorld} from '../dist/world.js';
import {makeMaterials,buildTractor,buildReefer} from '../dist/rig-models.js';
import {journeyAt} from '../dist/journey.js';
import {roadZ,roadSlope} from '../dist/route.js';

const context = Object.fromEntries(['fillRect','fillText','beginPath','moveTo','lineTo','closePath','fill'].map(name=>[name,()=>{}]));
globalThis.document = {createElement:()=>({width:1,height:1,getContext:()=>context})};
const world = new THREE.Scene();
buildWorld(world);
world.updateMatrixWorld(true);
const terrain = world.getObjectByName('route-terrain');
assert.ok(terrain);
const ground = world.getObjectByName('atlas-base-ground');
const terrainPositions = terrain.geometry.getAttribute('position');
let minimumTerrain = Infinity;
for (let i=0;i<terrainPositions.count;i++) minimumTerrain = Math.min(minimumTerrain,terrainPositions.getY(i));
assert.ok(ground.position.y < minimumTerrain-.1,'Base ground must not be coplanar with flattened terrain.');
const ray = new THREE.Raycaster(), down = new THREE.Vector3(0,-1,0), point = new THREE.Vector3();
let samples = 0, maximum = -Infinity;
function clear(x,z,label) {
  ray.set(point.set(x,30,z),down);
  const hit = ray.intersectObject(terrain)[0];
  if (hit) {
    maximum = Math.max(maximum,hit.point.y);
    assert.ok(hit.point.y < -.14, `${label}: terrain reaches ${hit.point.y} at ${x}, ${z}`);
  }
  samples++;
}
// Test actual interpolated hill triangles, including the shoulder on each side.
for (let i=0;i<=1000;i++) {
  const x=-35+i*275/1000, slope=roadSlope(x), norm=Math.hypot(1,slope);
  for (const side of [-1,0,1]) clear(x-slope*side*6.1/norm,roadZ(x)+side*6.1/norm,'Road shoulder');
}
const materials=makeMaterials(),tractor=buildTractor(materials),trailer=buildReefer(materials,{dryVan:true});
for(let i=0;i<=2000;i++) {
  const state=journeyAt(i/2000);
  for (const [model,x,z,heading] of [[tractor,state.x,state.z,state.heading],[trailer,state.pinX,state.pinZ,state.trailerHeading]]) {
    model.root.position.set(x,0,z);model.root.rotation.y=heading;model.root.updateMatrixWorld(true);
    for(const wheel of model.wheels) {
      wheel.steering.getWorldPosition(point);
      clear(point.x,point.z,`Tire at route ${state.p}`);
    }
  }
}
console.log(`PASS: ${samples} road-shoulder and real tire positions across 2,001 route poses; actual hill triangles remain below the roadway (maximum ${maximum.toFixed(3)}).`);
