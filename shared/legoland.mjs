import layout from './legoland.json' with {type:'json'};
export const parkAttractions=layout.attractions;
export const automated=a=>['coaster','boat','slide','tower','spin'].includes(a.kind);
export const toParkWorld=(x,z)=>({x:-350+z,z:-x});
export const toParkLocal=(x,z)=>({x:-z,z:x+350});
export const rideDuration=a=>a.id===0?60:a.kind==='slide'?18:26;
export function parkPose(a,progress){const t=Math.max(0,Math.min(1,progress))*Math.PI*2;let x=a.x+Math.sin(t)*9,z=a.z+Math.cos(t)*7,y=1.2;
 if(a.id===0){x=25+Math.sin(t)*140;z=122+(Math.cos(t)-1)*125;}
 if(a.kind==='coaster')y=3+Math.pow((1-Math.cos(t))/2,2)*15+Math.sin(t*3)*1.4;
 if(a.kind==='slide')y=1+(1-progress)*18;
 if(a.kind==='tower'){x=a.x;z=a.z;y=1+Math.sin(progress*Math.PI)*23;}
 if(a.kind==='spin'){x=a.x+Math.sin(t)*7;z=a.z+Math.cos(t)*7;y=3;}
 return {...toParkWorld(x,z),y:y+1,yaw:Math.atan2(Math.cos(t)*9,-Math.sin(t)*7)+Math.PI/2};}
// These four entrances face away from the castle, pyramid and NINJAGO landmark.
export function parkExit(a){return {...toParkWorld(a.x,a.z+([9,10,19,28].includes(a.id)?-13:13)),y:0};}
