export function setupChatSound(){
 let enabled=true,context:AudioContext|undefined,lastPop=0;
 try{enabled=localStorage.getItem('lepakmamak-chat-sound')!=='off';}catch{}
 const label=document.createElement('label');label.textContent='Chat sound';
 const input=document.createElement('input');input.type='checkbox';input.id='chat-sound-toggle';input.checked=enabled;label.append(input);document.querySelector('#pause .settings')!.append(label);
 input.onchange=()=>{enabled=input.checked;try{localStorage.setItem('lepakmamak-chat-sound',enabled?'on':'off');}catch{}};
 const unlock=()=>{try{context??=new AudioContext();void context.resume().catch(()=>{});}catch{}};
 document.addEventListener('pointerdown',unlock,{once:true});document.addEventListener('keydown',unlock,{once:true});
 return()=>{
  if(!enabled||context?.state!=='running'||performance.now()-lastPop<120)return;
  lastPop=performance.now();const now=context.currentTime,osc=context.createOscillator(),gain=context.createGain();
  osc.frequency.setValueAtTime(680,now);osc.frequency.exponentialRampToValueAtTime(1080,now+.045);osc.frequency.exponentialRampToValueAtTime(520,now+.13);
  gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.07,now+.008);gain.gain.exponentialRampToValueAtTime(.001,now+.16);
  osc.connect(gain);gain.connect(context.destination);osc.start(now);osc.stop(now+.18);osc.onended=()=>{osc.disconnect();gain.disconnect();};
 };
}
