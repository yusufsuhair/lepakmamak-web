import {test, expect} from '@playwright/test';
import {createParty} from '../server/party.mjs';
import {createTableLobby} from '../server/table-lobby.mjs';
import {createTableInvites, TABLE_INVITE_TTL} from '../server/table-invites.mjs';
import chairs from '../shared/chairs.json' with {type: 'json'};

type Socket = {readyState: number; id: string};
type Player = {id: string; userId?: string; name: string; ws: Socket; chairId?: string; x?: number; z?: number; partyId?: string | null};
const socket = (id: string): Socket => ({readyState: 1, id});
const seat = (tableId: string, index: number) => chairs.filter(chair => chair.tableId === tableId)[index];

test('Geng reconnects within thirty seconds, while an intentional leave stays final', () => {
  let clock = 1000;
  const sent: any[] = [];
  const party = createParty((ws: Socket, message: any) => sent.push({ws: ws.id, ...message}), () => clock);
  const players = new Map<string, Player>();
  const add = (id: string, userId: string, chairId?: string) => {
    const player: Player = {id, userId, name: id.toUpperCase(), ws: socket(id), chairId}; players.set(id, player); return player;
  };
  const leader = add('leader', 'user-leader', seat('meja-1', 0).id);
  const member = add('member', 'user-member', seat('meja-1', 1).id);
  party.handle(players, leader, {type: 'geng-invite', id: member.id});
  party.handle(players, member, {type: 'party-accept'});
  const gengId = leader.partyId;

  party.disconnect(players, member); players.delete(member.id);
  const reconnecting = sent.filter(message => message.ws === leader.id && message.type === 'party-state').at(-1).party;
  expect(reconnecting.members.find((entry: any) => entry.name === 'MEMBER')).toMatchObject({connected: false, reconnecting: true});

  const resumed = add('member-new', 'user-member', seat('meja-1', 1).id);
  expect(party.reconnect(players, resumed)).toBe(true);
  expect(resumed.partyId).toBe(gengId);
  expect(party.members(players, leader).map(player => player.id)).toEqual(['leader', 'member-new']);

  party.remove(players, resumed); players.delete(resumed.id);
  const afterLeave = add('member-again', 'user-member', seat('meja-1', 1).id);
  expect(party.reconnect(players, afterLeave)).toBe(false);
  expect(afterLeave.partyId).toBeFalsy();
});

function inviteRig() {
  let clock = 1000;
  const sent: any[] = [];
  const send = (ws: Socket, message: any) => sent.push({ws: ws.id, ...message});
  const party = createParty(send, () => clock);
  const players = new Map<string, Player>();
  const add = (id: string, chairId?: string) => {
    const player: Player = {id, name: id.toUpperCase(), ws: socket(id), chairId}; players.set(id, player); return player;
  };
  const a = add('a', seat('meja-1', 0).id);
  const b = add('b', seat('meja-1', 1).id);
  const c = add('c');
  const lobby = createTableLobby(send, {lukis: {}, poker: {}, uno: {}, werewolf: {}});
  lobby.handle(players, a, {type: 'lobby-join', game: 'lukis'});
  lobby.handle(players, b, {type: 'lobby-join', game: 'lukis'});
  party.handle(players, a, {type: 'party-invite', id: c.id});
  party.handle(players, c, {type: 'party-accept'});
  party.handle(players, a, {type: 'party-invite', id: b.id});
  party.handle(players, b, {type: 'party-accept'});
  const invites = createTableInvites(send, {party, tableLobby: lobby}, () => clock);
  return {get clock() { return clock; }, advance(value: number) { clock += value; }, sent, players, a, b, c, lobby, invites, add};
}

