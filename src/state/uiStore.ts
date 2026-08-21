import { create } from 'zustand';

export type EffectIntensity = 'low' | 'normal' | 'high';

interface UIState {
  soundOn: boolean;
  intensity: EffectIntensity;
  autoOrbit: boolean;
  cameraResetToken: number;
  showDisclaimer: boolean;
  toggleSound: () => void;
  setIntensity: (i: EffectIntensity) => void;
  setAutoOrbit: (v: boolean) => void;
  resetCamera: () => void;
  dismissDisclaimer: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  soundOn: false,
  intensity: 'normal',
  autoOrbit: true,
  cameraResetToken: 0,
  showDisclaimer: true,
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
  setIntensity: (i) => set({ intensity: i }),
  setAutoOrbit: (v) => set({ autoOrbit: v }),
  resetCamera: () => set((s) => ({ cameraResetToken: s.cameraResetToken + 1, autoOrbit: true })),
  dismissDisclaimer: () => set({ showDisclaimer: false }),
}));
