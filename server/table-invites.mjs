import {randomUUID} from 'node:crypto';
import locations from '../shared/tables.json' with {type: 'json'};
import chairs from '../shared/chairs.json' with {type: 'json'};
import {tableOf, seatedWith} from './seating.mjs';
import {LOBBY_RULES} from './table-lobby.mjs';

export const TABLE_INVITE_TTL = 60000;

const tableById = new Map(locations.map(table => [table.id, table]));
const tableCapacity = tableId => chairs.filter(chair => chair.tableId === tableId).length;

function failure(send, player, code, message) {
  send(player.ws, {type: 'table-invite-result', ok: false, code, message});
  return true;
}

function context(players, tableLobby, player, game, tableId) {
  const table = tableById.get(tableId);
  const rule = LOBBY_RULES[game];
  const lobby = tableLobby.current(players, player, game, tableId);
  if (!table || !rule || !lobby) return null;
  const occupants = seatedWith(players, tableId);
  const capacity = tableCapacity(tableId);
  const physicalAvailable = Math.max(0, capacity - occupants.length);
  const gameAvailable = Math.max(0, lobby.max - lobby.members.length);
  return {table, rule, lobby, occupants, capacity, physicalAvailable, gameAvailable, available: Math.min(physicalAvailable, gameAvailable)};
}

function inviteView(record, current) {
  return {
    id: record.id,
    game: record.game,
    tableId: record.tableId,
    tableName: current.table.name,
    scope: current.rule.scope,
    phase: current.lobby.phase,
    lobbyId: current.lobby.lobbyId,
    min: current.lobby.min,
    max: current.lobby.max,
    occupied: current.occupants.length,
    capacity: current.capacity,
    available: current.available,
    expiresAt: record.expiresAt,
    inviter: {id: record.senderId, name: record.senderName},
  };
}

// A table invite is a one-shot, server-validated pointer to a current lobby. Opening it
// never calls lobby-join, lobby-ready, chair-sit or any other enrolment action.
export function createTableInvites(send, {party, tableLobby}, now = Date.now) {
  const registries = new WeakMap();
  const registry = players => {
    if (!registries.has(players)) registries.set(players, new Map());
    return registries.get(players);
  };

  function create(players, player, message) {
    const game = typeof message.game === 'string' ? message.game : '';
    const tableId = typeof message.tableId === 'string' ? message.tableId : tableOf(player);
    const current = context(players, tableLobby, player, game, tableId);
    if (!current) return failure(send, player, 'TABLE_CHANGED', 'This table lobby is no longer active. Open the table again and choose a current game.');
    if (current.lobby.phase === 'playing') return failure(send, player, 'GAME_STARTED', 'That game has already started. Wait for the next lobby.');
    if (tableOf(player) !== tableId) return failure(send, player, 'TABLE_CHANGED', 'Sit at that table before sending its invitation.');
    if (current.available <= 0) return failure(send, player, 'TABLE_FULL', 'That table or game is already full.');

    if (!party.leader(players, player)) return failure(send, player, 'GENG_LEADER_ONLY', 'Only the Geng leader can send table invitations.');
    const recipients = party.members(players, player).filter(member => member.id !== player.id && member.ws?.readyState === 1);
    if (!recipients.length) return failure(send, player, 'NO_GENG', 'Join a Geng with another player before sending a table invitation. You can still join the game yourself.');

    const invites = registry(players);
    let sent = 0;
    for (const recipient of recipients) {
      const id = randomUUID();
      const record = {
        id,
        senderId: player.id,
        senderName: player.name,
        recipientId: recipient.id,
        partyId: player.partyId,
        lobbyId: current.lobby.lobbyId,
        game,
        tableId,
        createdAt: now(),
        expiresAt: now() + TABLE_INVITE_TTL,
      };
      invites.set(id, record);
      send(recipient.ws, {type: 'table-invited', invite: inviteView(record, current)});
      sent++;
    }
    send(player.ws, {type: 'table-invite-result', ok: true, sent, message: `Table invitation sent to ${sent} Geng member${sent === 1 ? '' : 's'}.`});
    return true;
  }

  function open(players, player, message) {
    const id = typeof message.inviteId === 'string' ? message.inviteId : '';
    const invites = registry(players);
    const record = invites.get(id);
    if (!record || record.recipientId !== player.id) return failure(send, player, 'INVITE_EXPIRED', 'This table invitation has expired or is no longer yours.');
    invites.delete(id);
    if (now() >= record.expiresAt) return failure(send, player, 'INVITE_EXPIRED', 'This table invitation has expired. Ask the Geng member to send it again.');

    const sender = players.get(record.senderId);
    if (!sender || sender.partyId !== record.partyId || !party.shares(sender, player)) {
      return failure(send, player, 'INVITE_CHANGED', 'The sender is no longer in the same Geng. This invitation is closed.');
    }
    const current = context(players, tableLobby, sender, record.game, record.tableId);
    if (!current) return failure(send, player, 'GAME_CHANGED', 'The table changed game or its lobby ended. Open the table again for the current session.');
    if (current.lobby.lobbyId !== record.lobbyId) return failure(send, player, 'GAME_CHANGED', 'That table game ended. Open the table again for the current session.');
    if (current.lobby.phase === 'playing') return failure(send, player, 'GAME_STARTED', 'The invited game has already started. Wait for the next lobby.');
    const alreadyAtTable = tableOf(player) === record.tableId;
    if (current.available <= 0 && !alreadyAtTable) return failure(send, player, 'TABLE_FULL', 'The table is full now. Choose another open table.');

    const invite = inviteView(record, current);
    send(player.ws, {type: 'table-invite-opened', invite});
    return true;
  }

  return {
    handle(players, player, message) {
      if (message.type === 'table-invite') return create(players, player, message);
      if (message.type === 'table-invite-open') return open(players, player, message);
      return false;
    },
    remove(players, player) {
      const invites = registry(players);
      for (const [id, record] of invites) if (record.senderId === player.id || record.recipientId === player.id) invites.delete(id);
    },
    tick(players) {
      const invites = registry(players);
      const current = now();
      for (const [id, record] of invites) if (current >= record.expiresAt) invites.delete(id);
    },
  };
}
