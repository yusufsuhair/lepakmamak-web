// The procedural foley UNO proved, with the game-specific part lifted out: swish and note
// are the only two sounds a table game needs, and every voice is built from them. No
// downloads, no licensing. UNO keeps its own copy for now — dressing a broken game is not
// the moment to refactor the working one.
type Tools = {swish: (at: number, length?: number) => void; note: (frequency: number, at: number, length?: number) => void; now: number};

export function createGameAudio(name: string, voices: Record<string, (tools: Tools) => void>) {
  const key = `lepak-${name}-muted`;
  let context: AudioContext | null = null, master: GainNode | null = null, muted = false;
  try { muted = localStorage.getItem(key) === 'true'; } catch { /* private window */ }

  function unlock() {
    try {
      context ??= new (window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext)();
      if (!master) { master = context.createGain(); master.gain.value = muted ? 0 : 1; master.connect(context.destination); }
      if (context.state === 'suspended') void context.resume();
    } catch { /* audio is a nicety, never a requirement */ }
  }

  function sound(kind: string) {
    // `default` catches kinds the caller did not name. UNO drives this from server event
    // types, so without a fallback every event nobody had listed would go silent.
    const voice = voices[kind] || voices.default;
    if (muted || !voice || context?.state !== 'running' || !master) return;
    const audio = context, out = master;
    const swish = (at: number, length = .07) => {
      const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * length), audio.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
      const source = audio.createBufferSource(); source.buffer = buffer;
      const gain = audio.createGain(); gain.gain.value = .22;
      source.connect(gain); gain.connect(out); source.start(at);
    };
    const note = (frequency: number, at: number, length = .16) => {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.frequency.value = frequency; oscillator.type = 'triangle';
      gain.gain.setValueAtTime(.0001, at);
      gain.gain.exponentialRampToValueAtTime(.16, at + .012);
      gain.gain.exponentialRampToValueAtTime(.0001, at + length);
      oscillator.connect(gain); gain.connect(out);
      oscillator.start(at); oscillator.stop(at + length + .02);
    };
    voice({swish, note, now: audio.currentTime});
  }

  return {
    unlock, sound,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 1;
      try { localStorage.setItem(key, String(muted)); } catch { /* private window */ }
      return muted;
    },
  };
}
