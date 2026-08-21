import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * GPU-driven drifting dust motes — pure decoration, entirely independent of
 * any data. The whole point is that the field never looks frozen even
 * during a real quiet stretch with no transactions: this animates purely
 * from uTime on the GPU, no per-frame CPU work beyond bumping one uniform.
 */
export const DustMaterial = shaderMaterial(
  { uTime: 0, uColor: new THREE.Color('#b3a488') },
  /* glsl */ `
    uniform float uTime;
    attribute float aSeed;
    attribute float aSpeed;
    varying float vFade;
    void main() {
      vec3 p = position;
      p.y += mod(uTime * aSpeed + aSeed * 10.0, 7.0);
      p.x += sin(uTime * 0.15 + aSeed * 6.28) * 1.4;
      p.z += cos(uTime * 0.12 + aSeed * 6.28) * 1.4;
      vFade = smoothstep(0.0, 0.6, p.y) * smoothstep(7.0, 5.5, p.y);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = (10.0 + sin(uTime * 2.0 + aSeed * 20.0) * 3.0) * (18.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }
  `,
  /* glsl */ `
    uniform vec3 uColor;
    varying float vFade;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float alpha = smoothstep(0.5, 0.0, d) * vFade * 0.16;
      if (alpha < 0.01) discard;
      gl_FragColor = vec4(uColor, alpha);
    }
  `,
);

extend({ DustMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    dustMaterial: Record<string, unknown>;
  }
}
