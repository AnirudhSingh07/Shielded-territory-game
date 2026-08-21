import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Merged, vertex-coloured environment props (trees, bushes, rocks) for
 * InstancedMesh scatter. All muted, natural colours — grounded, no glow.
 */

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

const BARK = new THREE.Color('#3d3222');
const LEAF = new THREE.Color('#39482a');
const LEAF_2 = new THREE.Color('#2f3d24');
const BUSH = new THREE.Color('#37452a');
const ROCK = new THREE.Color('#5b5b55');

let tree: THREE.BufferGeometry | null = null;
let bush: THREE.BufferGeometry | null = null;
let rock: THREE.BufferGeometry | null = null;

export function getTreeGeometry(): THREE.BufferGeometry {
  if (tree) return tree;
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6);
  trunk.translate(0, 1.2, 0);
  parts.push(painted(trunk, BARK));
  const c1 = new THREE.ConeGeometry(1.5, 2.6, 7);
  c1.translate(0, 3.0, 0);
  parts.push(painted(c1, LEAF));
  const c2 = new THREE.ConeGeometry(1.1, 2.0, 7);
  c2.translate(0, 4.1, 0);
  parts.push(painted(c2, LEAF_2));
  const c3 = new THREE.ConeGeometry(0.7, 1.4, 7);
  c3.translate(0, 5.0, 0);
  parts.push(painted(c3, LEAF));
  tree = mergeGeometries(parts, false);
  tree.computeVertexNormals();
  return tree;
}

export function getBushGeometry(): THREE.BufferGeometry {
  if (bush) return bush;
  const g = new THREE.IcosahedronGeometry(0.7, 0);
  g.scale(1.3, 0.75, 1.3);
  g.translate(0, 0.5, 0);
  bush = painted(g, BUSH);
  bush.computeVertexNormals();
  return bush;
}

export function getRockGeometry(): THREE.BufferGeometry {
  if (rock) return rock;
  const g = new THREE.DodecahedronGeometry(0.6, 0);
  g.scale(1.2, 0.7, 1.0);
  g.translate(0, 0.28, 0);
  rock = painted(g, ROCK);
  rock.computeVertexNormals();
  return rock;
}
