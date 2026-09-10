import chairs from '../shared/chairs.json' with {type:'json'};

const tableForChair = new Map(chairs.map(chair => [chair.id, chair.tableId]));

// Minimums come from the games themselves; the lobby only decides when to let them start.
// Games that keep their own roster need every member joined before the deal, or the start
// lands on an empty village. Lukis and Poker build theirs from whoever is seated instead.
export const ROSTER_GAMES = {werewolf: true, uno: true};

export const LOBBY_RULES = {
  lukis: {min: 2, max: 8, scope: 'table'},
  poker: {min: 2, max: 3, scope: 'table'},
  uno: {min: 2, max: 4, scope: 'table'},
  werewolf: {min: 5, max: 9, scope: 'city'},
};
export const COUNTDOWN = 3000;
export const REACTIONS = ['😂', '👏', '🔥', '😱'];

// One ritual for every table game: sit, pick, sedia, three-two-one, play, run it back.
// The games keep their own in-play rules — the lobby just decides when `<game>-start` fires.
export function createTableLobby(send, games, now = Date.now) {
  const rooms = new WeakMap();
  const lobbies = players => {
    if (!rooms.has(players)) rooms.set(players, new Map());
    return rooms.get(players);
  };
  // Werewolf gathers the whole city; everything else gathers one table.
  const keyFor = (player, game) => LOBBY_RULES[game].scope === 'city' ? 'city' : tableForChair.get(player.chairId);

  const view = lobby => ({
    key: lobby.key, game: lobby.game, scope: LOBBY_RULES[lobby.game].scope,
    phase: lobby.phase, ends: lobby.ends, serverTime: now(),
    min: LOBBY_RULES[lobby.game].min, max: LOBBY_RULES[lobby.game].max,
    members: lobby.members.map(member => ({id: member.id, name: member.name, ready: member.ready})),
  });

  // tick() runs every 50ms, so publishing unconditionally would push twenty full states a
  // second at every seated player forever. Same guard tables.mjs uses: send only on change.
  // serverTime and a running countdown are excluded from the key, or nothing would ever match.
  const signature = lobby => JSON.stringify([lobby.phase, lobby.members.map(m => [m.id, m.name, m.ready])]);

  function publish(players, lobby, force = false) {
    const key = signature(lobby);
    if (!force && lobby.sent === key) return;
    lobby.sent = key;
    const payload = view(lobby);
    for (const member of lobby.members) {
      const player = players.get(member.id);
      if (player) send(player.ws, {type: 'lobby-state', lobby: payload});
    }
  }

  const forget = (players, lobby) => lobbies(players).delete(`${lobby.game}:${lobby.key}`);

  // Ready means ready: no host button, because a three-seat table does not need one.
  function settle(players, lobby) {
    const rule = LOBBY_RULES[lobby.game];
    const everyoneReady = lobby.members.length >= rule.min && lobby.members.every(member => member.ready);
    if (lobby.phase === 'lobby' && everyoneReady) { lobby.phase = 'countdown'; lobby.ends = now() + COUNTDOWN; }
    else if (lobby.phase === 'countdown' && !everyoneReady) { lobby.phase = 'lobby'; lobby.ends = 0; }
    publish(players, lobby);
  }

  function drop(players, player, lobby) {
    lobby.members = lobby.members.filter(member => member.id !== player.id);
    send(player.ws, {type: 'lobby-state', lobby: null});
    if (!lobby.members.length) { forget(players, lobby); return; }
    settle(players, lobby);
  }

  function start(players, lobby) {
    const game = games[lobby.game];
    if (!game) return;
    const seated = lobby.members.map(member => players.get(member.id)).filter(Boolean);
    if (!seated.length) return;
    if (ROSTER_GAMES[lobby.game]) {
      // Werewolf deals to an exact headcount, and its join gate caps at the current size,
      // which starts at 7. Setting the size after everyone had joined therefore turned away
      // members 8 and 9 and left start() waiting for a headcount that could never arrive —
      // silently, because the lobby had already flipped to 'playing'. The size only needs a
      // host, and the first join is what makes one, so it goes between.
      const [first, ...rest] = seated;
      game.handle(players, first, {type: `${lobby.game}-join`});
      if (lobby.game === 'werewolf') game.handle(players, first, {type: 'werewolf-size', size: seated.length});
      for (const player of rest) game.handle(players, player, {type: `${lobby.game}-join`});
    }
    game.handle(players, seated[0], {type: `${lobby.game}-start`});
  }

  const lobbyOf = (players, player) =>
    [...lobbies(players).values()].find(lobby => lobby.members.some(member => member.id === player.id));

  return {
    remove(players, player) {
      const lobby = lobbyOf(players, player);
      if (lobby) drop(players, player, lobby);
    },
    tick(players) {
      for (const lobby of [...lobbies(players).values()]) {
        // A table game belongs to the chairs: stand up and you are out of the ring.
        if (LOBBY_RULES[lobby.game].scope === 'table') {
          for (const member of [...lobby.members]) {
            const player = players.get(member.id);
            if (!player || tableForChair.get(player.chairId) !== lobby.key) {
              lobby.members = lobby.members.filter(entry => entry.id !== member.id);
              if (player) send(player.ws, {type: 'lobby-state', lobby: null});
            }
          }
          if (!lobby.members.length) { forget(players, lobby); continue; }
        }
        if (lobby.phase === 'countdown' && now() >= lobby.ends) {
          lobby.phase = 'playing'; lobby.ends = 0;
          start(players, lobby);
        }
        settle(players, lobby);
      }
    },
    handle(players, player, message) {
      if (typeof message.type !== 'string' || !message.type.startsWith('lobby-')) return false;
      const map = lobbies(players);

      if (message.type === 'lobby-join') {
        const game = message.game;
        if (!LOBBY_RULES[game]) return true;
        const key = keyFor(player, game);
        if (!key) { send(player.ws, {type: 'notice', message: 'Duduk di kerusi meja dahulu.'}); return true; }
        const previous = lobbyOf(players, player);
        if (previous) drop(players, player, previous);
        const id = `${game}:${key}`;
        const lobby = map.get(id) || {key, game, phase: 'lobby', ends: 0, members: []};
        map.set(id, lobby);
        if (lobby.members.length >= LOBBY_RULES[game].max) { send(player.ws, {type: 'notice', message: 'Meja ini dah penuh.'}); return true; }
        if (!lobby.members.some(member => member.id === player.id)) lobby.members.push({id: player.id, name: player.name, ready: false});
        settle(players, lobby);
        return true;
      }

      const lobby = lobbyOf(players, player);
      if (!lobby) return true;

      if (message.type === 'lobby-ready') {
        const member = lobby.members.find(entry => entry.id === player.id);
        if (member && lobby.phase !== 'playing') member.ready = message.ready === true;
        settle(players, lobby);
        return true;
      }
      if (message.type === 'lobby-leave') { drop(players, player, lobby); return true; }
      if (message.type === 'lobby-rematch') {
        lobby.phase = 'lobby'; lobby.ends = 0;
        for (const member of lobby.members) member.ready = false;
        settle(players, lobby);
        return true;
      }
      if (message.type === 'lobby-react') {
        if (!REACTIONS.includes(message.emoji)) return true;
        for (const member of lobby.members) {
          const peer = players.get(member.id);
          if (peer) send(peer.ws, {type: 'lobby-react', emoji: message.emoji, id: player.id, name: player.name});
        }
        return true;
      }
      return true;
    },
  };
}
