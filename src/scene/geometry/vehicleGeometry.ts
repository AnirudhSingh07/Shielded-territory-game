import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Low-poly but believably-proportioned armour: a main battle tank and a
 * towed artillery piece, each as a single merged BufferGeometry for
 * InstancedMesh. Same team-palette-not-neon approach as the soldiers —
 * Shielded armour in olive drab, Transparent armour in muted khaki/tan with
 * dark maroon detailing.
 *
 * Local orientation matches Army.tsx: built facing +X then rotated to face
 * -X so the gun points at the enemy. Tracks sit at y = 0.
 */

interface Palette {
  hull: THREE.Color;
  detail: THREE.Color;
  track: THREE.Color;
  metal: THREE.Color;
}

const PALETTES: Record<'shield' | 'transparent', Palette> = {
  shield: { hull: new THREE.Color('#464f31'), detail: new THREE.Color('#333c29'), track: new THREE.Color('#1c1b18'), metal: new THREE.Color('#2a2c30') },
  transparent: { hull: new THREE.Color('#7d6f50'), detail: new THREE.Color('#512727'), track: new THREE.Color('#1c1a17'), metal: new THREE.Color('#2a2c30') },
};

function painted(geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.Color): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return painted(g, color);
}

function cyl(r: number, h: number, x: number, y: number, z: number, color: THREE.Color, rot?: [number, number, number]): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, h, 9);
  if (rot) {
    g.rotateX(rot[0]);
    g.rotateY(rot[1]);
    g.rotateZ(rot[2]);
  }
  g.translate(x, y, z);
  return painted(g, color);
}

const tankCache = new Map<string, THREE.BufferGeometry>();
const artyCache = new Map<string, THREE.BufferGeometry>();

export function getTankGeometry(team: 'shield' | 'transparent'): THREE.BufferGeometry {
  const hit = tankCache.get(team);
  if (hit) return hit;
  const p = PALETTES[team];
  const parts: THREE.BufferGeometry[] = [];

  // tracks
  for (const side of [-1, 1]) {
    parts.push(box(3.4, 0.5, 0.55, 0, 0.28, side * 0.95, p.track));
    for (let i = -2; i <= 2; i++) parts.push(cyl(0.28, 0.58, i * 0.62, 0.3, side * 0.95, p.detail, [Math.PI / 2, 0, 0]));
  }
  // lower hull
  parts.push(box(3.3, 0.5, 1.5, 0, 0.72, 0, p.hull));
  // sloped upper hull (front glacis suggested by a shifted box)
  parts.push(box(3.0, 0.42, 1.7, 0, 1.05, 0, p.hull));
  parts.push(box(0.9, 0.3, 1.7, 1.45, 0.92, 0, p.detail)); // front slope block
  // turret
  parts.push(box(1.5, 0.5, 1.4, -0.1, 1.42, 0, p.hull));
  parts.push(cyl(0.16, 0.28, -0.1, 1.72, 0, p.detail)); // commander cupola
  // main gun
  parts.push(box(2.2, 0.14, 0.14, 1.5, 1.44, 0, p.metal));
  parts.push(box(0.4, 0.22, 0.3, 0.5, 1.44, 0, p.detail)); // mantlet

  const merged = mergeGeometries(parts, false);
  merged.rotateY(Math.PI);
  merged.computeVertexNormals();
  tankCache.set(team, merged);
  return merged;
}

export function getArtilleryGeometry(team: 'shield' | 'transparent'): THREE.BufferGeometry {
  const hit = artyCache.get(team);
  if (hit) return hit;
  const p = PALETTES[team];
  const parts: THREE.BufferGeometry[] = [];

  // wheels
  for (const side of [-1, 1]) parts.push(cyl(0.42, 0.22, -0.2, 0.42, side * 0.7, p.track, [Math.PI / 2, 0, 0]));
  // trail legs splayed back
  for (const side of [-1, 1]) parts.push(box(1.7, 0.12, 0.14, -0.9, 0.3, side * 0.5, p.detail));
  // cradle
  parts.push(box(0.7, 0.4, 0.8, 0.1, 0.62, 0, p.hull));
  // long barrel angled slightly up, pointing forward (+X)
  const barrel = new THREE.CylinderGeometry(0.1, 0.12, 2.6, 9);
  barrel.rotateZ(-Math.PI / 2 - 0.14);
  barrel.translate(1.2, 0.95, 0);
  parts.push(painted(barrel, p.metal));
  parts.push(box(0.3, 0.3, 0.5, 0.2, 0.78, 0, p.detail)); // breech + shield
  parts.push(box(0.12, 0.7, 0.9, 0.55, 0.85, 0, p.hull)); // gun shield

  const merged = mergeGeometries(parts, false);
  merged.rotateY(Math.PI);
  merged.computeVertexNormals();
  artyCache.set(team, merged);
  return merged;
}
