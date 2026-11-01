import * as THREE from './vendor/three.module.js';
import {roadZ,roadSlope} from './route.js';
import {buildParkedFleet, PARKED_RIGS} from './parked-fleet.js';
import {buildI40Landmarks, landmarkClearance} from './i40-landmarks.js';
import {sceneryBatch} from './scenery-batch.js';

const material=(color,roughness=.9)=>new THREE.MeshStandardMaterial({color,roughness});
function terrainHeight(x,z){
  // The coarse hill triangles need a full cell of clearance beyond the shoulder.
  // Otherwise vertices outside the road interpolate a hill through the tires.
  const roadDistance = Math.abs(z-roadZ(x))/Math.hypot(1,roadSlope(x));
  if(roadDistance<17)return -.25;
  if(x>108&&x<201&&z>-68&&z<-34)return -.25;
  const u=(x+35)/285,v=(z+78)/55;
  if(u<=0||u>=1||v<=0||v>=1)return -.25;
  return -.25+Math.sin(Math.PI*u)*Math.sin(Math.PI*v)*Math.max(0,4+2.6*Math.sin(x*.077)+1.7*Math.cos(z*.16));
}
function cube(parent,m,size,position){const o=new THREE.Mesh(new THREE.BoxGeometry(...size),m);o.position.set(...position);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function strip(m,start,end,width,offset=0,y=-.08,steps=240){
  const positions=[],indices=[];
  for(let i=0;i<=steps;i++){
    const x=start+(end-start)*i/steps,z=roadZ(x),slope=roadSlope(x),length=Math.hypot(1,slope);
    for(const side of [-1,1]){const d=offset+side*width/2;positions.push(x-slope*d/length,y,z+d/length);}
    if(i<steps){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,m);mesh.receiveShadow=true;return mesh;
}
function textSign(parent,text,x,z,width=5){
  const c=document.createElement('canvas');c.width=1024;c.height=220;const ctx=c.getContext('2d');
  ctx.fillStyle='#edecdf';ctx.fillRect(0,0,1024,220);ctx.fillStyle='#24483c';ctx.font='600 100px Plex, sans-serif';ctx.textAlign='center';ctx.fillText(text,512,145);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(width,width*220/1024),new THREE.MeshBasicMaterial({map:texture}));sign.rotation.y=Math.PI/2;sign.position.set(x,3.3,z);parent.add(sign);
}
export function buildLandscape(world,m){
  const groundMat=new THREE.MeshBasicMaterial({color:0xf5f3eb,toneMapped:false}),grass=material(0xd9ddc4),grassLight=material(0xe4e5d0),rock=material(0xb2b39e);
  const roadMat=material(0x657068),shoulder=material(0xc3c7b2),paint=material(0xf3efda),orange=material(0xd9864e);
  // Keep the base below the lowest hill vertex: coplanar surfaces flashed cream
  // patches at the receiver as their depth order changed during camera movement.
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(850,600),groundMat);ground.name='atlas-base-ground';ground.rotation.x=-Math.PI/2;ground.position.set(65,-.5,0);ground.receiveShadow=true;world.add(ground);
  const shadows=new THREE.Mesh(new THREE.PlaneGeometry(850,600),new THREE.ShadowMaterial({color:0x586848,opacity:.13}));shadows.rotation.x=-Math.PI/2;shadows.position.set(65,-.244,0);shadows.receiveShadow=true;world.add(shadows);
  world.add(strip(shoulder,-70,240,12.1,0,-.14),strip(roadMat,-70,240,10.2,0,-.1));
  for(const side of [-1,1])world.add(strip(paint,-70,240,.1,side*4.6,-.085));
  const t=new THREE.Object3D(),dashes=new THREE.InstancedMesh(new THREE.BoxGeometry(1.6,.015,.13),paint,76);
  for(let i=0;i<76;i++){const x=-65+i*4;t.position.set(x,-.075,roadZ(x));t.rotation.set(0,-Math.atan(roadSlope(x)),0);t.updateMatrix();dashes.setMatrixAt(i,t.matrix);}world.add(dashes);t.rotation.set(0,0,0);
  const trace=strip(orange,-22,185,.23,4.25,-.067,414);world.add(trace);
  grass.flatShading=true;grassLight.flatShading=true;
  const terrainVertices=[],terrainIndices=[];
  for(let row=0;row<=12;row++)for(let col=0;col<=40;col++){
    const x=-35+285*col/40,z=-78+55*row/12;
    terrainVertices.push(x,terrainHeight(x,z),z);
    if(row<12&&col<40){const n=row*41+col;terrainIndices.push(n,n+41,n+1,n+1,n+41,n+42);}
  }
  const terrainGeometry=new THREE.BufferGeometry();terrainGeometry.setAttribute('position',new THREE.Float32BufferAttribute(terrainVertices,3));terrainGeometry.setIndex(terrainIndices);terrainGeometry.computeVertexNormals();
  const terrain=new THREE.Mesh(terrainGeometry,grass);terrain.name='route-terrain';terrain.receiveShadow=true;world.add(terrain);
  const mountainGeo=new THREE.ConeGeometry(1,1,5);
  for(let i=0;i<11;i++){
    const mountain=new THREE.Mesh(mountainGeo,i%2?grass:grassLight);mountain.position.set(70+i*17,.5,-70-(i%2)*10);mountain.scale.set(18,7+(i%3)*4,15);mountain.receiveShadow=true;world.add(mountain);
  }
  const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.13,.2,1.5,6),m.trunk,168);
  const leaves=new THREE.InstancedMesh(new THREE.ConeGeometry(1.05,3.5,7),new THREE.MeshStandardMaterial({color:0x1c3a27,roughness:.95,flatShading:true}),168);
  const tops=new THREE.InstancedMesh(new THREE.ConeGeometry(.75,2.5,7),material(0x687f4a),168);
  for(let i=0;i<168;i++){
    const x=-60+(i%42)*6.8+(Math.sin(i*8)*2),side=Math.floor(i/42)%2?1:-1;
    let z=roadZ(x)+side*(14+((Math.sin(i*127.1)*43758.5453)%1+1)%1*22),scale=1.15+(i%5)*.18;
    // Keep warehouse footprints and maneuvering aprons clear.
    if(side<0&&((x>-12&&x<76)||(x>114&&x<198)))z=-30-(i%6)*3;
    if(side<0&&x>108&&x<202)z=-76-(i%3)*3;
    if(x<0&&side<0)z=-30-(i%3)*3;
    for(let clearance=0;clearance<4&&landmarkClearance(x,z);clearance++)z+=side*7;
    const elevation=Math.max(0,terrainHeight(x,z));
    t.position.set(x,.65*scale+elevation,z);t.scale.setScalar(scale);t.updateMatrix();trunks.setMatrixAt(i,t.matrix);
    t.position.y=2.6*scale+elevation;t.updateMatrix();leaves.setMatrixAt(i,t.matrix);t.position.y=3.9*scale+elevation;t.updateMatrix();tops.setMatrixAt(i,t.matrix);
  }
  trunks.castShadow=true;leaves.castShadow=true;tops.castShadow=true;world.add(trunks,leaves,tops);t.scale.setScalar(1);
  const stones=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),rock,40);
  for(let i=0;i<40;i++){const x=105+(i%2?1:-1)*(7+(i%3)*1.2),z=i<20?-23-(i%6)*1.6:45+(i%5)*2;t.position.set(x,.35,z);t.rotation.set(i*.4,i*.8,i*.1);t.scale.set(1.2+(i%3)*.7,.7+(i%4)*.4,1+(i%2)*.5);t.updateMatrix();stones.setMatrixAt(i,t.matrix);}stones.castShadow=true;world.add(stones);
  // A shallow river threads through the atlas. The road becomes a bridge above it.
  const water=material(0x9bbdb9,.38),bank=material(0xc9d1ba);
  cube(world,bank,[13,.07,160],[105,-.19,12]);cube(world,water,[8.4,.035,160],[105,-.14,12]);
  for(const side of [-1,1]){
    world.add(strip(m.metal,97,113,.18,side*5.1,.45,22));
    for(let x=97;x<=113;x+=2.5){const slope=roadSlope(x),n=Math.hypot(1,slope);cube(world,m.metal,[.12,.7,.12],[x-slope*side*5.1/n,.2,roadZ(x)+side*5.1/n]);}
  }
  const yard=new THREE.Group();yard.name='carrier-yard';world.add(yard);
  cube(yard,m.hardscape,[57,.1,29],[-26,-.12,-8]);
  cube(yard,m.wall,[8,3.3,6],[-47,1.6,-15]);cube(yard,m.roof,[8.4,.2,6.4],[-47,3.31,-15]);
  cube(yard,m.inside,[.04,1.25,2.1],[-42.96,2,-15]);textSign(yard,'THE YARD',-42.9,-15,4.8);
  buildParkedFleet(yard);
  const yardFurniture=sceneryBatch(yard);
  for(const {x,z} of PARKED_RIGS)yardFurniture.box(0xf3efda,[21,.012,.08],[x-6,-.055,z+2.5]);
  for(let x=-54;x<=-2;x+=3.4)yardFurniture.box(0x6c7d62,[.07,1.8,.07],[x,.85,-23]);
  for(const y of [.45,1.35])yardFurniture.box(0x6c7d62,[54,.035,.035],[-28,y,-23]);
  yardFurniture.finish();
  for(const [x,z] of [[-38,2],[62,0],[100,roadZ(100)+8],[160,-14]]){
    cube(world,m.metal,[.1,5.5,.1],[x,2.7,z]);cube(world,m.metal,[1.8,.08,.09],[x+.85,5.4,z]);cube(world,paint,[.7,.1,.6],[x+1.6,5.32,z]);
  }
  for(const [x,title] of [[70,'TO RECEIVER'],[158,'DELIVERY']]){const z=roadZ(x)-7.5;cube(world,m.metal,[.11,3.5,.11],[x,1.7,z]);textSign(world,title,x+.07,z,4.8);}
  buildI40Landmarks(world);
  function applyState(state){
    const x=state.route<.28?-22+state.route/.28*50.5:state.route<.54?28.5+(state.route-.28)/.26*55.5:84+(state.route-.54)/.46*101;
    trace.geometry.setDrawRange(0,Math.max(0,Math.min(414,Math.floor((x+22)/207*414)))*6);
  }
  return {applyState};
}
