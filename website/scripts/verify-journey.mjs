import assert from "node:assert/strict";
import {journeyAt} from "../dist/journey.js";
import * as THREE from "../dist/vendor/three.module.js";
import {makeMaterials,buildTractor,buildReefer} from "../dist/rig-models.js";
const m=makeMaterials(),truck=buildTractor(m),trailer=buildReefer(m);
const cabBox=new THREE.Box3().setFromObject(truck.cab),bodyBox=new THREE.Box3().setFromObject(trailer.body),reeferBox=new THREE.Box3().setFromObject(trailer.reefer);
function rectangle(box,x,z,angle) {
  return [[box.min.x,box.min.z],[box.max.x,box.min.z],[box.max.x,box.max.z],[box.min.x,box.max.z]].map(([u,v])=>[x+u*Math.cos(angle)+v*Math.sin(angle),z-u*Math.sin(angle)+v*Math.cos(angle)]);
}
function intersects(a,b) {
  for(const polygon of [a,b])for(let i=0;i<4;i++) {
    const q=polygon[i],r=polygon[(i+1)%4],axis=[-(r[1]-q[1]),r[0]-q[0]];
    const aa=a.map(p=>p[0]*axis[0]+p[1]*axis[1]),bb=b.map(p=>p[0]*axis[0]+p[1]*axis[1]);
    if(Math.max(...aa)<Math.min(...bb)||Math.max(...bb)<Math.min(...aa))return false;
  }
  return true;
}
let previousRoute=0,previousPhase=0;
for(let i=0;i<=2000;i++) {
  const state=journeyAt(i/2000);
  for(const key of ["x","z","heading","trailerHeading","pinX","pinZ","route","cargo","doorOpen"])assert.ok(Number.isFinite(state[key]),key);
  assert.ok(state.route>=previousRoute-1e-9);previousRoute=state.route;
  assert.ok(state.phase>=previousPhase);previousPhase=state.phase;
  assert.ok(Number.isInteger(state.cargo)&&state.cargo>=0&&state.cargo<=6);
  assert.ok(state.doorOpen>=0&&state.doorOpen<=1);
  assert.ok(Math.abs(state.pinX-(state.x-2.2*Math.cos(state.heading)))<1e-8);
  assert.ok(Math.abs(state.pinZ-(state.z+2.2*Math.sin(state.heading)))<1e-8);
  const cab=rectangle(cabBox,state.x,state.z,state.heading);
  assert.ok(!intersects(cab,rectangle(bodyBox,state.pinX,state.pinZ,state.trailerHeading)),`Cab/body collision at ${state.p}`);
  assert.ok(!intersects(cab,rectangle(reeferBox,state.pinX,state.pinZ,state.trailerHeading)),`Cab/reefer collision at ${state.p}`);
}
for(const point of [.16,.24,.31,.46,.51,.57,.68,.75,.82,.94]) {
  const a=journeyAt(point-1e-7),b=journeyAt(point);
  assert.ok(Math.abs(a.x-b.x)<.001,`X jump at ${point}`);
  assert.ok(Math.abs(a.z-b.z)<.001,`Z jump at ${point}`);
  assert.ok(Math.abs(a.heading-b.heading)<.001,`Heading jump at ${point}`);
  assert.ok(Math.abs(a.route-b.route)<.001,`Route jump at ${point}`);
}
assert.equal(journeyAt(0).cargo,0);assert.equal(journeyAt(.44).cargo,6);assert.equal(journeyAt(.6).cargo,6);assert.equal(journeyAt(.94).cargo,0);
assert.equal(journeyAt(.44).bol,true);assert.equal(journeyAt(.9).pod,false);assert.equal(journeyAt(1).pod,true);
assert.equal(journeyAt(1).phase,4);assert.equal(journeyAt(-1).p,0);assert.equal(journeyAt(2).p,1);
assert.equal(trailer.doors.length,2);
console.log("PASS: 2,001 journey samples; continuous motion; forward route progress; exact hitch positions; cab/trailer clearance; loading, unloading, BOL, POD, and opening doors verified.");
