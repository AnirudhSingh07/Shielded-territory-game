/**
 * Fully synthesized audio via the Web Audio API — no external sound files to
 * fetch/host, which keeps the app a single static bundle. Everything here is
 * generated at runtime: a low ambient drone + filtered noise bed, and short
 * procedural stingers for shield surges / unshield attacks.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let ambientNodes: { stop: () => void } | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

function noiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.02 * white) / 1.02;
    data[i] = lastOut * 3.2; // brown-ish noise, roughly normalized
  }
  return buffer;
}

export function setMasterVolume(v: number) {
  if (masterGain) masterGain.gain.value = v;
}

export function startAmbient() {
  const c = getCtx();
  if (c.state === 'suspended') void c.resume();
  if (ambientNodes) return;

  const noiseSrc = c.createBufferSource();
  noiseSrc.buffer = noiseBuffer(c, 4);
  noiseSrc.loop = true;
  const noiseFilter = c.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 220;
  const noiseGain = c.createGain();
  noiseGain.gain.value = 0.06;
  noiseSrc.connect(noiseFilter).connect(noiseGain).connect(masterGain!);
  noiseSrc.start();

  const drone = c.createOscillator();
  drone.type = 'sine';
  drone.frequency.value = 55;
  const droneGain = c.createGain();
  droneGain.gain.value = 0.035;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 6;
  lfo.connect(lfoGain).connect(drone.frequency);
  drone.connect(droneGain).connect(masterGain!);
  drone.start();
  lfo.start();

  ambientNodes = {
    stop: () => {
      noiseSrc.stop();
      drone.stop();
      lfo.stop();
    },
  };
}

export function stopAmbient() {
  ambientNodes?.stop();
  ambientNodes = null;
}

/** Rising, resolving chime — shielding advance. */
export function playShieldChime(magnitude: number) {
  const c = getCtx();
  const now = c.currentTime;
  const freqs = [220, 277.18, 329.63, 440];
  freqs.forEach((f, i) => {
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const g = c.createGain();
    const peak = 0.05 + magnitude * 0.08;
    g.gain.setValueAtTime(0, now + i * 0.05);
    g.gain.linearRampToValueAtTime(peak, now + i * 0.05 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.9);
    osc.connect(g).connect(masterGain!);
    osc.start(now + i * 0.05);
    osc.stop(now + i * 0.05 + 1);
  });
}

/** Low, dissonant hit — unshielding attack / breach. */
export function playAlertHit(magnitude: number) {
  const c = getCtx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(130, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.4);
  const g = c.createGain();
  const peak = 0.08 + magnitude * 0.14;
  g.gain.setValueAtTime(peak, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  osc.connect(filter).connect(g).connect(masterGain!);
  osc.start(now);
  osc.stop(now + 0.65);
}

export function playUiTick() {
  const c = getCtx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 880;
  const g = c.createGain();
  g.gain.setValueAtTime(0.03, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(g).connect(masterGain!);
  osc.start(now);
  osc.stop(now + 0.09);
}
