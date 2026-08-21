import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Fog of war: a drifting noise cloud that blankets the transparent territory
 * outside the live front-line radius (uFrontRadius) and recedes outward
 * from the fort as the overall shielded fraction grows (uOpacity, from
 * logic/mapping.ts#shieldedFractionToFogOpacity). Represents "unmapped /
 * unprotected" territory, not literal visibility.
 */
export const FogMaterial = shaderMaterial(
  {
    uFrontRadius: 10,
    uTime: 0,
    uOpacity: 0.6,
    uColor: new THREE.Color('#040a0d'),
  },
  /* glsl */ `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    void main() {
      vUv = uv;
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  /* glsl */ `
    uniform float uFrontRadius;
    uniform float uTime;
    uniform float uOpacity;
    uniform vec3 uColor;
    varying vec2 vUv;
    varying vec3 vWorldPos;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453123); }
    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float amp = 0.5;
      for (int i = 0; i < 4; i++) {
        v += amp * vnoise(p);
        p *= 2.02;
        amp *= 0.5;
      }
      return v;
    }

    void main() {
      float dist = length(vWorldPos.xz);
      float side = dist - uFrontRadius;
      float coverage = smoothstep(-5.0, 8.0, side);
      vec2 drift = vec2(uTime * 0.025, -uTime * 0.014);
      float n = fbm(vWorldPos.xz * 0.07 + drift);
      float n2 = fbm(vWorldPos.xz * 0.18 - drift * 1.7);
      float density = coverage * (0.5 + 0.6 * n) * (0.6 + 0.4 * n2);
      float alpha = clamp(density * uOpacity, 0.0, 0.92);
      gl_FragColor = vec4(uColor, alpha);
    }
  `,
);

extend({ FogMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    fogMaterial: Record<string, unknown>;
  }
}
