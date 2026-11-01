import * as THREE from './vendor/three.module.js';

function polygon(ctx, color, points) {
  ctx.fillStyle = color; ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath(); ctx.fill();
}
function star(ctx, x, y, radius, color) {
  polygon(ctx, color, Array.from({length: 10}, (_, i) => {
    const angle = -Math.PI / 2 + i * Math.PI / 5, r = radius * (i % 2 ? .4 : 1);
    return [x + Math.cos(angle) * r, y + Math.sin(angle) * r];
  }));
}
function disc(ctx, x, y, radius, color) {
  polygon(ctx, color, Array.from({length: 16}, (_, i) => [x + Math.cos(i * Math.PI / 8) * radius, y + Math.sin(i * Math.PI / 8) * radius]));
}
function california(ctx) {
  ctx.fillStyle = '#F3F0E5'; ctx.fillRect(0, 0, 512, 342);
  ctx.fillStyle = '#AD594C'; ctx.fillRect(0, 285, 512, 57);
  star(ctx, 73, 66, 28, '#AD594C');
  polygon(ctx, '#74875C', [[129,217],[150,208],[202,210],[246,206],[294,210],[356,208],[383,219],[351,225],[168,226]]);
  // A faceted walking grizzly, facing the hoist, above the original flag legend.
  polygon(ctx, '#72523C', [[137,166],[146,149],[163,144],[169,132],[181,134],[191,121],[213,111],[237,116],[259,114],[286,119],[311,134],[327,155],[345,163],[347,178],[337,182],[330,171],[324,184],[327,211],[342,215],[338,221],[314,221],[304,190],[290,180],[275,185],[259,185],[243,179],[218,182],[201,193],[194,215],[203,218],[197,224],[175,224],[178,199],[181,183],[164,179],[148,181],[136,175]]);
  polygon(ctx, '#9B7955', [[177,145],[195,128],[219,120],[234,129],[224,151],[202,163],[179,168],[158,171],[153,162]]);
  polygon(ctx, '#533F30', [[218,181],[216,204],[224,215],[221,220],[204,219],[199,208],[201,193],[207,185]]);
  polygon(ctx, '#533F30', [[288,181],[286,204],[297,216],[294,222],[278,219],[268,192]]);
  ctx.fillStyle = '#3A352A'; ctx.fillRect(138, 166, 8, 5); ctx.fillRect(162, 151, 3, 3);
  ctx.textAlign = 'center'; ctx.font = '700 23px Arial, sans-serif';
  ctx.fillText('CALIFORNIA REPUBLIC', 256, 266);
}
function newYork(ctx) {
  ctx.fillStyle = '#27486C'; ctx.fillRect(0, 0, 512, 256);
  const gold = '#C5AA66', ivory = '#EEE6CE';
  // A miniature rendering of the eagle, globe, Hudson shield, Liberty and Justice.
  polygon(ctx, gold, [[223,31],[236,34],[247,27],[257,31],[265,26],[277,32],[290,29],[280,42],[266,43],[257,49],[245,43],[232,43]]);
  disc(ctx, 256, 61, 19, gold); disc(ctx, 256, 61, 15, '#7DA0A3');
  polygon(ctx, '#77926C', [[246,50],[256,50],[261,58],[254,63],[256,74],[245,67]]);
  polygon(ctx, gold, [[192,92],[320,92],[317,164],[301,184],[256,205],[210,184],[195,163]]);
  polygon(ctx, '#7CA5B0', [[202,101],[310,101],[307,159],[294,177],[256,195],[217,177],[205,158]]);
  disc(ctx, 256, 130, 18, '#DDB169');
  polygon(ctx, '#687D62', [[204,145],[224,128],[243,147],[267,133],[307,151],[306,166],[207,165]]);
  polygon(ctx, '#A8C0B8', [[207,160],[232,153],[256,162],[280,157],[306,164],[293,175],[256,191],[220,175]]);
  polygon(ctx, ivory, [[247,143],[247,164],[229,163]]);
  polygon(ctx, ivory, [[251,146],[263,162],[251,162]]);
  ctx.fillStyle = '#55685D'; ctx.fillRect(248,140,2,31);
  for (const [x, robe] of [[167,'#88A8AE'],[345,ivory]]) {
    disc(ctx, x, 99, 9, ivory);
    polygon(ctx, robe, [[x-7,109],[x+7,109],[x+15,139],[x+11,180],[x+19,205],[x-19,205],[x-11,178],[x-13,138]]);
    polygon(ctx, gold, [[x-7,111],[x+1,111],[x+8,162],[x+4,195],[x-2,182],[x-4,146]]);
  }
  polygon(ctx, '#B66D54', [[151,119],[163,109],[174,114],[164,143],[156,164],[151,150]]);
  ctx.fillStyle = gold; ctx.fillRect(137,91,3,113); ctx.fillRect(365,110,3,76);
  polygon(ctx, '#B66D54', [[130,90],[141,73],[150,88]]);
  ctx.fillStyle = '#7D8274'; ctx.fillRect(337,97,16,3); ctx.fillRect(356,117,32,2); ctx.fillRect(359,119,2,17); ctx.fillRect(382,119,2,17);
  polygon(ctx, gold, [[352,136],[369,136],[361,142]]); polygon(ctx, gold, [[375,136],[391,136],[383,142]]);
  polygon(ctx, ivory, [[145,214],[183,203],[223,212],[288,212],[329,203],[367,214],[364,234],[328,227],[288,246],[224,246],[184,227],[148,234]]);
  ctx.fillStyle = '#425244'; ctx.textAlign = 'center'; ctx.font = '700 12px Arial, sans-serif'; ctx.fillText('EXCELSIOR',256,227);
  ctx.font = '700 6px Arial, sans-serif'; ctx.fillText('E PLURIBUS UNUM',256,239);
}

