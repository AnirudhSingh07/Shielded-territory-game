import { useEffect, useRef } from 'react';
import type { WarState } from '../../types';

/**
 * Progressive-enhancement fallback for browsers/devices without WebGL.
 * Same linear two-fort mapping as the 3D scene (front line position, army
 * "strength" as dot counts) rendered with plain 2D canvas so the app never
 * hard-fails to a blank screen.
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
      const s = stateRef.current;

      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, w, h);

      const frontX = w * (0.08 + s.frontLine * 0.84);

      const shieldGrad = ctx.createLinearGradient(frontX, 0, w, 0);
      shieldGrad.addColorStop(0, 'rgba(0,229,160,0.05)');
      shieldGrad.addColorStop(1, 'rgba(0,229,160,0.22)');
      ctx.fillStyle = shieldGrad;
      ctx.fillRect(frontX, 0, w - frontX, h);

      const transGrad = ctx.createLinearGradient(0, 0, frontX, 0);
      transGrad.addColorStop(0, 'rgba(255,59,92,0.22)');
      transGrad.addColorStop(1, 'rgba(255,59,92,0.05)');
      ctx.fillStyle = transGrad;
      ctx.fillRect(0, 0, frontX, h);

      // front line
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      ctx.strokeStyle = s.momentum >= 0 ? `rgba(0,229,160,${0.6 + pulse * 0.4})` : `rgba(255,59,92,${0.6 + pulse * 0.4})`;
      ctx.lineWidth = 3 * devicePixelRatio;
      ctx.beginPath();
      ctx.moveTo(frontX, 0);
      ctx.lineTo(frontX, h);
      ctx.stroke();

      // the two forts
      drawFort(ctx, w * 0.92, h / 2, '#00e5a0', t);
      drawFort(ctx, w * 0.08, h / 2, '#ff3b5c', t);

      // armies as scattered dots, density scaled by real supply share
      drawArmy(ctx, frontX, w, h, s.supply.shieldedFraction, '#00e5a0', 1, t);
      drawArmy(ctx, frontX, 0, h, 1 - s.supply.shieldedFraction, '#ff3b5c', -1, t);

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

function drawFort(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, t: number) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 12 * devicePixelRatio, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2 * devicePixelRatio;
  ctx.beginPath();
  ctx.arc(x, y, 20 * devicePixelRatio + Math.sin(t * 1.5) * 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawArmy(ctx: CanvasRenderingContext2D, fromX: number, toX: number, h: number, share: number, color: string, dir: number, t: number) {
  const count = Math.round(30 + share * 220);
  const rng = mulberry32(dir > 0 ? 11 : 99);
  ctx.fillStyle = color;
  const bandWidth = Math.abs(toX - fromX) * 0.85;
  for (let i = 0; i < count; i++) {
    const depth = rng();
    const x = fromX + dir * depth * bandWidth;
    const y = rng() * h;
    const bob = Math.sin(t * 2 + i) * 2;
    ctx.globalAlpha = 0.55 + 0.45 * (1 - depth);
    ctx.beginPath();
    ctx.arc(x, y + bob, 2.4 * devicePixelRatio, 0, Math.PI * 2);
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
