import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';
import * as THREE from 'three';

/** A pulsing glow ring drawn at the live front-line radius around the fort. */
export const FrontRingMaterial = shaderMaterial(
  {
    uRadius: 10,
    uTime: 0,
    uColor: new THREE.Color('#00e5a0'),
  },
  /* glsl */ `
    varying vec3 vWorldPos;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  /* glsl */ `
    uniform float uRadius;
    uniform float uTime;
    uniform vec3 uColor;
    varying vec3 vWorldPos;

    void main() {
      float dist = length(vWorldPos.xz);
      float d = abs(dist - uRadius);
      float pulse = 0.6 + 0.4 * sin(uTime * 3.0);
      float band = smoothstep(0.55, 0.0, d) * (0.65 + 0.35 * pulse);
      float halo = smoothstep(3.2, 0.0, d) * 0.18;
      float alpha = clamp(band + halo, 0.0, 1.0);
      if (alpha < 0.01) discard;
      gl_FragColor = vec4(uColor, alpha);
    }
  `,
);

extend({ FrontRingMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    frontRingMaterial: Record<string, unknown>;
  }
}
