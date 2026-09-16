import './motion.css';
import './table-shell.css';
import {createPlayerFace} from './player-face';
import casualGames from '../shared/casual-games.json';

export type LobbyMember = {id: string; name: string; ready: boolean; appearance?: Record<string,string>};
export type LobbyState = {
  lobbyId?: string; key: string; game: string; scope: 'table' | 'city';
  phase: 'lobby' | 'countdown' | 'playing'; ends: number; serverTime: number;
  min: number; max: number; members: LobbyMember[];
};
export type Reaction = {emoji: string; name: string; id: string};
export type TableInviteRequest = {game: string; key: string; scope: 'table' | 'city'; max: number; available: number};

const REACTIONS = ['😂', '👏', '🔥', '😱'];
const TITLES: Record<string, string> = {lukis: 'Lukis Lah!', poker: 'Poker Kampung', uno: 'UNO Lepak', werewolf: 'Werewolf'};
for(const [id,game] of Object.entries(casualGames))TITLES[id]=game.title;

// One frame every table game sits inside: who is here, who is ready, the count-in,
// and the way back round again. The games render their own play inside `stage`.
export function createTableShell(send: (message: object) => boolean, inviteTable?: (request: TableInviteRequest) => boolean) {
  const root = document.createElement('section');
  root.className = 'table-shell'; root.hidden = true;
  root.innerHTML = `<header class="table-shell-head"><h3 id="table-game-name"></h3><p id="table-scope"></p></header>
    <div id="table-ring" class="table-ring"></div>
    <p id="table-hint" role="status"></p>
    <div id="table-countdown" hidden><strong></strong><small>Get ready…</small></div>
    <div class="table-actions"><button type="button" id="table-ready"></button><button type="button" id="table-rematch" hidden>Play again</button></div>
    <div class="table-reactions" role="group" aria-label="Reactions"></div>
    <div class="table-shell-stage"></div>`;

  const ring = root.querySelector<HTMLElement>('#table-ring')!;
  const hint = root.querySelector<HTMLElement>('#table-hint')!;
  const scopeLine = root.querySelector<HTMLElement>('#table-scope')!;
  const title = root.querySelector<HTMLElement>('#table-game-name')!;
  const readyButton = root.querySelector<HTMLButtonElement>('#table-ready')!;
  const rematchButton = root.querySelector<HTMLButtonElement>('#table-rematch')!;
  const countdown = root.querySelector<HTMLElement>('#table-countdown')!;
  const reactionBar = root.querySelector<HTMLElement>('.table-reactions')!;
  const stage = root.querySelector<HTMLElement>('.table-shell-stage')!;

  for (const emoji of REACTIONS) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = emoji;
    button.setAttribute('aria-label', `React ${emoji}`);
    button.onclick = () => send({type: 'lobby-react', emoji});
    reactionBar.append(button);
  }

  let lobby: LobbyState | null = null, self = '', anchored = 0, gengSize = 0, gengLeader = false;

  const mine = () => lobby?.members.find(member => member.id === self);

  readyButton.onclick = () => { if (lobby) send({type: 'lobby-ready', ready: !mine()?.ready}); };
  rematchButton.onclick = () => send({type: 'lobby-rematch'});

  function renderCountdown() {
    if (!lobby || lobby.phase !== 'countdown') { countdown.hidden = true; return; }
    countdown.hidden = false;
    const remaining = lobby.ends - lobby.serverTime - (performance.now() - anchored);
    countdown.querySelector('strong')!.textContent = String(Math.max(1, Math.ceil(remaining / 1000)));
  }

  function render() {
    root.hidden = !lobby;
    if (!lobby) return;
    const playing = lobby.phase === 'playing';
    title.textContent = TITLES[lobby.game] || lobby.game;
    // A city game must not pretend the four chairs at this table are the roster.
    scopeLine.textContent = lobby.scope === 'city'
      ? 'City lobby · all tables share this game'
      : `This table · ${lobby.members.length}/${lobby.max} players`;

    ring.hidden = playing;
    ring.replaceChildren();
    for (let index = 0; index < lobby.max; index++) {
      const member = lobby.members[index];
      const seat = document.createElement('div');
      seat.className = `table-seat ${member ? 'filled' : 'empty'}${member?.ready ? ' ready' : ''}${member?.id === self ? ' you' : ''}`;
      if (member) {
        const face = createPlayerFace(member, 'seat-face');
        const name = document.createElement('b'); name.textContent = member.name;
        // Not-ready was an empty element, which reads the same as "no information". Both
        // states say what they are now.
        const tick = document.createElement('i');
        tick.textContent = member.ready ? '✓ Ready' : 'Waiting…';
        tick.dataset.ready = String(!!member.ready);
        seat.append(face, name, tick);
      } else {
        // An empty seat can send a clickable invitation to the live Party. Being outside
        // a Party only disables this convenience; it never disables READY or game entry.
        const invite = document.createElement('button');
        invite.type = 'button'; invite.className = 'seat-invite';
        invite.textContent = '+ Invite Party';
        const canInvite = gengSize > 1 && gengLeader;
        invite.disabled = !canInvite;
        invite.title = gengSize < 2
          ? 'Party is optional. Join the game yourself, or join a Party to invite members.'
          : !gengLeader
            ? 'Only the Party leader can invite members.'
            : 'Send a clickable invitation for this game and table.';
        invite.onclick = () => {
          if (!lobby || !canInvite) return;
          // The fallback preserves the shell's standalone harness API. The live table
          // social module supplies inviteTable, which sends the authoritative invite verb.
          const sent = inviteTable
            ? inviteTable({game: lobby.game, key: lobby.key, scope: lobby.scope, max: lobby.max, available: Math.max(0, lobby.max - lobby.members.length)})
            : send({type: 'chat', channel: 'party', text: `Join ${TITLES[lobby.game] || lobby.game} at this table!`});
          if (!sent) return;
          invite.textContent = 'Invite sent ✓';
          window.setTimeout(() => { invite.textContent = '+ Invite Party'; }, 2500);
        };
        seat.append(invite);
      }
      ring.append(seat);
    }

    const short = Math.max(0, lobby.min - lobby.members.length);
    hint.hidden = playing;
    hint.textContent = playing ? ''
      : short ? `${short} more player${short === 1 ? '' : 's'} needed.`
      : lobby.phase === 'countdown' ? 'Everyone is ready.'
      : 'Press READY when you are ready.';

    readyButton.hidden = playing || lobby.phase === 'countdown';
    readyButton.textContent = mine()?.ready ? 'READY ✓' : 'READY';
    readyButton.classList.toggle('on', !!mine()?.ready);
    readyButton.disabled = short > 0;
    rematchButton.hidden = !playing;
    renderCountdown();
  }

  return {
    root, stage,
    get playing() { return lobby?.phase === 'playing'; },
    get game() { return lobby?.game || ''; },
    geng(size: number, leader: boolean) { gengSize = Math.max(0, size); gengLeader = leader; render(); },
    // Compatibility alias for older callers while the visible product language stays Party.
    // A non-empty legacy group is treated as leader-owned in old harnesses.
    party(size: number) { gengSize = Math.max(0, size); gengLeader = size > 0; render(); },
    state(value: LobbyState | null, selfId: string) {
      // Anchor the count-in to arrival, so it ticks down without a server round trip.
      if (value?.phase === 'countdown' && lobby?.phase !== 'countdown') anchored = performance.now();
      lobby = value; self = selfId; render();
    },
    tick() { renderCountdown(); },
    react(value: Reaction) {
      const bubble = document.createElement('span');
      bubble.className = 'table-reaction'; bubble.textContent = value.emoji;
      bubble.title = value.name;
      root.append(bubble);
      setTimeout(() => bubble.remove(), 2200);
    },
  };
}
