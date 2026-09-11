// Original 16-bar rooftop instrumental, synthesized locally: no licensed recording.
export function createSkyMusic(context: AudioContext) {
  const output = context.createGain();
  output.gain.value = 0;
  output.connect(context.destination);
  const beat = 60 / 104;
  let next = 0, step = 0;
  function note(midi: number, time: number, duration: number, volume: number, type: OscillatorType = 'sine') {
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(gain); gain.connect(output);
    oscillator.start(time); oscillator.stop(time + duration + .02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  const chords = [[57,60,64,67], [53,57,60,64], [48,52,55,59], [55,59,62,65]];
  return {
    update(active: boolean, playing: boolean, volume = 1) {
      output.gain.setTargetAtTime(active ? (playing ? .015 : .12) * volume : 0, context.currentTime, .35);
      if (!active || context.state !== 'running') { next = 0; return; }
      if (next < context.currentTime) next = context.currentTime + .03;
      while (next < context.currentTime + .15) {
        const chord = chords[Math.floor(step / 32) % 4];
        if (step % 8 === 0) for (const pitch of chord) note(pitch, next, beat * 3.8, .16, 'triangle');
        if (step % 2 === 0) { note(chord[0] - 12, next, beat * .7, .4); note(30, next, .13, .5); }
        if (step % 4 === 2) note(87, next, .055, .055, 'triangle');
        if (step % 2 === 1) note(chord[(step >> 1) % 4] + 12, next, beat * .65, .12);
        next += beat / 2; step = (step + 1) % 128;
      }
    },
  };
}
