import * as THREE from './vendor/three.module.js';

// One locally drawn, light-reactive decal shared by the trailer and pickup dock.
export function createBrandMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = 1536; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    for (const [x, y, h, color] of [[30, 28, 159, '#1C3A27'], [88, 73, 114, '#D96B43']]) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(x + 54, y); ctx.lineTo(x + 86, y);
      ctx.lineTo(x + 32, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#1C3A27'; ctx.font = '700 144px Arial, sans-serif';
    ctx.fillText('AFTER HOURS', 205, 155);
    ctx.fillStyle = '#59735E'; ctx.font = '34px monospace';
    ctx.fillText('THE ROUTE ATLAS', 215, 217);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  return new THREE.MeshStandardMaterial({
    map, transparent: true, alphaTest: .025, depthWrite: false,
    roughness: .86, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1,
  });
}

export function addBrandDecal(parent, material, {width = 8.4, position, rotation = 0, name = 'after-hours-decal'}) {
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 6), material);
  sign.name = name; sign.position.set(...position); sign.rotation.y = rotation;
  sign.receiveShadow = true; sign.renderOrder = 1; parent.add(sign);
  return sign;
}
