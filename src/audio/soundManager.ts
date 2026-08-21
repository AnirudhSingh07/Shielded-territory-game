/**
 * Fully synthesized audio via the Web Audio API — no external sound files to
 * fetch/host, which keeps the app a single static bundle. Everything here is
 * generated at runtime: a low ambient battlefield drone + filtered noise bed
 * with occasional distant-rumble flavor hits, short procedural stingers for
 * shield surges / unshield attacks, and a deeper cannon boom for major
 * (large real-transaction) events.
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

/** A single soft, distant thump — part of the idle battlefield atmosphere, not tied to any real event. */
function playDistantRumble() {
  const c = getCtx();
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(70 + Math.random() * 20, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 1.1);
  const g = c.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.05, now + 0.08);
  g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300;
  osc.connect(filter).connect(g).connect(masterGain!);
  osc.start(now);
  osc.stop(now + 1.5);
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

  let rumbleTimer: ReturnType<typeof setTimeout>;
  const scheduleRumble = () => {
    rumbleTimer = setTimeout(
      () => {
        playDistantRumble();
        scheduleRumble();
      },
      18_000 + Math.random() * 20_000,
    );
  };
  scheduleRumble();

  ambientNodes = {
    stop: () => {
      clearTimeout(rumbleTimer);
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

/** Deep boom + crack transient — a major (large real-transaction) event launching from a fort. */
export function playCannonBoom(magnitude: number) {
  const c = getCtx();
  const now = c.currentTime;
  const peak = 0.16 + magnitude * 0.22;

  // low thump
  const thump = c.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(110, now);
  thump.frequency.exponentialRampToValueAtTime(35, now + 0.5);
  const thumpGain = c.createGain();
  thumpGain.gain.setValueAtTime(peak, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
  thump.connect(thumpGain).connect(masterGain!);
  thump.start(now);
  thump.stop(now + 0.95);

  // noise crack transient
  const crack = c.createBufferSource();
  crack.buffer = noiseBuffer(c, 0.3);
  const crackFilter = c.createBiquadFilter();
  crackFilter.type = 'highpass';
  crackFilter.frequency.value = 900;
  const crackGain = c.createGain();
  crackGain.gain.setValueAtTime(peak * 0.7, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  crack.connect(crackFilter).connect(crackGain).connect(masterGain!);
  crack.start(now);
  crack.stop(now + 0.2);
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

/* ---------------------------------------------------------------------------
 * AMBIENT BATTLE AUDIO — cosmetic set-dressing for the continuous firefight.
 * Deliberately kept LOW in the mix (well under the real-event stingers above)
 * so a confirmed transaction's chime / cannon boom still cuts through clearly.
 * Nothing here is tied to transaction data.
 * ------------------------------------------------------------------------- */

let battleNodes: { stop: () => void } | null = null;

export function startBattleAmbience() {
  const c = getCtx();
  if (c.state === 'suspended') void c.resume();
  if (battleNodes) return;

  // continuous distant-crackle bed: looping noise, bandpassed, with a fluttering tremolo
  const bed = c.createBufferSource();
  bed.buffer = noiseBuffer(c, 3);
  bed.loop = true;
  const bedFilter = c.createBiquadFilter();
  bedFilter.type = 'bandpass';
  bedFilter.frequency.value = 1100;
  bedFilter.Q.value = 0.7;
  const bedGain = c.createGain();
  bedGain.gain.value = 0.03;
  const tremolo = c.createOscillator();
  tremolo.type = 'sawtooth';
  tremolo.frequency.value = 11;
  const tremGain = c.createGain();
  tremGain.gain.value = 0.02;
  tremolo.connect(tremGain).connect(bedGain.gain);
  bed.connect(bedFilter).connect(bedGain).connect(masterGain!);
  bed.start();
  tremolo.start();

  // scheduled small-arms "pops" at irregular fast intervals
  let popTimer: ReturnType<typeof setTimeout>;
  const schedulePop = () => {
    popTimer = setTimeout(
      () => {
        smallArmsPop();
        schedulePop();
      },
      90 + Math.random() * 380,
    );
  };
  schedulePop();

  battleNodes = {
    stop: () => {
      clearTimeout(popTimer);
      bed.stop();
      tremolo.stop();
    },
  };
}

export function stopBattleAmbience() {
  battleNodes?.stop();
  battleNodes = null;
}

/** A single faint rifle crack — part of the ambient bed, very quiet. */
function smallArmsPop() {
  if (!ctx || !masterGain) return;
  const c = ctx;
  const now = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.08);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1400;
  const g = c.createGain();
  g.gain.setValueAtTime(0.018 + Math.random() * 0.02, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  src.connect(hp).connect(g).connect(masterGain);
  src.start(now);
  src.stop(now + 0.08);
}

/** Dull artillery/shell impact thump — quieter than the real playCannonBoom. */
export function playImpactThump(intensity = 1) {
  const c = getCtx();
  const now = c.currentTime;
  const peak = (0.05 + Math.random() * 0.04) * intensity;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(95, now);
  osc.frequency.exponentialRampToValueAtTime(38, now + 0.4);
  const g = c.createGain();
  g.gain.setValueAtTime(peak, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  osc.connect(g).connect(masterGain!);
  osc.start(now);
  osc.stop(now + 0.6);
}

/** A tank/field-gun report — heavier than a rifle crack, lighter than a real cannon boom. */
export function playCannonReport(intensity = 1) {
  const c = getCtx();
  const now = c.currentTime;
  const peak = (0.07 + Math.random() * 0.03) * intensity;
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.3);
  const g = c.createGain();
  g.gain.setValueAtTime(peak, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  const crack = c.createBufferSource();
  crack.buffer = noiseBuffer(c, 0.14);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 700;
  const cg = c.createGain();
  cg.gain.setValueAtTime(peak * 0.6, now);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
  osc.connect(g).connect(masterGain!);
  crack.connect(hp).connect(cg).connect(masterGain!);
  osc.start(now);
  osc.stop(now + 0.5);
  crack.start(now);
  crack.stop(now + 0.16);
}
