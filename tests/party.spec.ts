import {test,expect} from '@playwright/test';
import {createParty} from '../server/party.mjs';

type Sent={ws:string;type:string;[key:string]:any};
const rig=()=>{
 const sent:Sent[]=[];
 const party=createParty((ws:any,message:any)=>sent.push({ws,...message}));
 const players=new Map<string,any>();
 const add=(id:string)=>{const p={id,name:id.toUpperCase(),ws:id,x:0,z:0};players.set(id,p);return p;};
 const last=(ws:string,type:string)=>[...sent].reverse().find(m=>m.ws===ws&&m.type===type);
 return {party,players,add,sent,last};
};

test('an invite becomes a party only once the other person accepts',()=>{
 const {party,players,add,last}=rig();
 const ali=add('ali'), mei=add('mei');
 party.handle(players,ali,{type:'party-invite',id:'mei'});
 expect(ali.partyId).toBeFalsy();
 expect(last('mei','party-invited')?.inviter.name).toBe('ALI');

 party.handle(players,mei,{type:'party-accept'});
 expect(mei.partyId).toBeTruthy();
 expect(ali.partyId).toBe(mei.partyId);
 expect(last('ali','party-state')?.party.leader).toBe('ali');
 expect(last('mei','party-state')?.party.members.map((m:any)=>m.id).sort()).toEqual(['ali','mei']);
});

test('declining leaves both people where they were',()=>{
 const {party,players,add}=rig();
 const ali=add('ali'), mei=add('mei');
 party.handle(players,ali,{type:'party-invite',id:'mei'});
 party.handle(players,mei,{type:'party-decline'});
 expect(mei.partyId).toBeFalsy();
 expect(ali.partyId).toBeFalsy();
});

test('only the leader invites, and never past six',()=>{
 const {party,players,add,last}=rig();
 const leader=add('leader');
 const names=['b','c','d','e','f','g'];
 for(const id of names){
  add(id);
  party.handle(players,leader,{type:'party-invite',id});
  party.handle(players,players.get(id),{type:'party-accept'});
 }
 const state=last('leader','party-state')!.party;
 expect(state.members).toHaveLength(6);
 expect(players.get('g').partyId).toBeFalsy();

 // A member is not a leader and cannot bring anyone else in.
 const outsider=add('outsider');
 party.handle(players,players.get('b'),{type:'party-invite',id:'outsider'});
 expect(last('outsider','party-invited')).toBeUndefined();
 expect(outsider.partyId).toBeFalsy();
});

test('a stale invite cannot be accepted an hour later',()=>{
 let clock=1_000_000;
 const sent:Sent[]=[];
 const party=createParty((ws:any,m:any)=>sent.push({ws,...m}),()=>clock);
 const players=new Map<string,any>();
 const ali={id:'ali',name:'ALI',ws:'ali'}, mei={id:'mei',name:'MEI',ws:'mei'};
 players.set('ali',ali);players.set('mei',mei);
 party.handle(players,ali,{type:'party-invite',id:'mei'});
 clock+=61_000;
 party.handle(players,mei,{type:'party-accept'});
 expect((mei as any).partyId).toBeFalsy();
});

test('the leader leaving hands the party on, and the last one out closes it',()=>{
 const {party,players,add,last}=rig();
 const ali=add('ali'), mei=add('mei');
 party.handle(players,ali,{type:'party-invite',id:'mei'});
 party.handle(players,mei,{type:'party-accept'});
 const partyId=ali.partyId;

 party.handle(players,ali,{type:'party-leave'});
 expect(ali.partyId).toBeFalsy();
 expect(mei.partyId).toBe(partyId);
 expect(last('mei','party-state')?.party.leader).toBe('mei');

 party.handle(players,mei,{type:'party-leave'});
 expect(mei.partyId).toBeFalsy();
 expect(last('mei','party-state')?.party).toBeNull();
});

test('dropping out of the city drops you out of the party',()=>{
 const {party,players,add,last}=rig();
 const ali=add('ali'), mei=add('mei');
 party.handle(players,ali,{type:'party-invite',id:'mei'});
 party.handle(players,mei,{type:'party-accept'});

 players.delete('mei');
 party.remove(players,mei);
 expect(mei.partyId).toBeFalsy();
 expect(last('ali','party-state')?.party.members.map((m:any)=>m.id)).toEqual(['ali']);
});

test('you cannot invite yourself, a stranger in another room, or someone already partied',()=>{
 const {party,players,add,last}=rig();
 const ali=add('ali'), mei=add('mei'), sara=add('sara');
 party.handle(players,ali,{type:'party-invite',id:'ali'});
 expect(ali.partyId).toBeFalsy();

 party.handle(players,ali,{type:'party-invite',id:'ghost'});
 expect(last('ghost','party-invited')).toBeUndefined();

 party.handle(players,ali,{type:'party-invite',id:'mei'});
 party.handle(players,mei,{type:'party-accept'});
 party.handle(players,sara,{type:'party-invite',id:'mei'});
 expect(mei.partyId).toBe(ali.partyId);
 expect(sara.partyId).toBeFalsy();
});

test('shares answers whether two players are in one party, for voice and chat to route by',()=>{
 const {party,players,add}=rig();
 const ali=add('ali'), mei=add('mei'), sara=add('sara');
 party.handle(players,ali,{type:'party-invite',id:'mei'});
 party.handle(players,mei,{type:'party-accept'});
 expect(party.shares(ali,mei)).toBe(true);
 expect(party.shares(ali,sara)).toBe(false);
 expect(party.shares(sara,sara)).toBe(false);
});
