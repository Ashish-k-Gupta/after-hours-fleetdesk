export const STAGE_CLIPS = [
  {duration: 6.4, action: 'Dispatch prepared and sent to the driver'},
  {duration: 6.0, action: 'Truck departs and a customer update is sent'},
  {duration: 6.8, action: 'Driver backs into the shipper and checks in'},
  {duration: 8.2, action: 'Freight loads, the BOL is scanned and checked'},
  {duration: 7.0, action: 'Truck travels through checkpoints and sends an update'},
  {duration: 6.8, action: 'Driver checks in at the receiver and opens the doors'},
  {duration: 8.6, action: 'Freight unloads, the POD is signed and delivery is confirmed'}
];

export const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const ease = value => {const t = clamp(value); return t * t * (3 - 2 * t);};
const phase = (p, a, b) => clamp((p - a) / (b - a));
const move = (p, a, b) => ease(phase(p, a, b));
const mix = (a, b, t) => a + (b - a) * t;

export function sampleStage(index, progress) {
  const stage = Math.max(0, Math.min(6, Math.round(Number.isFinite(index) ? index : 0)));
  const p = clamp(progress);
  const s = {
    stage, p, rigX: 0, bob: 0, travel: 0, road: false, dock: false, receiver: false,
    doors: 0, reversing: false, pin: 0, arrival: 0, waypoints: 0,
    document: null, paper: 0, checks: [0, 0, 0], scan: 0, scanning: false,
    stamp: 0, signature: 0, message: 0, messageVisible: false, acknowledgement: 0,
    cargo: 'none', pallets: [0, 0, 0]
  };
  if (stage === 0) {
    s.document = 'dispatch'; s.paper = move(p, 0, .18);
    s.checks = [move(p, .16, .28), move(p, .27, .39), move(p, .38, .50)];
    s.message = move(p, .52, .84); s.messageVisible = p >= .50 && p < .88;
    s.acknowledgement = move(p, .84, .98);
  } else if (stage === 1) {
    const u = move(p, .05, .88);
    s.road = true; s.rigX = mix(-2.2, 3.2, u); s.travel = u * 24;
    s.bob = Math.sin(p * Math.PI * 12) * .04 * Math.sin(p * Math.PI);
    s.message = move(p, .60, .92); s.messageVisible = p >= .58 && p < .96;
    s.acknowledgement = move(p, .9, 1);
  } else if (stage === 2 || stage === 5) {
    const u = move(p, .06, .68);
    s.dock = true; s.receiver = stage === 5;
    s.rigX = mix(4.5, -2.2, u); s.travel = -u * 6.7;
    s.reversing = p > .06 && p < .68;
    s.pin = move(p, .38, .64); s.arrival = move(p, .66, .88);
    s.doors = stage === 5 ? move(p, .7, .95) : 0;
    s.cargo = stage === 2 ? 'waiting' : 'none';
  } else if (stage === 3) {
    s.dock = true; s.rigX = -2.2; s.cargo = 'loading';
    s.doors = 1 - move(p, .68, .85);
    s.pallets = [move(p, .04, .25), move(p, .16, .37), move(p, .28, .49)];
    s.document = 'bol'; s.paper = move(p, .32, .48);
    s.scan = move(p, .46, .83); s.scanning = p >= .46 && p < .84;
    s.checks = [move(p, .48, .59), move(p, .60, .71), move(p, .72, .83)];
    s.stamp = move(p, .85, .98);
  } else if (stage === 4) {
    const u = move(p, .02, .98);
    s.road = true; s.travel = u * 72; s.waypoints = u;
    s.bob = Math.sin(p * Math.PI * 20) * .045 * Math.sin(p * Math.PI);
    s.message = move(p, .58, .90); s.messageVisible = p >= .56 && p < .94;
    s.acknowledgement = move(p, .9, 1);
  } else {
    s.dock = true; s.receiver = true; s.rigX = -2.2; s.cargo = 'unloading';
    s.doors = move(p, 0, .12) * (1 - move(p, .86, .99));
    s.pallets = [move(p, .10, .30), move(p, .23, .43), move(p, .36, .56)];
    s.document = 'pod'; s.paper = move(p, .50, .65);
    s.checks = [move(p, .63, .72), move(p, .70, .79), move(p, .82, .92)];
    s.signature = move(p, .72, .88); s.stamp = move(p, .88, 1);
  }
  return s;
}
