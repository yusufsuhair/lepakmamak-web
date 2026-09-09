// A two-tone wail, synthesised rather than shipped as a file: no asset to download, and
// the pitch can be driven directly. It carries further than a shop jingle, the way a real
// siren does, but still dies well short of the far side of the map.
export const SIREN = {
  low: 620, high: 940, wailMs: 700,
  near: 14,    // Full strength inside this radius.
  reach: 62,   // Silent at and beyond it.
  peak: .34,   // A siren should cut through, not deafen.
};

export function sirenGain(distance: number): number {
  if (!(distance < SIREN.reach)) return 0;
  if (distance <= SIREN.near) return SIREN.peak;
  const fade = (SIREN.reach - distance) / (SIREN.reach - SIREN.near);
  // Squared, so it drops away quickly once the car has gone past you.
  return SIREN.peak * fade * fade;
}

// The oscillator lives as long as the city does; only its gain moves, so a car driving
// past costs nothing but a parameter ramp.
export function createSiren(context: AudioContext, destination: AudioNode) {
  const gain = context.createGain(); gain.gain.value = 0; gain.connect(destination);
  const tone = context.createOscillator(); tone.type = 'square';
  const shaper = context.createGain(); shaper.gain.value = .35;
  tone.frequency.value = SIREN.low;
  tone.connect(shaper); shaper.connect(gain);
  tone.start();
  let high = false;
  const wail = window.setInterval(() => {
    high = !high;
    tone.frequency.setTargetAtTime(high ? SIREN.high : SIREN.low, context.currentTime, .04);
  }, SIREN.wailMs);
  return {
    set(distance: number, allowed: boolean) {
      gain.gain.setTargetAtTime(allowed ? sirenGain(distance) : 0, context.currentTime, .12);
    },
    stop() { window.clearInterval(wail); try { tone.stop(); } catch { /* Already stopped. */ } },
  };
}
