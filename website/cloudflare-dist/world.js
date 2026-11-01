import * as THREE from "./vendor/three.module.js";
import { clamp, smooth } from "./journey.js";
import {buildLandscape} from "./landscape.js";
import {addBrandDecal} from './branding.js';
import {createDockFlag} from './dock-flag.js';

const surface = (color, roughness=.85) => new THREE.MeshStandardMaterial({color,roughness});
function box(parent,material,size,position) {
  const part=new THREE.Mesh(new THREE.BoxGeometry(...size),material);
  part.position.set(...position); part.castShadow=true; part.receiveShadow=true; parent.add(part); return part;
}
function cylinder(parent,material,r,h,position,axis="y",segments=12) {
  const part=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),material);
  part.position.set(...position); if(axis==="z")part.rotation.x=Math.PI/2;
  part.castShadow=true; part.receiveShadow=true; parent.add(part); return part;
}
function label(parent,text,sub,x,y,z,width=4.5) {
  const canvas=document.createElement("canvas"); canvas.width=1024;canvas.height=220;
  const context=canvas.getContext("2d"); if(!context)return;
  context.fillStyle="#e9eedb";context.fillRect(0,0,1024,220);
  context.fillStyle="#345843";context.font="600 100px Plex, sans-serif";context.textAlign="center";context.fillText(text,512,113);
  context.font="27px monospace";context.fillStyle="#7b916b";context.fillText(sub,512,178);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(width,width*220/1024),new THREE.MeshBasicMaterial({map:texture}));
  sign.position.set(x,y,z);sign.rotation.y=Math.PI/2;parent.add(sign);return sign;
}
export function pallet(materials) {
  const root=new THREE.Group();
  const matrix = new THREE.Object3D();
  const pairs = [-.25,.25].flatMap(z => [-.25,.25].map(x => [x,.68,z]));
  for (const [material, size, positions] of [
    [materials.wood,[1.05,.12,.1],[-.39,0,.39].map(z => [0,.09,z])],
    [materials.wood,[.16,.06,1],Array.from({length:5},(_,i) => [-.4+i*.2,.18,0])],
    [materials.crate,[.48,.92,.48],pairs], [materials.tape,[.045,.93,.49],pairs],
  ]) {
    const pieces = new THREE.InstancedMesh(new THREE.BoxGeometry(...size), material, positions.length);
    positions.forEach((position,index) => {matrix.position.set(...position);matrix.updateMatrix();pieces.setMatrixAt(index,matrix.matrix);});
    pieces.castShadow = true; pieces.receiveShadow = true; root.add(pieces);
  }
  return root;
}
function forklift(materials) {
  const root=new THREE.Group();
  box(root,materials.machine,[1.25,.64,.93],[.2,.51,0]);
  box(root,materials.machine,[.42,.78,.93],[.86,.58,0]);
  for(const x of [-.3,.75])for(const z of [-.49,.49])cylinder(root,materials.rubber,.23,.16,[x,.23,z],"z");
  for(const z of [-.4,.4]) {
    box(root,materials.metal,[.06,1.65,.06],[-.39,1.3,z]);
    box(root,materials.metal,[.06,1.3,.06],[.64,1.46,z]);
    box(root,materials.metal,[.08,2.0,.07],[-.58,1.16,z]);
    box(root,materials.metal,[1.1,.05,.07],[-1.06,.22,z]);
  }
  box(root,materials.machine,[1.34,.09,1.1],[.15,2.12,0]);
  box(root,materials.rubber,[.4,.18,.5],[.26,1.0,0]);
  box(root,materials.rubber,[.14,.58,.5],[.5,1.19,0]);
  return root;
}
function station(world,m,wallX,type,brandMaterial) {
  const root=new THREE.Group();world.add(root);
  const centerX=wallX-9,centerZ=-6;
  const wall=type==="SHIPPER"?m.wall:m.receiverWall;
  box(root,m.hardscape,[62,.12,23],[wallX+25,-.11,-10]);
  box(root,m.floor,[18.4,1.22,14.4],[centerX,.55,centerZ]);
  box(root,wall,[.18,5.8,14],[wallX-18,3.9,centerZ]);
  for(const z of [-13,1])box(root,wall,[18,5.8,.18],[centerX,3.9,z]);
  for(const z of [-10.4,-1.6])box(root,wall,[.18,5.8,5.2],[wallX,3.9,z]);
  box(root,wall,[.18,2.2,3.6],[wallX,5.7,centerZ]);
  box(root,m.roof,[18.7,.25,14.7],[centerX,6.94,centerZ]);
  const roofRibs=new THREE.InstancedMesh(new THREE.BoxGeometry(.05,.035,14.6),m.roofRib,24);
  const tmp=new THREE.Object3D();
  for(let i=0;i<24;i++){tmp.position.set(wallX-18.1+i*.77,7.09,centerZ);tmp.updateMatrix();roofRibs.setMatrixAt(i,tmp.matrix);}
  root.add(roofRibs);
  for(const x of [wallX-14,wallX-6])for(const z of [-10,-2]){box(root,m.metal,[1.2,.55,1.2],[x,7.35,z]);box(root,m.roof,[1.4,.12,1.4],[x,7.68,z]);}
  for(const z of [-7.85,-4.15])box(root,m.doorFrame,[.26,3.9,.23],[wallX+.09,3.11,z]);
  box(root,m.doorFrame,[.26,.22,3.9],[wallX+.09,5.13,centerZ]);
  box(root,m.inside,[.1,3.55,3.4],[wallX-3.5,3.05,centerZ]);
  box(root,m.dock,[.42,.26,3.6],[wallX+.12,1.16,centerZ]);
  for(const z of [-7.7,-4.3])box(root,m.rubber,[.18,.6,.27],[wallX+.25,1.17,z]);
  if (type === 'SHIPPER' && brandMaterial) {
    addBrandDecal(root, brandMaterial, {width: 5.8, position: [wallX + .205, 5.91, centerZ], rotation: Math.PI / 2, name: 'pickup-dock-brand'});
  } else label(root,type,"DELIVERY / BAY 01",wallX+.2,5.91,centerZ,5.6);
  const shutter = box(root, m.doorFrame, [.14, 3.55, 3.4], [wallX + .04, 3.05, centerZ]);
  shutter.name = `${type.toLowerCase()}-dock-shutter`;
  const roofLabel=label(root,type,"",centerX,7.12,centerZ,7.2);if(roofLabel)roofLabel.rotation.set(-Math.PI/2,0,0);
  const backLabel=label(root,type,"",wallX-18.12,5.65,centerZ,7.3);if(backLabel)backLabel.rotation.y=-Math.PI/2;
  for(const z of [-11,-1]){
    box(root,m.doorFrame,[.12,3.6,3.0],[wallX+.13,2.95,z]);
    for(let row=0;row<12;row++)box(root,m.roofRib,[.14,.035,2.9],[wallX+.21,1.3+row*.29,z]);
  }
  // Parking guides lead back to the dock. No invented customer branding is used.
  for(const z of [-8,-4])box(root,m.paint,[22,.008,.09],[wallX+11,-.04,z]);
  for(const x of [wallX+3,wallX+13])for(const z of [-9,-3]) {
    box(root,m.bollard,[.17,.75,.17],[x,.34,z]);
    box(root,m.reflective,[.18,.12,.18],[x,.62,z]);
  }
  const pallets=[];
  for(let i=0;i<6;i++) {
    const cargo=pallet(m);root.add(cargo);
    pallets.push({root:cargo,start:new THREE.Vector3(wallX+6+(i%2)*1.45,0,1.0+Math.floor(i/2)*1.45)});
  }
  const lift=forklift(m);root.add(lift);
  return {root,pallets,lift,wallX,type,shutter};
}

