import voiceConfig from '../shared/voice.json';

const micIcon = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/><path class="voice-off-slash" d="M3 3l18 18"/></svg>`;
const speakerIcon = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M11 4 6 8H3v8h3l5 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/><path class="voice-off-slash" d="M3 3l18 18"/></svg>`;
type VoiceScope = 'all' | 'party';
type VoiceCodec = 'pcm' | 'opus';
type VoiceMessage = { type: string; mic?: boolean; speaker?: boolean; audio?: string; codec?: VoiceCodec; micScope?: VoiceScope; speakerScope?: VoiceScope };
// Opus at 24 kbps carries a 40 ms frame in about 120 bytes where the raw PCM took 1280.
export const OPUS = { codec: 'opus', sampleRate: 16000, numberOfChannels: 1, bitrate: 24000, opus: { frameDuration: 40000 } };
const FRAME_US = 40000;
export const opusCapable = typeof AudioEncoder === 'function' && typeof AudioDecoder === 'function'
  && typeof AudioData === 'function' && typeof EncodedAudioChunk === 'function';
export function setupVoice(send: (message: VoiceMessage) => boolean) {
  const panel = document.createElement('aside'); panel.id = 'voice-panel'; panel.hidden = true;
  panel.innerHTML = `<div class="voice-buttons"><button id="voice-mic" type="button" aria-pressed="false" aria-label="Turn microphone on" title="Microphone off">${micIcon}</button><button id="voice-speaker" type="button" aria-pressed="false" aria-label="Turn speakers on" title="Speakers off">${speakerIcon}</button></div><div class="voice-scopes"><button id="mic-scope" type="button" hidden></button><button id="speaker-scope" type="button" hidden></button></div><strong id="voice-audience" hidden>No one nearby</strong><small id="voice-status" role="status">Voice connects when you enter the city</small>`;
  document.getElementById('hud')!.append(panel);
  panel.setAttribute('aria-label', 'Your character voice controls');
  panel.addEventListener('keydown', event => event.stopPropagation());
  panel.addEventListener('pointerdown', event => event.stopPropagation());
  const micButton = panel.querySelector<HTMLButtonElement>('#voice-mic')!;
  const speakerButton = panel.querySelector<HTMLButtonElement>('#voice-speaker')!;
  const status = panel.querySelector<HTMLElement>('#voice-status')!;
  const audience = panel.querySelector<HTMLElement>('#voice-audience')!;
  let online = false, mic = false, speaker = false, generation = 0, busy = false;
  let micScope: VoiceScope = 'all', speakerScope: VoiceScope = 'all', inParty = false;
  const micScopeButton = panel.querySelector<HTMLButtonElement>('#mic-scope')!;
  const speakerScopeButton = panel.querySelector<HTMLButtonElement>('#speaker-scope')!;
  function renderScopes() {
    // Without a party there is no second audience to choose between.
    micScopeButton.hidden = !inParty; speakerScopeButton.hidden = !inParty;
    micScopeButton.textContent = micScope === 'party' ? 'Cakap: GENG' : 'Cakap: SEMUA';
    speakerScopeButton.textContent = speakerScope === 'party' ? 'Dengar: GENG' : 'Dengar: SEMUA';
    micScopeButton.setAttribute('aria-label', micScope === 'party' ? 'Speaking to your party only' : 'Speaking to everyone nearby');
    speakerScopeButton.setAttribute('aria-label', speakerScope === 'party' ? 'Hearing your party only' : 'Hearing everyone nearby');
    micScopeButton.dataset.scope = micScope; speakerScopeButton.dataset.scope = speakerScope;
  }
  micScopeButton.onclick = () => { micScope = micScope === 'party' ? 'all' : 'party'; renderScopes(); announce(); };
  speakerScopeButton.onclick = () => { speakerScope = speakerScope === 'party' ? 'all' : 'party'; renderScopes(); announce(); };
  let context: AudioContext | undefined, stream: MediaStream | undefined, input: MediaStreamAudioSourceNode | undefined, capture: AudioWorkletNode | undefined;
  let moduleReady: Promise<void> | undefined;
  let output: GainNode | undefined;
  const next = new Map<string, number>();
  const playing = new Set<AudioBufferSourceNode>();
  // The room tells us what every listener can decode; a speaker never sends Opus into a room
  // that still holds someone who cannot play it. Frames carry their own codec, so a change
  // mid-sentence is harmless.
  let roomCodec: VoiceCodec = 'pcm';
  let encoder: AudioEncoder | undefined, encodeAt = 0;
  const decoders = new Map<string, AudioDecoder>();
  const awaitingVolume = new Map<string, number[]>();
  const decodeAt = new Map<string, number>();
  const speakerNames = new Map<string, string>();
  function base64(bytes: Uint8Array) {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  function sendAudio(bytes: Uint8Array, codec: VoiceCodec) { send({ type: 'voice-audio', audio: base64(bytes), codec }); }
  function encoderFor() {
    if (!opusCapable || roomCodec !== 'opus') return undefined;
    if (encoder) return encoder;
    try {
      encoder = new AudioEncoder({
        output: chunk => { const bytes = new Uint8Array(chunk.byteLength); chunk.copyTo(bytes); sendAudio(bytes, 'opus'); },
        // A failed encoder simply drops this speaker back to PCM rather than going silent.
        error: () => { encoder = undefined; },
      });
      encoder.configure(OPUS as AudioEncoderConfig);
      encodeAt = 0;
    } catch { encoder = undefined; }
    return encoder;
  }
  function dropDecoders() {
    for (const decoder of decoders.values()) { try { decoder.close(); } catch { /* already gone */ } }
    decoders.clear(); awaitingVolume.clear(); decodeAt.clear();
  }
  function schedule(id: string, buffer: AudioBuffer, seconds: number) {
    const now = context!.currentTime;
    const start = Math.max(now + .02, next.get(id) ?? now + .08);
    if (start > now + .3) return; // Drop delayed packets instead of building an audio backlog.
    const source = context!.createBufferSource(); source.buffer = buffer; source.connect(output!);
    playing.add(source); source.onended = () => { playing.delete(source); source.disconnect(); };
    source.start(start); next.set(id, start + seconds);
  }
  function play(id: string, samples: Float32Array, rate: number, volume: number) {
    if (!context || !output) return;
    const buffer = context.createBuffer(1, samples.length, rate);
    const channel = buffer.getChannelData(0);
    const gain = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0));
    let energy = 0;
    for (let i = 0; i < samples.length; i++) { channel[i] = samples[i] * gain; energy += channel[i] ** 2; }
    schedule(id, buffer, samples.length / rate);
    if (energy / samples.length > .0001) status.textContent = `${speakerNames.get(id) || 'Someone'} is talking`;
  }
  function decoderFor(id: string) {
    const existing = decoders.get(id);
    if (existing) return existing;
    const volumes: number[] = []; awaitingVolume.set(id, volumes);
    const decoder = new AudioDecoder({
      output: audio => {
        // Opus decodes at 48 kHz whatever it was encoded at, so play it at its own rate.
        const samples = new Float32Array(audio.numberOfFrames);
        try { audio.copyTo(samples, { planeIndex: 0, format: 'f32-planar' }); play(id, samples, audio.sampleRate, volumes.shift() ?? 1); }
        finally { audio.close(); }
      },
      error: () => { decoders.delete(id); awaitingVolume.delete(id); decodeAt.delete(id); },
    });
    decoder.configure({ codec: 'opus', sampleRate: 16000, numberOfChannels: 1 });
    decoders.set(id, decoder);
    return decoder;
  }
  function render() {
    micButton.disabled = !online; speakerButton.disabled = !online;
    micButton.setAttribute('aria-label', busy ? 'Cancel microphone request' : mic ? 'Turn microphone off' : 'Turn microphone on');
    micButton.title = busy ? 'Microphone permission pending · Click to cancel' : mic ? 'Microphone on' : 'Microphone off';
    micButton.dataset.pending = String(busy);
    micButton.setAttribute('aria-pressed', String(mic));
    speakerButton.setAttribute('aria-label', speaker ? 'Turn speakers off' : 'Turn speakers on');
    speakerButton.title = speaker ? 'Speakers on' : 'Speakers off';
    speakerButton.setAttribute('aria-pressed', String(speaker));
  }
  function announce() { send({ type: 'voice-state', mic, speaker, micScope, speakerScope }); render(); renderScopes(); }
  async function audioContext() {
    if (!context) {
      context = new AudioContext({ latencyHint: 'interactive' });
      output = context.createGain(); output.gain.value = 0; output.connect(context.destination);
    }
    await context.resume(); return context;
  }
  function stopMic() {
    generation++; busy = false; mic = false;
    audience.hidden = true; audience.textContent = 'No one nearby';
    stream?.getTracks().forEach(track => track.stop()); stream = undefined;
    input?.disconnect(); input = undefined;
    if (capture) { capture.port.onmessage = null; capture.port.close(); capture.disconnect(); capture = undefined; }
    announce();
  }
  function stopPlayback() { for (const source of playing) { source.stop(); source.disconnect(); } playing.clear(); next.clear(); dropDecoders(); }
  micButton.onclick = async () => {
    if (mic || busy) { stopMic(); status.textContent = 'Microphone off'; return; }
    if (!online) return;
    const attempt = ++generation; busy = true; render(); status.textContent = `Allow microphone access to talk to nearby players (within ${voiceConfig.hearingRadius} metres)`;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access needs a supported browser on HTTPS.');
      const ctx = await audioContext();
      if (attempt !== generation || !online) return;
      const requested = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, video: false });
      if (attempt !== generation || !online) { requested.getTracks().forEach(track => track.stop()); return; }
      stream = requested;
      moduleReady ??= ctx.audioWorklet.addModule('/voice-capture.js').catch(error => { moduleReady = undefined; throw error; });
      await moduleReady;
      if (attempt !== generation || !online) return;
      input = ctx.createMediaStreamSource(requested); capture = new AudioWorkletNode(ctx, 'voice-capture');
      capture.port.onmessage = event => {
        if (!mic || !online || attempt !== generation) return;
        const bytes = new Uint8Array(event.data as ArrayBuffer);
        const active = encoderFor();
        if (!active) { sendAudio(bytes, 'pcm'); return; }
        const pcm = new Int16Array(bytes.buffer);
        const floats = new Float32Array(pcm.length);
        for (let i = 0; i < pcm.length; i++) floats[i] = pcm[i] / 32768;
        active.encode(new AudioData({ format: 'f32', sampleRate: 16000, numberOfFrames: floats.length, numberOfChannels: 1, timestamp: encodeAt, data: floats }));
        encodeAt += FRAME_US;
      };
      input.connect(capture); capture.connect(ctx.destination); // Processor outputs silence.
      requested.getAudioTracks()[0].onended = () => { if (attempt === generation) { stopMic(); status.textContent = 'Microphone disconnected. Tap the microphone icon to retry.'; } };
      busy = false; mic = true; speaker = true; output!.gain.value = 0.8;
      announce(); status.textContent = 'Mic and speakers on · Nearby players can hear you';
    } catch (error) {
      if (attempt !== generation) return;
      stopMic();
      status.textContent = error instanceof DOMException && error.name === 'NotAllowedError' ? 'Microphone blocked. Allow it in your browser’s site settings, then try again.' : 'Could not start microphone. Check your audio device and try again.';
    }
  };
  speakerButton.onclick = async () => {
    if (speaker) { speaker = false; if (output) output.gain.value = 0; stopPlayback(); announce(); status.textContent = 'Other players muted'; return; }
    const attempt = generation;
    try {
      await audioContext(); if (!online || attempt !== generation) return;
      speaker = true; output!.gain.value = 0.8; announce(); status.textContent = `Speakers on · Listening within ${voiceConfig.hearingRadius} metres`;
    } catch { status.textContent = 'Could not enable speakers. Tap again to retry.'; }
  };
  render();
  return {
    get micActive(){return mic;},
    get partyOnly(){return micScope === 'party';},
    party(value: boolean) {
      if (inParty === value) return;
      inParty = value;
      // Leaving the geng must not leave you muted to a party that no longer exists.
      if (!value) { micScope = 'all'; speakerScope = 'all'; announce(); }
      renderScopes();
    },
    connected(value: boolean) {
      online = value;
      if (!value) { stopMic(); speaker = false; if (output) output.gain.value = 0; stopPlayback(); status.textContent = 'Voice offline · Re-enable after reconnecting'; }
      else status.textContent = 'Turn on speakers to listen · Mic asks permission';
      announce();
    },
    audience(count:number,names:string[]=[]){
      if(!mic)return;
      const safeCount=Math.max(0,Math.floor(Number.isFinite(count)?count:0));
      const safeNames=names.filter(name=>typeof name==='string').slice(0,3);
      audience.hidden=false;
      audience.classList.toggle('empty',safeCount===0);
      audience.textContent=safeCount===0?'No one nearby can hear you':safeCount===1?`${safeNames[0]||'1 person'} can hear you`:`${safeNames[0]?`${safeNames[0]} + ${safeCount-1}`:`${safeCount} people`} can hear you`;
      status.textContent=audience.textContent;
    },
    opusCapable,
    // A joiner without Opus drops the whole room to PCM, and a leaver can restore it.
    codec(next: VoiceCodec) {
      if (next === roomCodec) return;
      roomCodec = next;
      if (encoder) { try { encoder.close(); } catch { /* already gone */ } encoder = undefined; }
    },
    receive(id: string, name: string, encoded: string, volume = 1, codec: VoiceCodec = 'pcm') {
      if (!speaker || !context || context.state !== 'running' || !output) return;
      speakerNames.set(id, name);
      try {
        const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
        if (codec === 'opus') {
          if (!opusCapable) return;
          const decoder = decoderFor(id);
          awaitingVolume.get(id)!.push(volume);
          const at = decodeAt.get(id) ?? 0;
          decoder.decode(new EncodedAudioChunk({ type: 'key', timestamp: at, data: bytes }));
          decodeAt.set(id, at + FRAME_US);
          return;
        }
        if (bytes.length !== 1280) return;
        const pcm = new Int16Array(bytes.buffer);
        const floats = new Float32Array(pcm.length);
        for (let i = 0; i < pcm.length; i++) floats[i] = pcm[i] / 32768;
        play(id, floats, 16000, volume);
      } catch { /* Ignore malformed audio without interrupting gameplay. */ }
    },
  };
}
