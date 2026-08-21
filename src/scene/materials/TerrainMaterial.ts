import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Stylized abstract siege-map terrain, centered on the Shielded Fort.
 * Colors the ground green inside the live front-line radius (uFrontRadius,
 * derived from the real shielded fraction — see logic/mapping.ts) and red
 * beyond it, with a pulsing glow ring along the boundary itself and a
 * concentric radar-style grid for the "tactical map" feel.
 */
export const TerrainMaterial = shaderMaterial(
  {
    uFrontRadius: 10,
    uTime: 0,
    uShieldColor: new THREE.Color('#00e5a0'),
    uTransparentColor: new THREE.Color('#ff3b5c'),
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
    uniform vec3 uShieldColor;
    uniform vec3 uTransparentColor;
    varying vec2 vUv;
    varying vec3 vWorldPos;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
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

    void main() {
      float dist = length(vWorldPos.xz);
      float side = dist - uFrontRadius; // negative = inside (shield), positive = outside (transparent)
      float edge = 1.0 - smoothstep(-3.0, 3.0, side);
      vec3 base = mix(uTransparentColor, uShieldColor, edge);
      vec3 dark = base * 0.1;

      // concentric radar rings + radial spokes, centered on the fort
      float rings = 1.0 - smoothstep(0.0, 0.04, abs(mod(dist + 1.5, 3.0) - 1.5) - 1.44);
      float angle = atan(vWorldPos.z, vWorldPos.x);
      float spokes = 1.0 - smoothstep(0.0, 0.01, abs(mod(angle + 3.14159, 3.14159 / 8.0) - 3.14159 / 16.0) - 3.14159 / 16.0 + 0.006);
      float gridLine = clamp(rings * 0.6 + spokes * (dist > 3.0 ? 0.35 : 0.0), 0.0, 1.0);
      vec3 col = dark + gridLine * base * 0.06;

      float n = vnoise(vWorldPos.xz * 0.12 + uTime * 0.008);
      col += base * n * 0.045;

      float distToFront = abs(side);
      float pulse = 0.55 + 0.45 * sin(uTime * 2.2 - distToFront * 0.6);
      float glow = exp(-distToFront * 0.28) * pulse;
      col += mix(uTransparentColor, uShieldColor, edge) * glow * 0.55;

      float vign = smoothstep(1.0, 0.2, dist / 44.0);
      col *= mix(0.5, 1.0, vign);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
);

extend({ TerrainMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    terrainMaterial: Record<string, unknown>;
  }
}
