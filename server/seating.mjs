// Which table someone is sitting at. lukis.mjs and poker.mjs each carried their own copy
// of this line; the chat handler needs the same answer, and three copies of one lookup is
// how they drift apart.
import chairs from '../shared/chairs.json' with {type: 'json'};

const tableByChair = new Map(chairs.filter(chair => chair.tableId).map(chair => [chair.id, chair.tableId]));

export const tableOf = player => tableByChair.get(player?.chairId) || undefined;
export const seatedWith = (players, tableId) =>
  tableId ? [...players.values()].filter(other => tableOf(other) === tableId) : [];
