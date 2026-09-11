// Gate silence before WebRTC's Opus encoder. A 60ms pre-roll and 240ms hangover
// preserve quiet consonants and pauses; noise-floor adaptation is deliberately slow.
class VoiceGate extends AudioWorkletProcessor {
  constructor(){super();this.delay=new Float32Array(Math.ceil(sampleRate*.06));this.cursor=0;this.until=0;this.at=0;this.noise=.001;}
  process(inputs,outputs){
    const input=inputs[0]?.[0],output=outputs[0]?.[0];if(!output)return true;
    let energy=0;for(const value of input||[])energy+=value*value;
    const rms=Math.sqrt(energy/Math.max(1,input?.length||0));
    const threshold=Math.max(.004,Math.min(.02,this.noise*2.5));
    if(rms>threshold)this.until=this.at+sampleRate*.24;
    else this.noise=this.noise*.999+rms*.001;
    for(let i=0;i<output.length;i++){
      const delayed=this.delay[this.cursor];this.delay[this.cursor]=input?.[i]||0;
      this.cursor=(this.cursor+1)%this.delay.length;output[i]=this.at<this.until?delayed:0;this.at++;
    }
    return true;
  }
}
registerProcessor('voice-gate',VoiceGate);
