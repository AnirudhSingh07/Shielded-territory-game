import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * A grounded, muted river surface — dusk water, not neon. Ripples scroll
 * along the channel via layered sines; a soft specular band suggests a low
 * sun on the water. Purely cosmetic (a static river), no data meaning.
 */
export const WaterMaterial = shaderMaterial(
  {
    uTime: 0,
    uDeep: new THREE.Color('#22333a'),
    uShallow: new THREE.Color('#3c5a5e'),
    uGlint: new THREE.Color('#8fb0ad'),
  },
  /* glsl */ `
    varying vec2 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  /* glsl */ `
    uniform float uTime;
    uniform vec3 uDeep;
    uniform vec3 uShallow;
    uniform vec3 uGlint;
    varying vec2 vUv;
    varying vec3 vWorld;

    void main() {
      float ripple = sin(vWorld.z * 1.7 + uTime * 1.1) * 0.5 + 0.5;
      ripple *= sin(vWorld.x * 3.1 - uTime * 0.7) * 0.5 + 0.5;
      float acrossBank = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
      vec3 col = mix(uDeep, uShallow, acrossBank * (0.5 + 0.5 * ripple));
      float glint = pow(ripple, 6.0) * 0.6;
      col += uGlint * glint;
      gl_FragColor = vec4(col, 0.9);
    }
  `,
);

extend({ WaterMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    waterMaterial: Record<string, unknown>;
  }
}
