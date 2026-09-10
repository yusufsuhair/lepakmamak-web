import {randomUUID} from 'node:crypto';

export const PARTY_LIMIT = 6;
export const INVITE_TTL = 60000;

// Parties are session state, like rooms and seats: one registry per room, nothing stored.
// The player carries `partyId` so `snapshot()` hands membership to every client for free,
// which is what the map dots read.
//
// A party does not exist until somebody accepts. Creating one on invite would leave the
// inviter in a party of one — a red dot on their own map and a PARTY tab with nobody in it.
export function createParty(send, now = Date.now) {
  const registries = new WeakMap();
  const registry = players => {
    if (!registries.has(players)) registries.set(players, {parties: new Map(), invites: new Map()});
    return registries.get(players);
  };
  const partyOf = (players, player) => player?.partyId ? registry(players).parties.get(player.partyId) : undefined;

  function view(players, party) {
    const members = [...party.members]
      .map(id => players.get(id))
      .filter(Boolean)
      .map(member => ({id: member.id, name: member.name}));
    return {id: party.id, leader: party.leader, members};
  }

  function publish(players, party) {
    const payload = view(players, party);
    for (const id of party.members) {
      const member = players.get(id);
      if (member) send(member.ws, {type: 'party-state', party: payload});
    }
  }

  // Leaving and dropping out of the city both end here.
  function drop(players, player) {
    const party = partyOf(players, player);
    player.partyId = null;
    if (!party) return;
    party.members.delete(player.id);
    send(player.ws, {type: 'party-state', party: null});
    if (!party.members.size) { registry(players).parties.delete(party.id); return; }
    if (party.leader === player.id) party.leader = [...party.members][0];
    publish(players, party);
  }

  function join(players, party, player) {
    if (party.members.size >= PARTY_LIMIT) return;
    party.members.add(player.id);
    player.partyId = party.id;
    publish(players, party);
  }

  return {
    shares(a, b) { return !!a?.partyId && !!b?.partyId && a.partyId === b.partyId && a.id !== b.id; },
    members(players, player) {
      const party = partyOf(players, player);
      return party ? [...party.members].map(id => players.get(id)).filter(Boolean) : [];
    },
    remove(players, player) { drop(players, player); },
    // Returns 'changed' when membership moved, so the caller only re-broadcasts the room
    // snapshot when there is something new in it. An unknown party-* verb changes nothing
    // and must not be a free way to make the server fan out to everybody.
    handle(players, player, message) {
      if (typeof message.type !== 'string' || !message.type.startsWith('party-')) return false;
      const before = player.partyId;
      const result = route(players, player, message);
      return result === 'changed' || before !== player.partyId ? 'changed' : true;
    },
  };

  function route(players, player, message) {
      const {parties, invites} = registry(players);

      if (message.type === 'party-invite') {
        const invitee = typeof message.id === 'string' ? players.get(message.id) : undefined;
        // Same room only: someone in another room is simply not in this map.
        if (!invitee || invitee.id === player.id || invitee.partyId) return true;
        const party = partyOf(players, player);
        if (party && (party.leader !== player.id || party.members.size >= PARTY_LIMIT)) return true;
        invites.set(invitee.id, {from: player.id, at: now(), partyId: party?.id || null});
        send(invitee.ws, {type: 'party-invited', inviter: {id: player.id, name: player.name}});
        return true;
      }

      if (message.type === 'party-accept' || message.type === 'party-decline') {
        const invite = invites.get(player.id);
        if (!invite) return true;
        invites.delete(player.id);
        if (message.type === 'party-decline' || now() - invite.at > INVITE_TTL || player.partyId) return true;

        const host = players.get(invite.from);
        if (!host) return true;
        const existing = invite.partyId ? parties.get(invite.partyId) : undefined;
        // An invitation grants access only to the exact party and leader that issued it.
        // Leadership or membership changes invalidate the old invitation immediately.
        if (existing) {
          if (existing.leader !== host.id || host.partyId !== existing.id || !existing.members.has(host.id)) return true;
          join(players, existing, player); return true;
        }
        if (invite.partyId || host.partyId) return true;

        const party = {id: randomUUID(), leader: host.id, members: new Set([host.id, player.id])};
        parties.set(party.id, party);
        host.partyId = party.id; player.partyId = party.id;
        publish(players, party);
        return 'changed';
      }

      if (message.type === 'party-leave') { drop(players, player); return 'changed'; }
      return true;
  }
}
