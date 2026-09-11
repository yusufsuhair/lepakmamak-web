// Mono PCM at 16 kHz, sent in 40 ms frames. Never connected to audible output.
class VoiceCapture extends AudioWorkletProcessor {
  constructor() { super(); this.frame = new Int16Array(640); this.index = 0; this.phase = 0; this.sum = 0; this.count = 0; this.history=[]; this.hangover=0; this.noise=.001; }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input) for (const sample of input) {
      this.sum += sample; this.count++; this.phase += 16000;
      if (this.phase >= sampleRate) {
        this.phase -= sampleRate;
        this.frame[this.index++] = Math.max(-1, Math.min(1, this.sum / this.count)) * 32767;
        this.sum = 0; this.count = 0;
        if (this.index === 640) { let energy=0;for(const sample of this.frame)energy+=(sample/32768)**2;
          const rms=Math.sqrt(energy/640),threshold=Math.max(.004,Math.min(.02,this.noise*2.5));
          if(rms>threshold)this.hangover=6;else this.noise=this.noise*.99+rms*.01;
          const packet={buffer:this.frame.buffer,capturedAt:currentTime};
          if(this.hangover>0){for(const prior of this.history)this.port.postMessage(prior,[prior.buffer]);this.history=[];this.port.postMessage(packet,[packet.buffer]);this.hangover--;}
          else{this.history.push(packet);if(this.history.length>2)this.history.shift();} this.frame = new Int16Array(640); this.index = 0; }
      }
    }
    return true;
  }
}
registerProcessor('voice-capture', VoiceCapture);
