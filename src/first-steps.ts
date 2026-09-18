import chairs from '../shared/chairs.json';
import tables from '../shared/tables.json';
import {FIRST_STEPS, type GuideTarget} from './explore';

// A new player's first minute: walk to a free chair at the mamak, sit, open the table's
// games. It used to be a card of six paragraphs shown over the city before they had moved,
// and most never found the games it described. Now each step is said when it can be done,
// and the button that does it is the one lit up.
//
// The old card's key, on purpose: whoever already ticked "do not show again" is not walked
// through it, and the suite marks every origin but one with it (playwright.config.ts).
const KEY = 'lepakmamak-onboarded';
const seen = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const remember = () => { try { localStorage.setItem(KEY, '1'); } catch { /* Storage is optional. */ } };

const mamakChairs = chairs.filter(chair => chair.tableId.startsWith('meja-'));
const tableOf = new Map(chairs.map(chair => [chair.id, tables.find(table => table.id === chair.tableId)]));

type State = { position: {x: number; z: number}; seatedChairId: string | null; tableOpen: boolean; taken: (chairId: string) => boolean; reach: number };

export function createFirstSteps(options: { point: (target: GuideTarget | null, dismissed?: () => void) => void; touch: boolean; done: () => void }) {
  // Like the card before it, leaving halfway is not finishing: only opening a table's games,
  // or waving the guide off, stops it coming back on the next visit.
  let finished = seen();
  // One object per step, reused, so the guide can tell "same step" from "new step" by identity.
  const steps = new Map<string, GuideTarget>();
  const step = (key: string, make: () => Omit<GuideTarget, 'id'>) => { let found = steps.get(key); if (!found) { found = {id: FIRST_STEPS, ...make()}; steps.set(key, found); } return found; };
  const finish = () => { if (finished) return; finished = true; remember(); options.point(null); options.done(); };

  return {
    get active() { return !finished; },
    /** The table whose name is the thing to tap right now, if any. */
    tableId(seatedChairId: string | null) { return finished || !seatedChairId ? null : tableOf.get(seatedChairId)?.id || null; },
    update(state: State) {
      if (finished) return;
      if (state.tableOpen) { finish(); return; }
      const table = state.seatedChairId ? tableOf.get(state.seatedChairId) : null;
      if (table) {
        options.point(step(`table:${table.id}`, () => ({
          name: 'Jom main', marker: table.name, target: {x: table.x, y: 1, z: table.z},
          // UNO is the one to name: it is the game that can start with nobody else around
          // (server/house-bot.mjs), and a first visit is usually to a quiet city.
          hint: `${options.touch ? 'Tap' : 'Click'} ${table.name} above the table, pick UNO and press READY. Nobody around? Ah Meng will join you.`,
        })), finish);
        return;
      }
      // Seated somewhere that is not a game table (a bench, a sunbed): nothing to say yet.
      if (state.seatedChairId) { options.point(null); return; }
      let chair: typeof mamakChairs[number] | undefined, distance = Infinity;
      for (const candidate of mamakChairs) {
        const away = Math.hypot(candidate.x - state.position.x, candidate.z - state.position.z);
        if (away < distance && !state.taken(candidate.id)) { chair = candidate; distance = away; }
      }
      if (!chair) { options.point(null); return; }
      const near = distance < state.reach;
      options.point(step(`chair:${chair.id}:${near}`, () => ({
        name: 'Duduk dulu', marker: 'Free chair', target: {x: chair.x, y: 1, z: chair.z}, lit: true,
        hint: near ? `${options.touch ? 'Tap' : 'Click'} Sit to take this chair.` : `${options.touch ? 'Drag the MOVE stick' : 'Use W A S D'} to walk to the marked chair, then Sit.`,
      })), finish);
    },
  };
}
