import {randomUUID} from 'node:crypto';
import chairs from '../shared/chairs.json' with {type: 'json'};
import {AI_PLAYER} from './ai-chat.mjs';
import {UNO_COLORS} from './uno.mjs';

// Every table game needs two people, and a new player usually arrives to a city with one in
// it. So when somebody has waited alone in an UNO lobby, Ah Meng pulls up a chair.
//
// He is a client that happens to live in this process. His socket receives exactly what a
// browser would (his own hand, never anybody else's), and everything he does goes through the
// same lobby and game handlers as a message from a browser. The engine cannot tell him from
// a person, so there is nothing for him to cheat with and nothing in uno.mjs that knows he
// exists. His name says what he is.
// ponytail: UNO only. Poker next if first_game in the funnel shows people play him.

// Long enough for a friend to walk over first; short enough that a stranger does not give up.
export const WAIT_MS = 6000;
// A person looks at their hand before they play. So does he.
const THINK_MS = 1400;
const LOOK = {gender: 'male', hairstyle: 'short', hair: '#202c2b', skin: '#cf986c', shirt: '#62876b', trousers: '#253a40'};

export function createHouseBots({tableLobby, uno, now = Date.now, changed = () => {}, maxPlayers = 100}) {
  // What each bot has been told, kept beside the player rather than on it: the player object
  // is what the room snapshot broadcasts, and his hand has no business in it.
  const minds = new Map();
  const alone = new WeakMap();

  function sit(players, tableId) {
    const taken = new Set([...players.values()].map(player => player.chairId));
    const chair = chairs.find(candidate => candidate.tableId === tableId && !taken.has(candidate.id));
    if (!chair || players.size >= maxPlayers) return;
    const id = `bot-${randomUUID()}`, mind = {lobby: null, view: null, key: '', actAt: 0};
    const ws = {readyState: 1, bufferedAmount: 0, close() {}, send(data) {
      // The room snapshot arrives twenty times a second. Only two messages are worth parsing.
      if (typeof data !== 'string' || !(data.startsWith('{"type":"uno-state"') || data.startsWith('{"type":"lobby-state"'))) return;
      const message = JSON.parse(data);
      if (message.type === 'uno-state') mind.view = message.game; else mind.lobby = message.lobby;
    }};
    const bot = {id, ws, name: AI_PLAYER.name, bot: true, guest: true, gameMaster: false, userId: null, accessories: [], muted: false,
      appearance: LOOK, color: '#72c8ba', x: chair.x, z: chair.z, y: chair.y || 0, yaw: chair.yaw, riding: false, vehicle: 'bike', passengerOf: null, seatIndex: null,
      speed: 0, liftId: null, jumpHeight: 0, seated: true, chairId: chair.id, resting: null, restSpotId: null,
      mic: false, speaker: false, deflate: false, opus: false, supermanUntil: 0, updatedAt: now()};
    minds.set(id, mind); players.set(id, bot);
    tableLobby.handle(players, bot, {type: 'lobby-join', game: 'uno'});
    tableLobby.handle(players, bot, {type: 'lobby-ready', ready: true});
    changed(players);
  }

  function leave(players, bot) {
    uno.handle(players, bot, {type: 'uno-leave'});
    tableLobby.remove(players, bot);
    players.delete(bot.id); minds.delete(bot.id);
    changed(players);
  }

  function play(players, bot, mind) {
    const view = mind.view;
    const mine = view?.phase === 'playing' && view.turn === bot.id;
    // If a host leaves mid-match the engine may hand him the job, and the next round waits on it.
    const deal = view?.phase === 'round-over' && view.host === bot.id;
    if (!mine && !deal) return;
    const key = `${view.id}:${view.revision}`;
    if (mind.key !== key) { mind.key = key; mind.actAt = now() + THINK_MS; return; }
    if (now() < mind.actAt) return;
    mind.actAt = now() + THINK_MS;
    const act = message => uno.handle(players, bot, {gameId: view.id, revision: view.revision, ...message});
    if (deal) { act({type: 'uno-start'}); return; }
    if (!view.playable.length) { act({type: view.drawn ? 'uno-pass' : 'uno-draw'}); return; }
    const options = view.playable.map(cardId => view.hand.find(card => card.id === cardId));
    // Wild cards fit anything, so they are kept for when nothing else does.
    const card = options.find(option => option.color !== 'wild') || options[0];
    const held = color => view.hand.filter(other => other.color === color).length;
    const color = [...UNO_COLORS].sort((a, b) => held(b) - held(a))[0];
    act({type: 'uno-play', cardId: card.id, color, uno: true});
  }

  function tick(players) {
    for (const bot of [...players.values()]) {
      if (!bot.bot) continue;
      const mind = minds.get(bot.id), lobby = mind?.lobby;
      // Nobody left to play with: he gives the chair back rather than play himself.
      if (!lobby || !lobby.members.some(member => players.has(member.id) && !players.get(member.id).bot)) { leave(players, bot); continue; }
      // Main lagi resets everybody's sedia, his included.
      if (lobby.phase === 'lobby' && !lobby.members.find(member => member.id === bot.id)?.ready) tableLobby.handle(players, bot, {type: 'lobby-ready', ready: true});
      play(players, bot, mind);
    }
    if (!alone.has(players)) alone.set(players, new Map());
    const since = alone.get(players), waiting = new Set();
    for (const [tableId, lobbies] of Object.entries(tableLobby.summary(players))) {
      for (const lobby of lobbies) {
        if (lobby.game !== 'uno' || lobby.phase !== 'lobby' || lobby.members.length !== 1 || players.get(lobby.members[0].id)?.bot) continue;
        waiting.add(tableId);
        if (!since.has(tableId)) since.set(tableId, now());
        else if (now() - since.get(tableId) >= WAIT_MS) { since.delete(tableId); waiting.delete(tableId); sit(players, tableId); }
      }
    }
    for (const tableId of [...since.keys()]) if (!waiting.has(tableId)) since.delete(tableId);
  }

  return {tick};
}
