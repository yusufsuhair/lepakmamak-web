import voiceConfig from '../shared/voice.json';

const micIcon = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/><path class="voice-off-slash" d="M3 3l18 18"/></svg>`;
const speakerIcon = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M11 4 6 8H3v8h3l5 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/><path class="voice-off-slash" d="M3 3l18 18"/></svg>`;
type VoiceMessage = { type: string; mic?: boolean; speaker?: boolean; audio?: string };
export function setupVoice(send: (message: VoiceMessage) => boolean) {
  const panel = document.createElement('aside'); panel.id = 'voice-panel'; panel.hidden = true;
  panel.innerHTML = `<div class="voice-buttons"><button id="voice-mic" type="button" aria-pressed="false" aria-label="Turn microphone on" title="Microphone off">${micIcon}</button><button id="voice-speaker" type="button" aria-pressed="false" aria-label="Turn speakers on" title="Speakers off">${speakerIcon}</button></div><strong id="voice-audience" hidden>No one nearby</strong><small id="voice-status" role="status">Voice connects when you enter the city</small>`;
  document.getElementById('hud')!.append(panel);
  panel.setAttribute('aria-label', 'Your character voice controls');
  panel.addEventListener('keydown', event => event.stopPropagation());
  panel.addEventListener('pointerdown', event => event.stopPropagation());
  const micButton = panel.querySelector<HTMLButtonElement>('#voice-mic')!;
  const speakerButton = panel.querySelector<HTMLButtonElement>('#voice-speaker')!;
  const status = panel.querySelector<HTMLElement>('#voice-status')!;
  const audience = panel.querySelector<HTMLElement>('#voice-audience')!;
  let online = false, mic = false, speaker = false, generation = 0, busy = false;
  let context: AudioContext | undefined, stream: MediaStream | undefined, input: MediaStreamAudioSourceNode | undefined, capture: AudioWorkletNode | undefined;
  let moduleReady: Promise<void> | undefined;
  let output: GainNode | undefined;
  const next = new Map<string, number>();
  const playing = new Set<AudioBufferSourceNode>();
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
  function announce() { send({ type: 'voice-state', mic, speaker }); render(); }
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
  function stopPlayback() { for (const source of playing) { source.stop(); source.disconnect(); } playing.clear(); next.clear(); }
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
        send({ type: 'voice-audio', audio: btoa(String.fromCharCode(...bytes)) });
      };
      input.connect(capture); capture.connect(ctx.destination); // Processor outputs silence.
      requested.getAudioTracks()[0].onended = () => { if (attempt === generation) { stopMic(); status.textContent = 'Microphone disconnected. Tap the microphone icon to retry.'; } };
      busy = false; mic = true; announce(); status.textContent = 'Mic live · Everyone with speakers on can hear you';
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
    receive(id: string, name: string, encoded: string, volume = 1) {
      if (!speaker || !context || context.state !== 'running' || !output || encoded.length !== 1708) return;
      try {
        const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0)); if (bytes.length !== 1280) return;
        const samples = new Int16Array(bytes.buffer); const buffer = context.createBuffer(1, 640, 16000);
        const floats = buffer.getChannelData(0); let energy = 0;
        for (let i = 0; i < samples.length; i++) { floats[i] = samples[i] / 32768 * Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0)); energy += floats[i] ** 2; }
        const now = context.currentTime;
        const start = Math.max(now + .02, next.get(id) ?? now + .08);
        if (start > now + .3) return; // Drop delayed packets instead of building an audio backlog.
        const source = context.createBufferSource(); source.buffer = buffer; source.connect(output);
        playing.add(source); source.onended = () => { playing.delete(source); source.disconnect(); };
        source.start(start); next.set(id, start + .04);
        if (energy / 640 > .0001) status.textContent = `${name} is talking`;
      } catch { /* Ignore malformed audio without interrupting gameplay. */ }
    },
  };
}
