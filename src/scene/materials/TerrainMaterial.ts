import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Stylized abstract battlefield terrain. Colors the ground green/red based
 * on which side of the live front line (uFrontLine, a world-space X coord
 * derived from shieldedFraction — see logic/mapping.ts) each fragment falls
 * on, with a pulsing glow band along the line itself and a faint tactical
 * grid overlay for the "war map" feel.
 */
export const TerrainMaterial = shaderMaterial(
  {
    uFrontLine: 0,
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
    uniform float uFrontLine;
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
      float side = vWorldPos.x - uFrontLine;
      float edge = smoothstep(-3.0, 3.0, side);
      vec3 base = mix(uTransparentColor, uShieldColor, edge);
      vec3 dark = base * 0.11;

      vec2 grid = abs(fract(vWorldPos.xz * 0.5 + 0.5) - 0.5);
      float gridLine = 1.0 - smoothstep(0.0, 0.02, min(grid.x, grid.y));
      vec3 col = dark + gridLine * base * 0.05;

      float n = vnoise(vWorldPos.xz * 0.12 + uTime * 0.008);
      col += base * n * 0.05;

      float distToFront = abs(side);
      float pulse = 0.55 + 0.45 * sin(uTime * 2.2 - distToFront * 0.6);
      float glow = exp(-distToFront * 0.28) * pulse;
      col += mix(uTransparentColor, uShieldColor, edge) * glow * 0.55;

      float vign = smoothstep(1.0, 0.25, length(vUv - 0.5));
      col *= mix(0.55, 1.0, vign);

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
