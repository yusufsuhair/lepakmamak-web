// A two-tone wail, synthesised rather than shipped as a file: no asset to download, and
// the pitch can be driven directly. It carries further than a shop jingle, the way a real
// siren does, but still dies well short of the far side of the map.
export const SIREN = {
  low: 620, high: 940, wailMs: 700,
  near: 14,     // Full strength inside this radius.
  reach: 46,    // Silent at and beyond it. Two cars patrol, so a wide reach means one is
                // almost always within earshot; this keeps "only when they are near" true.
  peak: .2,     // A siren should cut through, not deafen. Scaled again by shaper below.
  timbre: 2200, // A raw square wave is all odd harmonics and reads as harsh rather than
                // loud. Rolling off above the third harmonic keeps the bite and drops the
                // piercing top. Raise for a sharper siren, lower for a duller one.
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
  // Q stays below 1 so the roll-off adds no resonant ring of its own at the cutoff.
  const soften = context.createBiquadFilter();
  soften.type = 'lowpass'; soften.frequency.value = SIREN.timbre; soften.Q.value = .7;
  tone.frequency.value = SIREN.low;
  tone.connect(soften); soften.connect(shaper); shaper.connect(gain);
  tone.start();
  let high = false;
  const wail = window.setInterval(() => {
    high = !high;
    tone.frequency.setTargetAtTime(high ? SIREN.high : SIREN.low, context.currentTime, .04);
  }, SIREN.wailMs);
  // Stop the wail with the page, so a reload never leaves a stray timer behind.
  window.addEventListener('pagehide', () => window.clearInterval(wail), {once: true});
  return {
    set(distance: number, allowed: boolean) {
      gain.gain.setTargetAtTime(allowed ? sirenGain(distance) : 0, context.currentTime, .12);
    },
    stop() { window.clearInterval(wail); try { tone.stop(); } catch { /* Already stopped. */ } },
  };
}
