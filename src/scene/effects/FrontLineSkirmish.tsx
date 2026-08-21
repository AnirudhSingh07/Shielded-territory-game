import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Explosion from './Explosion';
import { FIELD_DEPTH } from '../../logic/mapping';

interface Props {
  worldX: number;
  shieldGlow: THREE.ColorRepresentation;
  transparentGlow: THREE.ColorRepresentation;
}

interface Spark {
  key: number;
  position: [number, number, number];
  color: THREE.ColorRepresentation;
}

let counter = 0;

/**
 * Small, quick, self-triggered spark clashes along the front line — purely
 * decorative atmosphere, never tied to real transaction data, never logged
 * to the activity feed, never accompanied by sound or a banner. This exists
 * only so the line between the two armies never reads as static between
 * real events; it deliberately looks much smaller/quieter than a real
 * TransactionCourier's arrival so the two are never visually confused.
 */
export default function FrontLineSkirmish({ worldX, shieldGlow, transparentGlow }: Props) {
  const [sparks, setSparks] = useState<Spark[]>([]);
  const worldXRef = useRef(worldX);
  useEffect(() => {
    worldXRef.current = worldX;
  }, [worldX]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const spawn = () => {
      if (cancelled) return;
      counter += 1;
      const key = counter;
      const z = (Math.random() - 0.5) * (FIELD_DEPTH - 4);
      const color = Math.random() > 0.5 ? shieldGlow : transparentGlow;
      setSparks((prev) => [...prev.slice(-4), { key, position: [worldXRef.current + (Math.random() - 0.5) * 1.5, 0.6, z], color }]);
      timer = setTimeout(spawn, 1800 + Math.random() * 3200);
    };
    timer = setTimeout(spawn, 1200 + Math.random() * 2000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [shieldGlow, transparentGlow]);

  return (
    <>
      {sparks.map((s) => (
        <Explosion
          key={s.key}
          position={s.position}
          color={s.color}
          particleCount={10}
          scale={0.3}
          onDone={() => setSparks((prev) => prev.filter((x) => x.key !== s.key))}
        />
      ))}
    </>
  );
}
