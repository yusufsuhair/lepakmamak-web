export type InkLine=[number,number,number,number,string,number,number];
type BoardState={id?:string;round:number;boardVersion?:number;lastBatch?:number;nextStroke?:number;lines?:InkLine[]};
export function createLukisBoard(canvas:HTMLCanvasElement,send:(message:object)=>boolean,issue:(text:string)=>void){
 const context=canvas.getContext('2d',{willReadFrequently:true})!;
 // Fixed logical space makes drawings identical at every screen size; render at 2x.
 canvas.width=1280;canvas.height=800;context.scale(2,2);
 let state:BoardState|null=null,enabled=false,color='#20382e',width=7,stroke=0,seq=0,pointer:number|null=null,previous:number[]|null=null,frame=0;
 let committed:InkLine[]=[],queued:InkLine[]=[];
 const pending=new Map<number,InkLine[]>();
 function draw(line:InkLine){context.save();context.globalCompositeOperation=line[4]==='#ffffff'?'destination-out':'source-over';context.strokeStyle=context.fillStyle=line[4];context.lineWidth=line[5];context.lineCap='round';context.lineJoin='round';context.beginPath();if(line[0]===line[2]&&line[1]===line[3]){context.arc(line[0]*640,line[1]*400,line[5]/2,0,Math.PI*2);context.fill();}else{context.moveTo(line[0]*640,line[1]*400);context.lineTo(line[2]*640,line[3]*400);context.stroke();}context.restore();}
 function repaint(){context.clearRect(0,0,640,400);committed.forEach(draw);for(const lines of pending.values())lines.forEach(draw);queued.forEach(draw);}
 function flush(){cancelAnimationFrame(frame);frame=0;if(!state||!enabled){queued=[];return;}while(queued.length){const lines=queued.splice(0,24),batch=++seq;pending.set(batch,lines);if(!send({type:'lukis-ink',gameId:state.id,round:state.round,boardVersion:state.boardVersion||0,seq:batch,lines})){pending.delete(batch);queued=[];issue('Sambungan terputus. Sambung semula untuk melukis.');repaint();break;}}}
 function finish(){flush();const captured=pointer;pointer=null;previous=null;if(captured!==null&&canvas.hasPointerCapture(captured))canvas.releasePointerCapture(captured);}
 function add(next:number[]){if(!previous)return;if(next[0]===previous[0]&&next[1]===previous[1])return;const line:InkLine=[previous[0],previous[1],next[0],next[1],color,width,stroke];queued.push(line);draw(line);previous=next;if(!frame)frame=requestAnimationFrame(flush);}
 const point=(e:PointerEvent)=>{const rect=canvas.getBoundingClientRect();return [e.clientX-rect.left,e.clientY-rect.top].map((n,i)=>Math.round(Math.max(0,Math.min(1,n/(i?rect.height:rect.width)))*10000)/10000);};
 canvas.addEventListener('pointerdown',e=>{if(!enabled||pointer!==null||e.button!==0)return;e.preventDefault();canvas.focus({preventScroll:true});pointer=e.pointerId;stroke++;canvas.setPointerCapture(pointer);previous=point(e);const dot:InkLine=[previous[0],previous[1],previous[0],previous[1],color,width,stroke];queued.push(dot);draw(dot);frame=requestAnimationFrame(flush);});
 canvas.addEventListener('pointermove',e=>{if(!enabled||pointer!==e.pointerId)return;e.preventDefault();const samples=e.getCoalescedEvents?.();for(const sample of samples?.length?samples:[e])add(point(sample));});
 canvas.addEventListener('pointerup',e=>{if(pointer!==e.pointerId)return;add(point(e));finish();});
 canvas.addEventListener('pointercancel',e=>{if(pointer===e.pointerId)finish();});canvas.addEventListener('lostpointercapture',e=>{if(pointer===e.pointerId)finish();});
 return {finish,tool(nextColor:string,nextWidth:number){finish();color=nextColor;width=nextWidth;canvas.dataset.tool=color==='#ffffff'?'eraser':'brush';},
  configure(next:BoardState|null,canDraw:boolean){const stopped=enabled&&!canDraw;const reset=!next||!state||next.id!==state.id||next.round!==state.round||next.boardVersion!==state.boardVersion;if(reset||!canDraw&&enabled){cancelAnimationFrame(frame);frame=0;queued=[];pending.clear();const old=pointer;pointer=null;previous=null;if(old!==null&&canvas.hasPointerCapture(old))canvas.releasePointerCapture(old);if(reset)committed=[];seq=next?.lastBatch||0;stroke=next?.nextStroke||0;}enabled=canDraw;state=next;canvas.style.touchAction=canDraw?'none':'pan-y';canvas.setAttribute('aria-disabled',String(!canDraw));if(!next){repaint();return;}seq=Math.max(seq,next.lastBatch||0);if(pointer===null)stroke=Math.max(stroke,next.nextStroke||0);if(Array.isArray(next.lines)){committed=[...next.lines];for(const n of pending.keys())if(n<=(next.lastBatch||0))pending.delete(n);}if(reset||stopped||Array.isArray(next.lines))repaint();},
  receive(message:{gameId:string;round:number;boardVersion:number;seq:number;lines:InkLine[]}){if(!state||message.gameId!==state.id||message.round!==state.round||message.boardVersion!==(state.boardVersion||0))return;const local=pending.delete(message.seq);committed.push(...message.lines);if(!local)message.lines.forEach(draw);},
  legacy(line:InkLine){committed.push(line);draw(line);}
 };
}