export function buildWorld(world, {brandMaterial} = {}) {
  const m={
    ground:surface(0xf5f3eb),hardscape:surface(0xd9dbcb),floor:surface(0xc7cbb7),
    wall:surface(0xe9e7d9),receiverWall:surface(0xdddccf),roof:surface(0xcbcdb9),roofRib:surface(0xe0e0cf),
    doorFrame:surface(0x617e56),inside:surface(0x61745b),dock:surface(0x9dac8e),rubber:surface(0x344a3c),
    paint:surface(0xf2f2df),bollard:surface(0xce9462),reflective:surface(0xf6edce),
    wood:surface(0xb59c72),crate:surface(0xbcca9f),tape:surface(0xe4e3c4),machine:surface(0xd28a55),metal:surface(0x6c7d62),
    road:surface(0x8c9d87),line:surface(0xe9e8d2),tree:surface(0x8da97a),treeLight:surface(0xa8bd91),trunk:surface(0x9c9276),field:surface(0xdce4ce)
  };
  const landscape=buildLandscape(world,m);
  const shipper=station(world,m,12,"SHIPPER",brandMaterial),receiver=station(world,m,132,"RECEIVER");
  receiver.root.position.z=-42;
  const flag = createDockFlag();
  flag.root.position.set(shipper.wallX + 3.6, 0, -15.5); world.add(flag.root);
  const californiaFlag = createDockFlag({variant:'california'});
  californiaFlag.root.position.set(shipper.wallX + 9.1, 0, -15.5); shipper.root.add(californiaFlag.root);
  const newYorkFlag = createDockFlag({variant:'newYork'});
  newYorkFlag.root.position.set(receiver.wallX + 4.2, 0, -15.5); receiver.root.add(newYorkFlag.root);

  function transfer(stationModel,amount,loading) {
    const {pallets,lift,wallX}=stationModel;
    let active=null;
    for(let i=0;i<pallets.length;i++) {
      const item=pallets[i],u=clamp(amount*6-i);
      item.root.visible=loading?u<.96:u>.03;
      item.root.rotation.y=0;item.root.scale.setScalar(1);
      const end=new THREE.Vector3(wallX+.7,1.25,-6);
      const path=loading?smooth(u):1-smooth(u);
      item.root.position.copy(item.start).lerp(end,path);
      if(u>0&&u<1)active={position:item.root.position,u};
    }
    lift.visible=!!active&&active.u<.82&&active.u>.08;
    if(active) {
      lift.position.copy(active.position);lift.position.x+=1.55;lift.position.y=0;
      lift.rotation.y=loading?-.25:.25;
    }
  }
  function applyState(state) {
    landscape.applyState(state);
    transfer(shipper,state.loadProgress,true);transfer(receiver,state.unloadProgress,false);
    if(state.location!=="shipper")shipper.lift.visible=false;
    if(state.location!=="receiver")receiver.lift.visible=false;
    for (const model of [shipper, receiver]) {
      const open = state.location === (model === shipper ? 'shipper' : 'receiver') ? state.doorOpen : 0;
      model.shutter.scale.y = 1 - open * .96;
      model.shutter.position.y = 4.825 - 1.775 * model.shutter.scale.y;
    }
  }
  return {applyState, animateFlag(seconds, phase) {
    flag.update(phase === 1 ? seconds : 0);
    californiaFlag.update(phase === 1 ? seconds : 0);
    newYorkFlag.update(phase >= 3 ? seconds : 0);
  }};
}
