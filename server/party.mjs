import {randomUUID} from 'node:crypto';

// This is the social Geng used for group chat, group voice and the red minimap marker.
// It is deliberately separate from a table lobby: being in a Geng never grants a seat or
// bypasses a game's min/max rules.
export const PARTY_LIMIT = 6;
export const INVITE_TTL = 60000;
export const RECONNECT_GRACE = 30000;

const canonical = type => type.startsWith('geng-') ? `party-${type.slice(5)}` : type;
const memberKey = player => player?.userId || player?.id || '';

export function createParty(send, now = Date.now) {
  const registries = new WeakMap();
  const registry = players => {
    if (!registries.has(players)) registries.set(players, {parties: new Map(), invites: new Map()});
    return registries.get(players);
  };
  const partyOf = (players, player) => player?.partyId ? registry(players).parties.get(player.partyId) : undefined;

  function view(players, party) {
    const members = [];
    for (const id of party.members) {
      const member = players.get(id);
      if (!member) continue;
      members.push({
        id: member.id,
        name: member.name,
        connected: true,
        reconnecting: false,
        leader: memberKey(member) === party.leaderKey,
      });
    }
    for (const record of party.offline.values()) {
      members.push({
        id: '',
        name: record.name,
        connected: false,
        reconnecting: true,
        reconnectUntil: record.until,
        leader: record.key === party.leaderKey,
      });
    }
    const leader = members.find(member => member.leader)?.id || party.leaderKey;
    return {id: party.id, leader, leaderKey: party.leaderKey, members};
  }

  function publish(players, party) {
    const payload = view(players, party);
    for (const id of party.members) {
      const member = players.get(id);
      if (member) send(member.ws, {type: 'party-state', party: payload, geng: payload});
    }
  }

  function chooseLeader(players, party) {
    const connected = [...party.members].map(id => players.get(id)).filter(Boolean);
    const next = connected[0] || [...party.offline.values()][0];
    if (next) party.leaderKey = memberKey(next) || next.key;
  }

  // A deliberate leave is permanent. This is also kept as the public `remove` method for
  // the small unit tests and older callers; transient sockets use `disconnect` below.
  function drop(players, player) {
    const party = partyOf(players, player);
    const key = memberKey(player);
    player.partyId = null;
    if (!party) return;
    party.members.delete(player.id);
    party.offline.delete(key);
    send(player.ws, {type: 'party-state', party: null, geng: null});
    if (!party.members.size && !party.offline.size) {
      registry(players).parties.delete(party.id);
      return;
    }
    if (party.leaderKey === key) chooseLeader(players, party);
    publish(players, party);
  }

  function join(players, party, player) {
    if (party.members.size + party.offline.size >= PARTY_LIMIT) return false;
    party.offline.delete(memberKey(player));
    party.members.add(player.id);
    player.partyId = party.id;
    publish(players, party);
    return true;
  }

  function denied(player, code, message) {
    // `notice` is understood by every shipped client. The structured event gives newer
    // clients a stable reason without making the explanation depend on a UI translation.
    send(player.ws, {type: 'notice', code, message});
    send(player.ws, {type: 'geng-action-denied', code, message});
  }

  return {
    shares(a, b) {
      return !!a?.partyId && !!b?.partyId && a.partyId === b.partyId && a.id !== b.id;
    },
    members(players, player) {
      const party = partyOf(players, player);
      return party ? [...party.members].map(id => players.get(id)).filter(Boolean) : [];
    },
    leader(players, player) {
      const party = partyOf(players, player);
      return !!party && party.leaderKey === memberKey(player);
    },
    state(players, player) {
      const party = partyOf(players, player);
      return party ? view(players, party) : null;
    },
    // Called when a socket closes unexpectedly. Logged-in accounts can reclaim this slot
    // from the same room for thirty seconds; guests have no stable identity to resume.
    disconnect(players, player) {
      const party = partyOf(players, player);
      if (!party) return false;
      if (!player.userId) { drop(players, player); return false; }
      party.members.delete(player.id);
      player.partyId = null;
      party.offline.set(memberKey(player), {key: memberKey(player), name: player.name, until: now() + RECONNECT_GRACE});
      publish(players, party);
      return true;
    },
    // Rejoin after a transport failure. This only runs after the new player is in the same
    // room map, so a reconnect cannot carry a Geng across rooms or into another city.
    reconnect(players, player) {
      if (!player?.userId || player.partyId) return false;
      const key = memberKey(player);
      const {parties} = registry(players);
      for (const party of parties.values()) {
        const record = party.offline.get(key);
        if (!record) continue;
        if (now() >= record.until) { party.offline.delete(key); continue; }
        party.offline.delete(key);
        party.members.add(player.id);
        player.partyId = party.id;
        publish(players, party);
        return true;
      }
      return false;
    },
    // Expiry is driven by the room timer rather than by a browser. That keeps the status in
    // the panel correct even when the last remaining member is tabbed away.
    tick(players) {
      const {parties, invites} = registry(players);
      const current = now();
      for (const party of [...parties.values()]) {
        let changed = false;
        for (const [key, record] of party.offline) {
          if (current < record.until) continue;
          party.offline.delete(key);
          if (party.leaderKey === key) chooseLeader(players, party);
          changed = true;
        }
        if (!party.members.size && !party.offline.size) { parties.delete(party.id); continue; }
        if (changed && party.members.size) publish(players, party);
      }
      for (const [id, invite] of invites) if (current - invite.at > INVITE_TTL) invites.delete(id);
      return parties.size > 0;
    },
    hasPending(players) {
      return [...registry(players).parties.values()].some(party => party.offline.size > 0);
    },
    remove(players, player) { drop(players, player); },
    // Returns 'changed' when membership moved, so the caller only re-broadcasts the room
    // snapshot when there is something new in it. `party-*` remains accepted as a wire alias
    // so old clients keep working while the product language calls the group a Geng.
    handle(players, player, message) {
      if (typeof message.type !== 'string') return false;
      const type = canonical(message.type);
      if (!type.startsWith('party-')) return false;
      const before = player.partyId;
      const result = route(players, player, {...message, type});
      return result === 'changed' || before !== player.partyId ? 'changed' : true;
    },
  };

  function route(players, player, message) {
    const {parties, invites} = registry(players);

    if (message.type === 'party-invite') {
      const invitee = typeof message.id === 'string' ? players.get(message.id) : undefined;
      if (!invitee) { denied(player, 'GENG_MEMBER_NOT_FOUND', 'That player is no longer in the city.'); return true; }
      if (invitee.id === player.id) { denied(player, 'GENG_SELF_INVITE', 'You cannot invite yourself to a Party.'); return true; }
      if (invitee.partyId) { denied(player, 'GENG_ALREADY_MEMBER', 'That player is already in a Party.'); return true; }
      const party = partyOf(players, player);
      // A solo player may start a Geng by inviting the first member. Once it exists, only
      // its leader can grow it further.
      if (party && party.leaderKey !== memberKey(player)) { denied(player, 'GENG_LEADER_ONLY', 'Only the Party leader can invite members.'); return true; }
      if (party && party.members.size + party.offline.size >= PARTY_LIMIT) { denied(player, 'GENG_FULL', 'Your Party is full.'); return true; }
      invites.set(invitee.id, {from: player.id, fromKey: memberKey(player), at: now(), partyId: party?.id || null});
      send(invitee.ws, {type: 'party-invited', gengInvited: true, inviter: {id: player.id, name: player.name}});
      return true;
    }

    if (message.type === 'party-accept' || message.type === 'party-decline') {
      const invite = invites.get(player.id);
      if (!invite) { denied(player, 'GENG_INVITE_MISSING', 'That Party invitation has expired or was withdrawn.'); return true; }
      invites.delete(player.id);
      if (message.type === 'party-decline') return true;
      if (now() - invite.at > INVITE_TTL) { denied(player, 'GENG_INVITE_EXPIRED', 'That Party invitation has expired.'); return true; }
      if (player.partyId) { denied(player, 'GENG_ALREADY_MEMBER', 'Leave your current Party before joining another one.'); return true; }

      const host = players.get(invite.from);
      if (!host || memberKey(host) !== invite.fromKey) { denied(player, 'GENG_INVITE_STALE', 'The Party invitation is no longer valid.'); return true; }
      const existing = invite.partyId ? parties.get(invite.partyId) : undefined;
      if (existing) {
        if (existing.leaderKey !== invite.fromKey || host.partyId !== existing.id || !existing.members.has(host.id)) {
          denied(player, 'GENG_INVITE_STALE', 'The Party invitation changed because the Party leader changed.'); return true;
        }
        if (!join(players, existing, player)) denied(player, 'GENG_FULL', 'That Party is full.');
        return true;
      }
      if (invite.partyId || host.partyId) { denied(player, 'GENG_INVITE_STALE', 'The Party invitation is no longer valid.'); return true; }

      const party = {id: randomUUID(), leaderKey: memberKey(host), members: new Set([host.id]), offline: new Map()};
      parties.set(party.id, party);
      host.partyId = party.id;
      player.partyId = party.id;
      party.members.add(player.id);
      publish(players, party);
      return 'changed';
    }

    if (message.type === 'party-leave') { drop(players, player); return 'changed'; }
    return true;
  }
}
