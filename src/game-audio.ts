// The procedural foley UNO proved, with the game-specific part lifted out: swish and note
// are the only two sounds a table game needs, and every voice is built from them. No
// downloads, no licensing. UNO keeps its own copy for now — dressing a broken game is not
// the moment to refactor the working one.
type Tools = {swish: (at: number, length?: number) => void; note: (frequency: number, at: number, length?: number) => void; now: number};
type Sample = string | {src: string; volume?: number; loop?: boolean};

export function createGameAudio(name: string, voices: Record<string, (tools: Tools) => void>, samples: Record<string, Sample> = {}) {
  const key = `lepak-${name}-muted`;
  let context: AudioContext | null = null, master: GainNode | null = null, muted = false;
  const buffers = new Map<string, AudioBuffer>();
  const loading = new Map<string, Promise<AudioBuffer | null>>();
  const active = new Map<string, Set<AudioBufferSourceNode>>();
  try { muted = localStorage.getItem(key) === 'true'; } catch { /* private window */ }

  function sampleSpec(kind: string) {
    const value = samples[kind];
    return typeof value === 'string' ? {src: value, volume: 1, loop: false} : value ? {...value, volume: value.volume ?? 1, loop: value.loop ?? false} : null;
  }

  function loadSample(kind: string): Promise<AudioBuffer | null> {
    const cached = buffers.get(kind);
    if (cached) return Promise.resolve(cached);
    const inFlight = loading.get(kind);
    if (inFlight) return inFlight;
    const spec = sampleSpec(kind);
    if (!spec || !context) return Promise.resolve(null);
    const promise = fetch(spec.src).then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error(`Audio ${response.status}`))).then(data => context!.decodeAudioData(data)).then(buffer => { buffers.set(kind, buffer); return buffer; }).catch(() => null);
    loading.set(kind, promise);
    return promise;
  }

  function unlock() {
    try {
      context ??= new (window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext)();
      if (!master) { master = context.createGain(); master.gain.value = muted ? 0 : 1; master.connect(context.destination); }
      if (context.state === 'suspended') void context.resume();
      for (const kind of Object.keys(samples)) void loadSample(kind);
    } catch { /* audio is a nicety, never a requirement */ }
  }

  function sample(kind: string) {
    if (muted || !sampleSpec(kind) || context?.state !== 'running' || !master) return;
    const spec = sampleSpec(kind)!;
    const play = (buffer: AudioBuffer | null) => {
      if (!buffer || muted || context?.state !== 'running' || !master) return;
      const current = active.get(kind) || new Set<AudioBufferSourceNode>();
      if (spec.loop && current.size) return;
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer; source.loop = !!spec.loop; gain.gain.value = spec.volume;
      source.connect(gain); gain.connect(master); current.add(source);
      source.onended = () => current.delete(source);
      active.set(kind, current); source.start();
    };
    const buffer = buffers.get(kind);
    if (buffer) play(buffer); else void loadSample(kind).then(play);
  }

  function stopSample(kind: string) {
    for (const source of active.get(kind) || []) { try { source.stop(); } catch { /* already ended */ } }
    active.delete(kind);
  }

  function stopSamples() {
    for (const kind of active.keys()) stopSample(kind);
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
    unlock, sound, sample, stopSample, stopSamples,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 1;
      try { localStorage.setItem(key, String(muted)); } catch { /* private window */ }
      return muted;
    },
  };
}
