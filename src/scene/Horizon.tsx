import { useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const RADIUS = 92;
const COUNT = 48;
const dummy = new THREE.Object3D();

/** A distant, static mountain-ridge silhouette ringing the field — pure atmosphere, gives the sky somewhere to meet the ground. */
export default function Horizon() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const [matrices] = useState(() => {
    const arr: THREE.Matrix4[] = [];
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
      const r = RADIUS + (Math.random() - 0.5) * 14;
      const height = 10 + Math.random() * 22;
      const width = 9 + Math.random() * 10;
      dummy.position.set(Math.cos(angle) * r, height / 2 - 1.5, Math.sin(angle) * r);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.set(width, height, width);
      dummy.updateMatrix();
      arr.push(dummy.matrix.clone());
    }
    return arr;
  });

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrices]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <coneGeometry args={[0.6, 1, 4]} />
      <meshBasicMaterial color="#050b0d" />
    </instancedMesh>
  );
}
