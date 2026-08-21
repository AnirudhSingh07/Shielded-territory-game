import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Builds one small, low-poly "cute zebra" as a single merged BufferGeometry
 * so it can be fed straight into an InstancedMesh (hundreds of units, one
 * draw call) instead of a hierarchy of separate meshes per unit.
 *
 * Stripes/eyes/mane are baked in as vertex colors (near-black); the body is
 * near-white. Army.tsx tints each instance green or red via setColorAt,
 * which *multiplies* the vertex color — so white areas take the full team
 * color while the dark stripes stay dark on both sides. Computed once and
 * cached; both armies share the same geometry.
 */

const WHITE = new THREE.Color('#f4f6f5');
const DARK = new THREE.Color('#101214');

function paint(geometry: THREE.BufferGeometry, fn: (x: number, y: number, z: number) => THREE.Color) {
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = fn(pos.getX(i), pos.getY(i), pos.getZ(i));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

const solid = (geometry: THREE.BufferGeometry, color: THREE.Color) => paint(geometry, () => color);

/** Stripes banded along the local Y axis (before the part gets laid on its side / repositioned). */
const stripedAlongY = (geometry: THREE.BufferGeometry, freq: number) =>
  paint(geometry, (_x, y) => (Math.sin(y * freq) > 0.15 ? DARK : WHITE));

let cached: THREE.BufferGeometry | null = null;

export function getZebraGeometry(): THREE.BufferGeometry {
  if (cached) return cached;

  const parts: THREE.BufferGeometry[] = [];

  // Body: a capsule, striped along its own (pre-rotation) length axis, then
  // laid on its side along +X and lifted to stand on four legs.
  const legLength = 0.34;
  const bodyRadius = 0.27;
  const bodyY = legLength + bodyRadius * 0.85;
  const body = new THREE.CapsuleGeometry(bodyRadius, 0.5, 4, 10);
  stripedAlongY(body, 15);
  body.rotateZ(Math.PI / 2);
  body.translate(0, bodyY, 0);
  parts.push(body);

  // Head: a slightly squashed sphere for a chibi/foal proportion.
  const head = new THREE.SphereGeometry(0.24, 10, 8);
  solid(head, WHITE);
  head.scale(0.92, 0.98, 0.86);
  head.translate(0.62, bodyY + 0.16, 0);
  parts.push(head);

  // Muzzle
  const muzzle = new THREE.CylinderGeometry(0.085, 0.13, 0.22, 8);
  solid(muzzle, WHITE);
  muzzle.rotateZ(Math.PI / 2);
  muzzle.translate(0.9, bodyY + 0.06, 0);
  parts.push(muzzle);

  // Ears (two small cones, splayed outward)
  for (const side of [1, -1]) {
    const ear = new THREE.ConeGeometry(0.075, 0.19, 6);
    solid(ear, DARK);
    ear.rotateX((side * Math.PI) / 7);
    ear.rotateZ(-Math.PI / 10);
    ear.translate(0.56, bodyY + 0.38, side * 0.1);
    parts.push(ear);
  }

  // Eyes (tiny dark spheres)
  for (const side of [1, -1]) {
    const eye = new THREE.SphereGeometry(0.035, 6, 6);
    solid(eye, DARK);
    eye.translate(0.78, bodyY + 0.2, side * 0.18);
    parts.push(eye);
  }

  // Mane: a thin dark strip along the back of the neck/spine.
  const mane = new THREE.BoxGeometry(0.42, 0.11, 0.05);
  solid(mane, DARK);
  mane.translate(0.3, bodyY + 0.29, 0);
  parts.push(mane);

  // Legs (four thin cylinders)
  const legPositions: Array<[number, number]> = [
    [0.32, 0.16],
    [0.32, -0.16],
    [-0.32, 0.16],
    [-0.32, -0.16],
  ];
  for (const [lx, lz] of legPositions) {
    const leg = new THREE.CylinderGeometry(0.05, 0.065, legLength, 6);
    solid(leg, WHITE);
    leg.translate(lx, legLength / 2, lz);
    parts.push(leg);
  }

  // Tail
  const tail = new THREE.CylinderGeometry(0.018, 0.05, 0.34, 6);
  solid(tail, DARK);
  tail.rotateZ(Math.PI / 2.6);
  tail.translate(-0.66, bodyY + 0.08, 0);
  parts.push(tail);

  const merged = mergeGeometries(parts, false);

  // Center on X/Z only — Y stays anchored with the feet at 0 so it sits
  // correctly on the ground plane once placed by Army.tsx.
  merged.computeBoundingBox();
  const box = merged.boundingBox!;
  const centerX = (box.min.x + box.max.x) / 2;
  const centerZ = (box.min.z + box.max.z) / 2;
  merged.translate(-centerX, 0, -centerZ);
  merged.rotateY(Math.PI); // face the merged shape toward -X so "forward" matches Army.tsx's dir convention
  merged.computeVertexNormals();
  cached = merged;
  return merged;
}
