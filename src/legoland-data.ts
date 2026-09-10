import layout from '../shared/legoland.json';
export type RideKind = 'coaster'|'boat'|'tower'|'spin'|'drive'|'shoot'|'build'|'slide'|'explore';
export type Attraction={id:number;land:number;name:string;kind:RideKind;x:number;z:number};
export const lands=layout.lands;
export const attractions=layout.attractions as Attraction[];
export const instructions=layout.instructions as Record<RideKind,string>;
