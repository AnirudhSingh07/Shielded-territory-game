import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * A realistic-proportioned low-poly infantry soldier built as a single
 * merged BufferGeometry for InstancedMesh (one draw call for a whole army).
 *
 * Team identity is carried by the *palette*, not a neon tint: the Shielded
 * army wears olive-drab greens, the Transparent army muted khaki/tan with a
 * dark maroon-red helmet and vest. Colors are baked into vertex colors, so
 * the instanced material is a plain PBR meshStandardMaterial with
 * vertexColors — no per-instance recoloring, nothing glowing.
 *
 * Local orientation: built facing +X, then rotated to face -X so it matches
 * Army.tsx's existing "forward" convention (rifle points at the enemy).
 * Feet sit at y = 0. Overall height ≈ 1.65 world units.
 */

interface Palette {
  uniform: THREE.Color;
  gear: THREE.Color; // helmet, vest, webbing
  boots: THREE.Color;
  skin: THREE.Color;
  metal: THREE.Color; // rifle
}

const SHARED_METAL = new THREE.Color('#26282c');
const SHARED_SKIN = new THREE.Color('#a97a55');

const PALETTES: Record<'shield' | 'transparent', Palette> = {
  shield: {
    uniform: new THREE.Color('#4c5535'), // olive drab
    gear: new THREE.Color('#38442f'), // dark green-grey
    boots: new THREE.Color('#22201c'),
    skin: SHARED_SKIN,
    metal: SHARED_METAL,
  },
  transparent: {
    uniform: new THREE.Color('#8a7a58'), // khaki tan
    gear: new THREE.Color('#5a2a2a'), // muted maroon-red
    boots: new THREE.Color('#241f1c'),
    skin: SHARED_SKIN,
    metal: SHARED_METAL,
  },
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

function box(w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.Color, rot?: [number, number, number]): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rot) {
    g.rotateX(rot[0]);
    g.rotateY(rot[1]);
    g.rotateZ(rot[2]);
  }
  g.translate(x, y, z);
  return painted(g, color);
}

function cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, color: THREE.Color, rot?: [number, number, number]): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rt, rb, h, 7);
  if (rot) {
    g.rotateX(rot[0]);
    g.rotateY(rot[1]);
    g.rotateZ(rot[2]);
  }
  g.translate(x, y, z);
  return painted(g, color);
}

const cache = new Map<string, THREE.BufferGeometry>();

export function getSoldierGeometry(team: 'shield' | 'transparent'): THREE.BufferGeometry {
  const hit = cache.get(team);
  if (hit) return hit;
  const p = PALETTES[team];
  const parts: THREE.BufferGeometry[] = [];

  // legs (thigh + boot), slightly apart
  for (const side of [-1, 1]) {
    parts.push(box(0.16, 0.5, 0.17, side * 0.11, 0.42, 0, p.uniform));
    parts.push(box(0.18, 0.2, 0.24, side * 0.11, 0.1, 0.03, p.boots)); // boot, toe forward (+X)
  }

  // torso + vest
  parts.push(box(0.44, 0.56, 0.26, 0, 0.95, 0, p.uniform));
  parts.push(box(0.46, 0.42, 0.14, 0.09, 0.98, 0, p.gear)); // chest plate, front (+X)
  parts.push(box(0.4, 0.34, 0.16, -0.11, 0.96, 0, p.gear)); // pack, back (-X)

  // shoulders + arms angled forward as if bracing a rifle
  for (const side of [-1, 1]) {
    parts.push(box(0.14, 0.34, 0.15, side * 0.28, 1.02, 0.06, p.uniform, [0.5, 0, side * 0.12]));
    parts.push(box(0.11, 0.2, 0.12, side * 0.24, 0.82, 0.24, p.uniform)); // forearm forward
    parts.push(box(0.08, 0.08, 0.08, side * 0.22, 0.78, 0.34, p.skin)); // hand
  }

  // neck + head + helmet
  parts.push(cyl(0.07, 0.08, 0.1, 0, 1.28, 0, p.skin));
  parts.push(box(0.22, 0.24, 0.22, 0, 1.44, 0.01, p.skin)); // head
  const helmet = new THREE.SphereGeometry(0.17, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62);
  helmet.scale(1, 0.85, 1.05);
  helmet.translate(0, 1.5, 0.01);
  parts.push(painted(helmet, p.gear));
  parts.push(box(0.28, 0.03, 0.1, 0.08, 1.46, 0.02, p.gear)); // helmet brim, front

  // rifle held across the chest, pointing forward (+X for now)
  parts.push(box(0.62, 0.05, 0.05, 0.32, 0.82, 0.18, p.metal)); // barrel/body
  parts.push(box(0.06, 0.14, 0.05, 0.1, 0.74, 0.18, p.metal)); // grip
  parts.push(box(0.16, 0.05, 0.05, -0.02, 0.82, 0.18, p.boots)); // stock

  const merged = mergeGeometries(parts, false);
  merged.rotateY(Math.PI); // face -X, matching Army's forward convention
  merged.computeVertexNormals();
  cache.set(team, merged);
  return merged;
}
