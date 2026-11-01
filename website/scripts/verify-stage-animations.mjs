import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {sampleStage, STAGE_CLIPS} from '../dist/load-lifecycle/stage-motion.js';
import {createProgressModel} from '../dist/load-lifecycle/progress-scene.js';
import {readingProgress, stageScrollTarget} from '../dist/load-lifecycle/progress-state.js';

assert.equal(STAGE_CLIPS.length, 7);
for (const clip of STAGE_CLIPS) assert.ok(clip.duration >= 5 && clip.duration <= 10);
const booked = sampleStage(0, 1), bol = sampleStage(3, 1), delivery = sampleStage(6, 1);
assert.equal(booked.document, 'dispatch');
assert.deepEqual(booked.checks, [1, 1, 1]);
assert.equal(booked.acknowledgement, 1);
assert.ok(sampleStage(0, .65).messageVisible, 'Dispatch must visibly travel to the driver');
assert.ok(sampleStage(1, 1).rigX - sampleStage(1, 0).rigX > 5, 'Dispatch must move the rig forward');
assert.ok(sampleStage(2, 0).rigX - sampleStage(2, 1).rigX > 6, 'Shipper arrival must back the rig in');
assert.equal(sampleStage(2, 1).arrival, 1);
assert.equal(bol.document, 'bol');
assert.deepEqual(bol.pallets, [1, 1, 1]);
assert.deepEqual(bol.checks, [1, 1, 1]);
assert.equal(bol.stamp, 1);
assert.equal(bol.signature, 0);
assert.ok(sampleStage(3, .65).scanning, 'BOL review must include a visible scan');
assert.ok(sampleStage(4, 1).travel > 60, 'Transit must move the road and wheels');
assert.equal(sampleStage(4, 1).waypoints, 1);
assert.equal(sampleStage(5, 1).receiver, true);
assert.equal(sampleStage(5, 1).doors, 1);
assert.equal(delivery.document, 'pod');
assert.deepEqual(delivery.pallets, [1, 1, 1]);
assert.equal(delivery.signature, 1);
assert.equal(delivery.stamp, 1);
assert.equal(delivery.doors, 0);

// Selecting a stage on the concise page must start that stage's animation.
for (const [viewportHeight, headerHeight, stepHeight, firstTop] of [[674, 80, 160, 250], [844, 72, 220, 520], [400, 72, 220, 520], [1080, 80, 160, 250]]) {
  const absolute = Array.from({length: 7}, (_, i) => ({top: firstTop + i * stepHeight, bottom: firstTop + (i + 1) * stepHeight}));
  const maximumScroll = absolute.at(-1).bottom + 128 - viewportHeight;
  for (let index = 0; index < 7; index++) {
    const y = stageScrollTarget({top: absolute[index].top, headerHeight, viewportHeight, maximumScroll});
    const selected = readingProgress({stages: absolute.map(s => ({top: s.top - y, bottom: s.bottom - y})), headerHeight, viewportHeight, atEnd: y >= maximumScroll, scrollFraction: y / maximumScroll});
    assert.equal(selected.active, index, `Stage ${index} should be selected at viewport ${viewportHeight}`);
  }
}

const sizes = [[430, 400], [600, 460], [560, 340], [220, 210], [196, 210], [290, 240], [430, 160]];
const model = createProgressModel();
const tractor = model.content.getObjectByName('original-orange-tractor');
const trailer = model.content.getObjectByName('original-white-reefer');
let poses = 0, projections = 0;
function finite(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (value && typeof value === 'object') Object.values(value).forEach(finite);
}
for (let stage = 0; stage < 7; stage++) {
  for (let frame = 0; frame <= 80; frame++) {
    const progress = frame / 80, state = model.applyFrame(stage, progress);
    finite(state);
    for (const value of [...state.checks, ...state.pallets, state.doors, state.stamp, state.signature]) assert.ok(value >= 0 && value <= 1);
    model.world.updateMatrixWorld(true);
    const cabPosition = tractor.getWorldPosition(new THREE.Vector3());
    const pinPosition = trailer.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(pinPosition.x - cabPosition.x + 2.2) < 1e-8, 'Hitch position must stay attached');
    assert.ok(Math.abs(pinPosition.y - cabPosition.y) < 1e-8);
    if (state.stage === 3 && state.pallets.some(u => u > .02 && u < .98)) assert.equal(state.doors, 1, 'Loading requires open doors');
    poses++;
    if (frame % 4) continue;
    const bounds = new THREE.Box3().setFromObject(model.content);
    for (const [width, height] of sizes) {
      model.fitCamera(width, height);
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const point = new THREE.Vector3(x, y, z).project(model.camera);
        assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && Math.abs(point.z) < 1,
          JSON.stringify({stage, progress, width, height, point}));
      }
      projections++;
    }
  }
}
// Replaying or reversing stages must restore the same deterministic pose.
model.applyFrame(6, 1);
assert.deepEqual(model.applyFrame(0, .4), sampleStage(0, .4));
model.dispose();
console.log(`PASS: seven distinct animation outcomes; ${poses} poses; ${projections} camera frames; attached hitch, door/cargo states, BOL review, signed POD and deterministic replay.`);
