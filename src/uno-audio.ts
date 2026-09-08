// Short procedural card foley; no downloads or music licensing dependency.
export function createUnoAudio(){
 let context:AudioContext|null=null,master:GainNode|null=null,muted=false;
 try{muted=localStorage.getItem('lepak-uno-muted')==='true';}catch{}
 function unlock(){try{context??=new (window.AudioContext||(window as any).webkitAudioContext)();if(!master){master=context!.createGain();master.gain.value=muted?0:1;master.connect(context!.destination);}void context!.resume().catch(()=>{});}catch{}}
 function sound(kind:string){if(muted||context?.state!=='running')return;const audio=context;
  function swish(at:number,length=.07){const buffer=audio!.createBuffer(1,Math.ceil(audio!.sampleRate*length),audio!.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);const source=audio!.createBufferSource(),filter=audio!.createBiquadFilter(),gain=audio!.createGain();source.buffer=buffer;filter.type='highpass';filter.frequency.value=1500;gain.gain.setValueAtTime(.09,at);gain.gain.exponentialRampToValueAtTime(.001,at+length);source.connect(filter).connect(gain).connect(master!);source.start(at);}
  function note(frequency:number,at:number,length=.16){const oscillator=audio!.createOscillator(),gain=audio!.createGain();oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.001,at);gain.gain.exponentialRampToValueAtTime(.055,at+.012);gain.gain.exponentialRampToValueAtTime(.001,at+length);oscillator.connect(gain).connect(master!);oscillator.start(at);oscillator.stop(at+length);}
  const at=audio.currentTime;if(kind==='deal'){for(let i=0;i<7;i++)swish(at+i*.09);for(let i=0;i<7;i++)swish(at+.8+i*.24,.04);}else if(kind==='win'){[523,659,784,1046].forEach((f,i)=>note(f,at+i*.12,.3));}else if(kind==='uno'){[660,880,1100].forEach((f,i)=>note(f,at+i*.075));}else if(kind==='turn'){note(740,at,.1);note(930,at+.1,.12);}else if(kind==='catch'){swish(at);swish(at+.14);note(260,at,.2);}else swish(at);
 }
 return {unlock,sound,get muted(){return muted;},toggle(){muted=!muted;if(master)master.gain.value=muted?0:1;try{localStorage.setItem('lepak-uno-muted',String(muted));}catch{}return muted;}};
}
