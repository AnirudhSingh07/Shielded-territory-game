import { useEffect, useRef } from 'react';
import type { WarState } from '../../types';

/**
 * Progressive-enhancement fallback for browsers/devices without WebGL.
 * Same radial siege-map mapping as the 3D scene (fort at center, front-line
 * radius from the real shielded fraction, army "strength" as dot counts)
 * rendered with plain 2D canvas so the app never hard-fails to a blank screen.
 */
export default function Canvas2DBattlefield({ state }: { state: WarState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;
    const start = performance.now();

    const resize = () => {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(w, h) * 0.46;
      const s = stateRef.current;

      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, w, h);

      const frontR = maxR * (0.18 + s.frontLine * 0.75);

      // shielded disc (inside), transparent field (outside)
      const shieldGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, frontR);
      shieldGrad.addColorStop(0, 'rgba(0,229,160,0.28)');
      shieldGrad.addColorStop(1, 'rgba(0,229,160,0.08)');
      ctx.fillStyle = shieldGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, frontR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,59,92,0.08)';
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy, frontR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // front ring
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      ctx.strokeStyle = s.momentum >= 0 ? `rgba(0,229,160,${0.6 + pulse * 0.4})` : `rgba(255,59,92,${0.6 + pulse * 0.4})`;
      ctx.lineWidth = 3 * devicePixelRatio;
      ctx.beginPath();
      ctx.arc(cx, cy, frontR, 0, Math.PI * 2);
      ctx.stroke();

      // fort
      ctx.fillStyle = '#00e5a0';
      ctx.beginPath();
      ctx.arc(cx, cy, 10 * devicePixelRatio, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,229,160,0.5)';
      ctx.lineWidth = 2 * devicePixelRatio;
      ctx.beginPath();
      ctx.arc(cx, cy, 16 * devicePixelRatio + Math.sin(t * 1.5) * 2, 0, Math.PI * 2);
      ctx.stroke();

      // armies as scattered dots at random radii/angles, seeded stable per side
      drawArmy(ctx, cx, cy, 16, frontR - 14, s.supply.shieldedFraction, '#00e5a0', 11, t);
      drawArmy(ctx, cx, cy, frontR + 14, maxR, 1 - s.supply.shieldedFraction, '#ff3b5c', 99, t);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}

function drawArmy(ctx: CanvasRenderingContext2D, cx: number, cy: number, rMin: number, rMax: number, share: number, color: string, seed: number, t: number) {
  const count = Math.round(30 + share * 220);
  const rng = mulberry32(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = rMin + rng() * Math.max(1, rMax - rMin);
    const bob = Math.sin(t * 2 + i) * 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius + bob;
    ctx.globalAlpha = 0.5 + 0.5 * (1 - (radius - rMin) / Math.max(1, rMax - rMin));
    ctx.beginPath();
    ctx.arc(x, y, 2.4 * devicePixelRatio, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
