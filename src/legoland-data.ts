export type RideKind = 'coaster'|'boat'|'tower'|'spin'|'drive'|'shoot'|'build'|'slide'|'explore';
export const lands = [
 {name:'The Beginning',x:0,z:125,color:'#e54b36'},
 {name:'LEGO Technic',x:-95,z:90,color:'#e8ad22'},
 {name:'LEGO Kingdoms',x:-110,z:5,color:'#b84956'},
 {name:'Imagination',x:-85,z:-85,color:'#935fd0'},
 {name:'Land of Adventure',x:15,z:-110,color:'#c18e43'},
 {name:'LEGO City',x:110,z:-65,color:'#2876bc'},
 {name:'LEGO NINJAGO World',x:110,z:35,color:'#a93236'},
 {name:'MINILAND',x:0,z:0,color:'#4c9b68'},
 {name:'Water Park',x:220,z:0,color:'#23aabd'},
 {name:'SEA LIFE',x:115,z:125,color:'#245a9d'},
] as const;
// A playable, authored interpretation of the resort, not a survey-accurate park plan.
const entries: [number,string,RideKind][] = [
 [0,'LEGOLAND Express','boat'],[0,'The Big Shop · Brick Workshop','build'],
 [1,'The Great LEGO Race','coaster'],[1,'Technic Twister','spin'],[1,'Aquazone Wave Racers','boat'],[1,'LEGO Academy','build'],[1,'LEGO Mindstorms','build'],
 [2,'The Dragon','coaster'],[2,"Dragon’s Apprentice",'coaster'],[2,"Merlin’s Challenge",'spin'],[2,'Royal Joust','drive'],[2,"The Forestmen’s Hideout",'explore'],
 [3,'Observation Tower','tower'],[3,'Kids Power Tower','tower'],[3,'DUPLO Express','boat'],[3,'Build & Test','build'],[3,'Ferrari Build & Race','drive'],
 [4,'Dino Island','slide'],[4,'Lost Kingdom Adventure','shoot'],[4,'Beetle Bounce','tower'],[4,'Pharaoh’s Revenge','shoot'],
 [5,'Driving School','drive'],[5,'Junior Driving School','drive'],[5,'Boating School','boat'],[5,'Rescue Academy','shoot'],[5,'LEGO City Airport','spin'],[5,'The Shipyard','explore'],
 [6,'LEGO NINJAGO The Ride','shoot'],[6,'Cole’s Rock Climb','tower'],
 [7,'Amazing Malaysia','explore'],[7,'MINILAND Asia','explore'],[7,'MINILAND Singapore','explore'],[7,'Flower Garden','build'],
 [8,'Build-A-Raft River','boat'],[8,'LEGO Wave Pool','boat'],[8,'Joker Soaker','shoot'],[8,'LEGO Slide Racers','slide'],[8,'Splash ’N’ Swirl','slide'],[8,'Brick Blaster','slide'],[8,'Red Rush','slide'],[8,'Tidal Tube','slide'],[8,'Twin Chasers','slide'],[8,'DUPLO Splash Safari','boat'],[8,'Build-A-Boat','build'],
 [9,'Ocean Tunnel','explore'],[9,'Coral Reef','explore'],[9,'Malaysian Rainforest','explore'],
];
export const attractions = entries.map(([land,name,kind],id)=>{
 const zone=lands[land], count=entries.filter(e=>e[0]===land).length;
 const index=entries.slice(0,id).filter(e=>e[0]===land).length;
 const angle=index/count*Math.PI*2;
 const radius=land===8?42:count>2?24:18;
 return {id,land,name,kind,x:land===0?(id===0?25:-25):zone.x+Math.sin(angle)*radius,z:land===0?122:zone.z+Math.cos(angle)*radius};
});
export type Attraction = typeof attractions[number];
export const instructions:Record<RideKind,string>={
 coaster:'Naik coaster melalui selekoh dan bukit. Kumpul cop selepas satu pusingan.',
 boat:'Ikut perjalanan air atau kereta api mengelilingi tarikan.',
 tower:'Naik tinggi, nikmati panorama taman, kemudian turun semula.',
 spin:'Naik wahana berputar. Kamera kekal stabil untuk pandangan yang selesa.',
 drive:'Pandu dengan WASD / anak panah. Lalui semua checkpoint kuning mengikut turutan.',
 shoot:'Klik atau sentuh sasaran bercahaya. Dapatkan 8 hit dalam 30 saat.',
 build:'Letakkan 8 blok berwarna untuk membina model sendiri. Undo untuk ubah binaan.',
 slide:'Luncur dari menara melalui gelongsor berliku hingga ke kolam.',
 explore:'Cari 5 objek berkilau di sekitar tarikan. Dekati dan tekan Kutip.',
};
