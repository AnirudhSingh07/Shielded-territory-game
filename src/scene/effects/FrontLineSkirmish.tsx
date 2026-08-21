import { useEffect, useRef, useState } from 'react';
import Explosion from './Explosion';
import { FIELD_DEPTH } from '../../logic/mapping';
import { terrainHeight } from '../terrain/heightField';

interface Props {
  worldX: number;
}

interface Spark {
  key: number;
  position: [number, number, number];
}

let counter = 0;
const MUZZLE = '#ffce85'; // warm gunfire flash, not a team-coloured burst

/**
 * Small muzzle-flash skirmishes flickering along the contact line — purely
 * decorative atmosphere, never tied to real transaction data, never logged
 * to the activity feed, never accompanied by sound or a banner. Warm gunfire
 * colour (not team-coloured) and tiny, so it's never confused with a real
 * TransactionCourier arrival or a confirmed event's cannon flash. This just
 * keeps the line between the two armies alive with trading fire between events.
 */
export default function FrontLineSkirmish({ worldX }: Props) {
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
      const x = worldXRef.current + (Math.random() - 0.5) * 4; // fire from either side of the line
      const y = terrainHeight(x, z) + 1.0; // rifle height on the ground
      setSparks((prev) => [...prev.slice(-6), { key, position: [x, y, z] }]);
      timer = setTimeout(spawn, 700 + Math.random() * 1600);
    };
    timer = setTimeout(spawn, 800 + Math.random() * 1500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <>
      {sparks.map((s) => (
        <Explosion
          key={s.key}
          position={s.position}
          color={MUZZLE}
          particleCount={7}
          scale={0.22}
          onDone={() => setSparks((prev) => prev.filter((x) => x.key !== s.key))}
        />
      ))}
    </>
  );
}
