export function createLukisAudio(){
 let audio:AudioContext|null=null,master:GainNode|null=null,muted=false;
 try{muted=localStorage.getItem('lepak-lukis-muted')==='true';}catch{}
 function unlock(){try{audio??=new(window.AudioContext||(window as any).webkitAudioContext)();if(!master){master=audio!.createGain();master.gain.value=muted?0:1;master.connect(audio!.destination);}void audio!.resume().catch(()=>{});}catch{}}
 function play(kind:'correct'|'turn'|'finish'){if(muted||audio?.state!=='running'||!master)return;const notes=kind==='correct'?[523,659,784]:kind==='finish'?[523,659,784,1046]:[659,880];notes.forEach((frequency,i)=>{const oscillator=audio!.createOscillator(),gain=audio!.createGain(),at=audio!.currentTime+i*.095;oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.001,at);gain.gain.exponentialRampToValueAtTime(.065,at+.018);gain.gain.exponentialRampToValueAtTime(.001,at+.25);oscillator.connect(gain).connect(master!);oscillator.start(at);oscillator.stop(at+.26);});}
 return {unlock,play,get muted(){return muted;},toggle(){muted=!muted;if(master)master.gain.value=muted?0:1;try{localStorage.setItem('lepak-lukis-muted',String(muted));}catch{}}};
}
