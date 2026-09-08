import menu from '../shared/mamak-menu.json' with { type: 'json' };
import locations from '../shared/tables.json' with { type: 'json' };
import chairs from '../shared/chairs.json' with { type: 'json' };
import { filterChat } from './chat-filter.mjs';
const tableForChair = new Map(chairs.map(c => [c.id, c.tableId]));
export function createTableSocial(send) {
  const rooms = new WeakMap(), sessions = new WeakMap();
  function stats(player) {
    if (!sessions.has(player)) sessions.set(player, { startedAt: Date.now(), given: 0, received: 0, recalls: 0, lastOrder: 0, lastRound: 0, lastRename: 0, lastReceipt: 0, tableId: null });
    return sessions.get(player);
  }
  function room(players) {
    if (!rooms.has(players)) rooms.set(players, { tables: locations.map(t => ({ ...t, hostId: null, orders: new Map(), cups: new Set(), cheersUntil: 0 })), key: '' });
    return rooms.get(players);
  }
  function snapshot(players) {
    return room(players).tables.map(t => {
      const occupants = [...players.values()].filter(p => tableForChair.get(p.chairId) === t.id);
      if (!occupants.some(p => p.id === t.hostId)) t.hostId = occupants[0]?.id || null;
      for (const id of t.orders.keys()) if (!occupants.some(p => p.id === id)) t.orders.delete(id);
      for (const id of t.cups) if (!occupants.some(p => p.id === id)) t.cups.delete(id);
      for (const p of occupants) stats(p).tableId = t.id;
      return { id: t.id, name: t.name, hostId: t.hostId, capacity: chairs.filter(c => c.tableId === t.id).length, cheersUntil: t.cheersUntil,
        occupants: occupants.map(p => ({ id: p.id, name: p.name, chairId: p.chairId, hasCup: t.cups.has(p.id), order: t.orders.get(p.id) || null })) };
    });
  }
  function sync(players, force = false) {
    const tables = snapshot(players), state = room(players), key = JSON.stringify(tables);
    if (!force && key === state.key) return;
    state.key = key;
    for (const p of players.values()) send(p.ws, { type: 'tables', tables });
  }
  return {
    sync,
    join(player) { stats(player); },
    recall(player) { stats(player).recalls++; },
    handle(players, player, message) {
      if (!['table-name', 'table-round', 'table-order', 'table-consume', 'receipt'].includes(message.type)) return false;
      const own = stats(player), now = Date.now();
      if (message.type === 'receipt') {
        if (now - own.lastReceipt < 500) return true;
        own.lastReceipt = now;
        const table = room(players).tables.find(t => t.id === own.tableId);
        send(player.ws, { type: 'receipt', receipt: { name: player.name, tableId: table?.id || null, tableName: table?.name || 'Jalan-jalan dulu', minutes: Math.floor((now - own.startedAt) / 60000), drinksGiven: own.given, drinksReceived: own.received, recalls: own.recalls, issuedAt: new Date(now).toISOString() } });
        return true;
      }
      const tableId = tableForChair.get(player.chairId);
      const table = room(players).tables.find(t => t.id === tableId);
      if (!table) { send(player.ws, { type: 'notice', message: 'Take a seat at a mamak table first.' }); return true; }
      const view = snapshot(players).find(t => t.id === table.id);
      if (message.type === 'table-consume') {
        if (table.orders.delete(player.id)) { send(player.ws, {type:'notice',message:'Sedap! Order another whenever you like.'}); sync(players); }
        return true;
      }
      if (message.type === 'table-order') {
        const item = menu.find(item => item.id === message.itemId);
        if (!item) return true;
        if (table.orders.has(player.id)) { send(player.ws, {type:'notice',message:'Finish your current order first.'}); return true; }
        if (now - own.lastOrder < 3000) { send(player.ws, {type:'notice',message:'Sekejap boss! Try again in a moment.'}); return true; }
        own.lastOrder=now; table.orders.set(player.id,item.id);
        send(player.ws,{type:'notice',message:`${item.name} sampai! Enjoy, boss.`}); sync(players); return true;
      }
      if (message.type === 'table-name') {
        if (view.hostId !== player.id) { send(player.ws, { type: 'notice', message: 'Only the table host can rename it.' }); return true; }
        if (typeof message.name !== 'string' || now - own.lastRename < 1000) return true;
        const name = message.name.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 28);
        if (!name) return true;
        table.name = filterChat(name); own.lastRename = now; sync(players); return true;
      }
      if (now - own.lastRound < 10000) { send(player.ws, { type: 'notice', message: 'Let everyone enjoy their drink. Next round in a few seconds!' }); return true; }
      own.lastRound = now;
      const recipients = [...players.values()].filter(p => tableForChair.get(p.chairId) === table.id);
      for (const p of recipients) { stats(p).received++; table.cups.add(p.id); }
      own.given += recipients.filter(p => p !== player).length;
      table.cheersUntil = recipients.length > 1 ? now + 3500 : 0;
      for (const p of players.values()) if (Math.hypot(p.x-table.x,p.z-table.z) <= 15) send(p.ws, { type: 'table-round', tableId: table.id, from: player.name, count: recipients.length });
      sync(players); return true;
    }
  };
}
