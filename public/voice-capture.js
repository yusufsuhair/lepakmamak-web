// Mono PCM at 16 kHz, sent in 40 ms frames. Never connected to audible output.
class VoiceCapture extends AudioWorkletProcessor {
  constructor() { super(); this.frame = new Int16Array(640); this.index = 0; this.phase = 0; this.sum = 0; this.count = 0; }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input) for (const sample of input) {
      this.sum += sample; this.count++; this.phase += 16000;
      if (this.phase >= sampleRate) {
        this.phase -= sampleRate;
        this.frame[this.index++] = Math.max(-1, Math.min(1, this.sum / this.count)) * 32767;
        this.sum = 0; this.count = 0;
        if (this.index === 640) { this.port.postMessage(this.frame.buffer, [this.frame.buffer]); this.frame = new Int16Array(640); this.index = 0; }
      }
    }
    return true;
  }
}
registerProcessor('voice-capture', VoiceCapture);
