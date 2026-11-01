import * as THREE from './vendor/three.module.js';

// Static scenery shares primitive geometry and batches by material, not by vehicle.
export function sceneryBatch(parent) {
  const geometries = new Map(), materials = new Map(), parts = new Map();
  const transform = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
  const start = new THREE.Vector3(), end = new THREE.Vector3(), direction = new THREE.Vector3();
  function add(kind, color, position, scale, rotation = [0, 0, 0], basis) {
    const key = kind + ':' + color;
    if (!parts.has(key)) parts.set(key, {kind, color, matrices: []});
    transform.position.set(...position); transform.scale.set(...scale);
    if (rotation.isQuaternion) transform.quaternion.copy(rotation); else transform.rotation.set(...rotation);
    transform.updateMatrix();
    const matrix = transform.matrix.clone(); if (basis) matrix.premultiply(basis);
    parts.get(key).matrices.push(matrix);
  }
  return {
    box(color, size, position, rotation, basis) {add('box', color, position, size, rotation, basis);},
    cylinder(color, radius, height, position, rotation, basis) {add('cylinder', color, position, [radius, height, radius], rotation, basis);},
    cone(color, radius, height, position, rotation, basis) {add('cone', color, position, [radius, height, radius], rotation, basis);},
    rod(color, a, b, radius = .06) {
      start.set(...a); end.set(...b); direction.copy(end).sub(start);
      const length = direction.length();
      const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction.normalize());
      add('cylinder', color, start.add(end).multiplyScalar(.5).toArray(), [radius, length, radius], quaternion);
    },
    finish() {
      for (const {kind, color, matrices} of parts.values()) {
        if (!geometries.has(kind)) geometries.set(kind, kind === 'box' ? new THREE.BoxGeometry(1, 1, 1) : kind === 'cone' ? new THREE.ConeGeometry(1, 1, 8) : new THREE.CylinderGeometry(1, 1, 1, 10));
        if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({color, roughness: .88, flatShading: true}));
        const mesh = new THREE.InstancedMesh(geometries.get(kind), materials.get(color), matrices.length);
        matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
        mesh.name = 'static-' + kind + '-' + color.toString(16);
        mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
      }
      parent.userData.staticBatches = parts.size;
    },
  };
}

export function sceneryLabel(parent, title, subtitle, position, width = 8) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#F5F3EB'; ctx.fillRect(0, 0, 512, 128);
    ctx.textAlign = 'center'; ctx.fillStyle = '#1C3A27'; ctx.font = '600 40px Arial, sans-serif'; ctx.fillText(title, 256, 56);
    ctx.fillStyle = '#8d573e'; ctx.font = '17px monospace'; ctx.fillText(subtitle, 256, 95);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshBasicMaterial({map: texture}));
  sign.position.set(...position); parent.add(sign); return sign;
}
