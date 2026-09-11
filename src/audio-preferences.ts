export type AudioChannel = 'sfx' | 'music' | 'voice';

const defaults: Record<AudioChannel, number> = {sfx: 1, music: 1, voice: 1};
const values = {...defaults};
const listeners = new Set<(channel: AudioChannel, value: number) => void>();

for (const channel of Object.keys(values) as AudioChannel[]) {
  try {
    const raw = localStorage.getItem(`lepakmamak-volume-${channel}`);
    const stored = raw === null ? NaN : Number(raw);
    if (Number.isFinite(stored)) values[channel] = Math.max(0, Math.min(1, stored));
  } catch { /* Storage is optional. */ }
}

export function audioVolume(channel: AudioChannel) { return values[channel]; }

export function setAudioVolume(channel: AudioChannel, value: number) {
  values[channel] = Math.max(0, Math.min(1, Number.isFinite(value) ? value : defaults[channel]));
  try { localStorage.setItem(`lepakmamak-volume-${channel}`, String(values[channel])); } catch { /* Storage is optional. */ }
  for (const listener of listeners) listener(channel, values[channel]);
  return values[channel];
}

export function onAudioVolumeChange(listener: (channel: AudioChannel, value: number) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
