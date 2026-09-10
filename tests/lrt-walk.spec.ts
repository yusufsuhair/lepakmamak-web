import {test,expect} from '@playwright/test';
import {COACH,clampCoach,riderPoint,passengerPoint,coachPoint,trainState,stations} from '../shared/lrt.mjs';
import {createLrt} from '../server/lrt.mjs';

test('you cannot walk through the walls of your coach',()=>{
 expect(clampCoach(0,0)).toEqual({along:0,across:0});
 expect(clampCoach(99,99)).toEqual({along:COACH.along,across:COACH.across});
 expect(clampCoach(-99,-99)).toEqual({along:-COACH.along,across:-COACH.across});
 // Coaches sit 12 apart, so the walkable length has to stay well inside that.
 expect(COACH.along*2).toBeLessThan(12);
 // Rubbish is standing still, not teleporting.
 for(const junk of ['x',null,undefined,NaN]) expect(clampCoach(junk,junk)).toEqual({along:0,across:0});
});

test('an untouched rider stands where their seat is',()=>{
 const now=1_000_000;
 for(const seat of [0,1,5,6,13,23]){
  const seated=passengerPoint(0,seat,now);
  const rider=riderPoint({lrtId:0,lrtSeat:seat},now);
  expect(rider.x).toBeCloseTo(seated.x,6);
  expect(rider.z).toBeCloseTo(seated.z,6);
  expect(rider.y).toBeCloseTo(seated.y,6);
 }
});

test('walking moves you within the carriage, not across the city',()=>{
 const now=1_000_000, seat=0;
 const seated=riderPoint({lrtId:0,lrtSeat:seat},now);
 const walked=riderPoint({lrtId:0,lrtSeat:seat,lrtAlong:COACH.along,lrtAcross:COACH.across},now);
 const moved=Math.hypot(walked.x-seated.x,walked.z-seated.z);
 expect(moved).toBeGreaterThan(1);
 // The whole carriage is about twelve metres; you cannot end up outside it.
 expect(moved).toBeLessThan(12);
 // Still on the rails and facing the way the train faces.
 expect(walked.y).toBeCloseTo(seated.y,6);
 expect(walked.yaw).toBeCloseTo(seated.yaw,6);
 // And it is the same carriage, wherever the train happens to be.
 const later=riderPoint({lrtId:0,lrtSeat:seat,lrtAlong:COACH.along,lrtAcross:0},now+40_000);
 const coach=coachPoint(0,0,0,0,now+40_000);
 expect(Math.hypot(later.x-coach.x,later.z-coach.z)).toBeLessThanOrEqual(COACH.along+.01);
});

test('the server clamps a rider who claims to be somewhere else',()=>{
 const sent:any[]=[];
 const lrt=createLrt((_ws:any,m:any)=>sent.push(m));
 const players=new Map();
 const rider:any={id:'a',ws:{},lrtId:0,lrtSeat:0,x:0,z:0,yaw:0};
 players.set('a',rider);

 expect(lrt.handle(players,rider,{type:'lrt-walk',along:999,across:999},1_000_000)).toBe(true);
 expect(rider.lrtAlong).toBe(COACH.along);
 expect(rider.lrtAcross).toBe(COACH.across);
 // The clamped spot is where the server then says the rider is.
 const expected=riderPoint(rider,1_000_000);
 expect(rider.x).toBeCloseTo(expected.x,6);
 expect(rider.z).toBeCloseTo(expected.z,6);

 // Not aboard, not walking.
 const walker:any={id:'b',ws:{},lrtId:null};
 expect(lrt.handle(players,walker,{type:'lrt-walk',along:1,across:1},1_000_000)).toBe(true);
 expect(walker.lrtAlong).toBeUndefined();
});

test('boarding seats you and leaving forgets where you stood',()=>{
 const sent:any[]=[];
 const lrt=createLrt((_ws:any,m:any)=>sent.push(m));
 const players=new Map();
 // Somewhere on the line where a train is stopped with its doors open.
 let now=0, station=-1;
 for(let t=0;t<600_000;t+=500){const s=trainState(0,t);if(s.doors){now=t;station=s.station;break;}}
 expect(station).toBeGreaterThanOrEqual(0);
 const player:any={id:'a',ws:{},x:stations[station].x,z:stations[station].z,riding:false,jumpHeight:0};
 players.set('a',player);
 lrt.handle(players,player,{type:'lrt-board',station:stations[station].id,train:0},now);
 expect(player.lrtId).toBe(0);
 expect(player.lrtAlong).toBeNull();

 lrt.handle(players,player,{type:'lrt-walk',along:2,across:1},now);
 expect(player.lrtAlong).toBe(2);
 lrt.handle(players,player,{type:'lrt-exit'},now);
 expect(player.lrtId).toBeNull();
 expect(player.lrtAlong).toBeNull();
});
