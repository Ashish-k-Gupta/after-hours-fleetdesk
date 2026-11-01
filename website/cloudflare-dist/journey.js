import {roadFrame} from "./route.js";
export const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
export const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const mix = (a,b,t) => a+(b-a)*t;
const segment = (p,start,end) => clamp((p-start)/(end-start));
export const ANCHORS = [0,0.16,0.46,0.68,0.94];
export const PHASES = ["THE CARRIER YARD","AT THE SHIPPER","ON THE ROAD","AT THE RECEIVER","DELIVERED"];

function laneChange(frame, x0, x1, z0, z1, t) {
  frame.x = mix(x0,x1,t); frame.z = mix(z0,z1,smooth(t));
  const dz=(z1-z0)*6*t*(1-t);
  frame.heading=-Math.atan2(dz,x1-x0);
  frame.trailerHeading=frame.heading*0.9;
}

export function journeyAt(progress) {
  const p=clamp(progress);
  const state={ p, x:-22, z:8, heading:0, trailerHeading:0, phase:0, status:"Truck and reefer ready.", route:0, loadProgress:0, unloadProgress:0, cargo:0, doorOpen:0, bol:false, pod:false, reversing:false, transfer:null, location:"yard" };
  if (p < .16) {
    const u=segment(p,0,.16); state.x=mix(-22,46,smooth(u)); state.route=.26*smooth(u);
    const road=roadFrame(state.x);state.z=road.z;state.heading=road.heading;state.trailerHeading=state.heading*.9;
    state.status=p<.025?"Truck and reefer ready.":"Empty reefer. Heading to the shipper.";
  } else if (p < .24) {
    state.phase=1; laneChange(state,46,65,8,-6,segment(p,.16,.24)); state.route=.26;
    state.status="Arriving at the shipper."; state.location="shipper";
  } else if (p < .31) {
    state.phase=1; state.x=mix(65,28.5,smooth(segment(p,.24,.31))); state.z=-6; state.route=mix(.26,.28,segment(p,.24,.31)); state.reversing=true;
    state.status="Backing into the pickup dock."; state.location="shipper";
  } else if (p < .46) {
    state.phase=1; state.x=28.5; state.z=-6; state.route=.28; state.location="shipper";
    state.loadProgress=segment(p,.31,.42); state.bol=p>=.435;
    state.status=p<.42?"At the shipper. Loading the reefer.":p<.435?"Loaded. Confirming pickup details.":"Pickup confirmed. Ready to leave.";
    state.transfer=p<.42?"loading":null;
  } else if (p < .51) {
    state.phase=2; state.x=mix(28.5,65,smooth(segment(p,.46,.51))); state.z=-6;
    state.route=mix(.28,.42,segment(p,.46,.51)); state.loadProgress=1; state.bol=true;
    state.status="Loaded. Leaving the shipper."; state.location="road";
  } else if (p < .57) {
    state.phase=2; laneChange(state,65,84,-6,8,segment(p,.51,.57)); state.route=mix(.42,.54,segment(p,.51,.57));
    state.loadProgress=1; state.bol=true; state.status="On the road. Keeping the updates moving."; state.location="road";
  } else if (p < .68) {
    state.phase=2; state.x=mix(84,166,smooth(segment(p,.57,.68)));
    const road=roadFrame(state.x);state.z=road.z;state.heading=road.heading;state.trailerHeading=state.heading*.9;
    state.route=mix(.54,.92,segment(p,.57,.68)); state.loadProgress=1; state.bol=true;
    state.status="In transit. Heading to the receiver."; state.location="road";
  } else if (p < .75) {
    state.phase=3; laneChange(state,166,185,-34,-48,segment(p,.68,.75)); state.route=.92; state.loadProgress=1; state.bol=true;
    state.status="Arriving at the receiver."; state.location="receiver";
  } else if (p < .82) {
    state.phase=3; state.x=mix(185,148.5,smooth(segment(p,.75,.82))); state.z=-48;
    state.route=mix(.92,1,segment(p,.75,.82)); state.loadProgress=1; state.bol=true; state.reversing=true;
    state.status="Backing into the delivery dock."; state.location="receiver";
  } else {
    state.phase=p<.94?3:4; state.x=148.5; state.z=-48; state.route=1; state.loadProgress=1; state.bol=true;
    state.unloadProgress=segment(p,.82,.93); state.pod=p>=.97; state.location="receiver";
    state.transfer=p<.93?"unloading":null;
    state.status=p<.93?"At the receiver. Unloading the freight.":p<.97?"Freight delivered. Confirming the paperwork.":"Delivered. Proof of delivery received.";
  }
  const pickupDoors=smooth(segment(p,.22,.245))*(1-smooth(segment(p,.425,.45)));
  const receiverDoors=smooth(segment(p,.73,.75))*(1-smooth(segment(p,.93,.95)));
  state.doorOpen=Math.max(pickupDoors,receiverDoors);
  state.cargo=Math.max(0,Math.min(6,Math.floor(state.loadProgress*6+1e-8)-Math.floor(state.unloadProgress*6+1e-8)));
  state.pinX=state.x-2.2*Math.cos(state.heading);
  state.pinZ=state.z+2.2*Math.sin(state.heading);
  return state;
}