export function createDockFlag({variant = 'us'} = {}) {
  const root = new THREE.Group();
  root.name = {us:'pickup-dock-american-flag',california:'pickup-dock-california-flag',newYork:'receiver-dock-new-york-flag'}[variant];
  root.userData.flag = variant;
  const poleHeight = variant === 'us' ? 6.9 : 6.45;
  const poleMaterial = new THREE.MeshStandardMaterial({color: 0x899380, roughness: .85});
  const baseMaterial = new THREE.MeshStandardMaterial({color: 0xc7cbb7, roughness: .95});
  function part(geometry, material, y) {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.y = y;
    mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); return mesh;
  }
  part(new THREE.BoxGeometry(.58, .16, .58), baseMaterial, .02);
  part(new THREE.CylinderGeometry(.055, .075, poleHeight, 8), poleMaterial, poleHeight / 2 + .05);
  part(new THREE.IcosahedronGeometry(.105, 0), poleMaterial, poleHeight + .1);

  // A muted, complete flag: thirteen stripes and fifty stars, drawn locally once.
  const canvas = document.createElement('canvas');
  canvas.width = variant === 'us' ? 1024 : 512;
  canvas.height = variant === 'us' ? 540 : variant === 'california' ? 342 : 256;
  const ctx = canvas.getContext('2d');
  if (ctx && variant !== 'us') {
    (variant === 'california' ? california : newYork)(ctx);
  } else if (ctx) {
    const stripeHeight = canvas.height / 13, cantonWidth = canvas.width * .4, cantonHeight = stripeHeight * 7;
    for (let stripe = 0; stripe < 13; stripe++) {
      ctx.fillStyle = stripe % 2 ? '#F1EDE2' : '#AD6C61';
      ctx.fillRect(0, stripe * stripeHeight, canvas.width, stripeHeight + .5);
    }
    ctx.fillStyle = '#455B62'; ctx.fillRect(0, 0, cantonWidth, cantonHeight);
    ctx.fillStyle = '#F1EDE2';
    for (let row = 0; row < 9; row++) {
      const count = row % 2 ? 5 : 6;
      for (let column = 0; column < count; column++) {
        const x = (column + (row % 2 ? 1 : .5)) * cantonWidth / 6, y = (row + 1) * cantonHeight / 10;
        ctx.beginPath();
        for (let point = 0; point < 10; point++) {
          const angle = -Math.PI / 2 + point * Math.PI / 5, radius = point % 2 ? 6.4 : 16.2;
          const px = x + Math.cos(angle) * radius, py = y + Math.sin(angle) * radius;
          if (point) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.closePath(); ctx.fill();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshStandardMaterial({map: texture, roughness: 1, side: THREE.DoubleSide, flatShading: true});
  const width = 3.2, height = width / (variant === 'california' ? 1.5 : variant === 'newYork' ? 2 : 1.9);
  const geometry = new THREE.PlaneGeometry(width, height, 16, 8);
  geometry.translate(width / 2, -height / 2, 0);
  const positions = geometry.getAttribute('position'), rest = positions.array.slice();
  positions.setUsage(THREE.DynamicDrawUsage);
  const cloth = new THREE.Mesh(geometry, material); cloth.name = `muted-${variant}-flag-cloth`;
  cloth.position.set(.065, poleHeight - .12, 0); cloth.castShadow = true; cloth.receiveShadow = true; root.add(cloth);
  // Only the free edge moves; the hoist stays fastened to the short pole.
  let previousTime = -1;
  function update(seconds = 0) {
    if (seconds === previousTime) return; previousTime = seconds;
    for (let i = 0; i < positions.count; i++) {
      const x = rest[i * 3], y = rest[i * 3 + 1], u = x / width, v = -y / height;
      positions.setXYZ(i, x, y - .07 * u * u + .025 * u * u * Math.sin(u * 5 - seconds * 1.3 + v * .4),
        u * (.1 + .14 * Math.sin(u * 5.5 - seconds * 1.3) + .035 * Math.sin(u * 12 - seconds * 1.8 + v * 1.7)));
    }
    positions.needsUpdate = true; geometry.computeVertexNormals();
  }
  update();
  return {root, update};
}