test('table invite includes authoritative game, table and capacity without seating the recipient', () => {
  const rig = inviteRig();
  rig.invites.handle(rig.players, rig.a, {type: 'table-invite', game: 'lukis', tableId: 'meja-1'});
  const message = rig.sent.find(entry => entry.ws === 'c' && entry.type === 'table-invited');
  expect(message.invite).toMatchObject({game: 'lukis', tableId: 'meja-1', tableName: 'Meja 1', occupied: 2, capacity: 4, available: 2});
  const inviteId = message.invite.id;

  rig.invites.handle(rig.players, rig.c, {type: 'table-invite-open', inviteId});
  expect(rig.sent.at(-1)).toMatchObject({ws: 'c', type: 'table-invite-opened', invite: {id: inviteId}});
  // Opening a link only returns a destination. No lobby or chair mutation happened.
  expect(rig.c.chairId).toBeUndefined();
  expect(rig.lobby.current(rig.players, rig.a, 'lukis', 'meja-1')?.members.map(member => member.id)).toEqual(['a', 'b']);
});

test('only the Geng leader can send a table invite', () => {
  const rig = inviteRig();
  rig.invites.handle(rig.players, rig.b, {type: 'table-invite', game: 'lukis', tableId: 'meja-1'});
  expect(rig.sent.at(-1)).toMatchObject({ws: 'b', type: 'table-invite-result', ok: false, code: 'GENG_LEADER_ONLY'});
});

test('a table invite reports full, changed and expired links instead of opening a wrong session', () => {
  const full = inviteRig();
  full.invites.handle(full.players, full.a, {type: 'table-invite', game: 'lukis', tableId: 'meja-1'});
  const fullId = full.sent.find(entry => entry.ws === 'c' && entry.type === 'table-invited').invite.id;
  full.add('d', seat('meja-1', 2).id);
  full.add('e', seat('meja-1', 3).id);
  full.invites.handle(full.players, full.c, {type: 'table-invite-open', inviteId: fullId});
  expect(full.sent.at(-1)).toMatchObject({ws: 'c', type: 'table-invite-result', ok: false, code: 'TABLE_FULL'});

  const changed = inviteRig();
  changed.invites.handle(changed.players, changed.a, {type: 'table-invite', game: 'lukis', tableId: 'meja-1'});
  const changedId = changed.sent.find(entry => entry.ws === 'c' && entry.type === 'table-invited').invite.id;
  changed.lobby.handle(changed.players, changed.a, {type: 'lobby-leave'});
  changed.invites.handle(changed.players, changed.c, {type: 'table-invite-open', inviteId: changedId});
  expect(changed.sent.at(-1)).toMatchObject({ws: 'c', type: 'table-invite-result', ok: false, code: 'GAME_CHANGED'});

  const ended = inviteRig();
  ended.invites.handle(ended.players, ended.a, {type: 'table-invite', game: 'lukis', tableId: 'meja-1'});
  const endedId = ended.sent.find(entry => entry.ws === 'c' && entry.type === 'table-invited').invite.id;
  ended.lobby.handle(ended.players, ended.a, {type: 'lobby-leave'});
  ended.lobby.handle(ended.players, ended.b, {type: 'lobby-leave'});
  ended.lobby.handle(ended.players, ended.a, {type: 'lobby-join', game: 'lukis'});
  ended.lobby.handle(ended.players, ended.b, {type: 'lobby-join', game: 'lukis'});
  ended.invites.handle(ended.players, ended.c, {type: 'table-invite-open', inviteId: endedId});
  expect(ended.sent.at(-1)).toMatchObject({ws: 'c', type: 'table-invite-result', ok: false, code: 'GAME_CHANGED'});

  const expired = inviteRig();
  expired.invites.handle(expired.players, expired.a, {type: 'table-invite', game: 'lukis', tableId: 'meja-1'});
  const expiredId = expired.sent.find(entry => entry.ws === 'c' && entry.type === 'table-invited').invite.id;
  expired.advance(TABLE_INVITE_TTL + 1);
  expired.invites.handle(expired.players, expired.c, {type: 'table-invite-open', inviteId: expiredId});
  expect(expired.sent.at(-1)).toMatchObject({ws: 'c', type: 'table-invite-result', ok: false, code: 'INVITE_EXPIRED'});
});
